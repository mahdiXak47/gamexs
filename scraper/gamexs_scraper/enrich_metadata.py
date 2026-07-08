"""Enrich games in the DB with publisher, genre_label, release_year, and
cover_url from the IGDB API (https://api-docs.igdb.com/).

IGDB uses Twitch OAuth2 — you need a free Twitch developer application:
    https://dev.twitch.tv/console/apps → Create App → Category: "Other"

Set in .env at the repo root:
    TWITCH_CLIENT_ID=...
    TWITCH_CLIENT_SECRET=...
    DATABASE_URL=...

Usage:
    python -m gamexs_scraper.enrich_metadata [--limit N] [--dry-run] [--all]
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Title cleaning: strip Persian/Arabic text so only the English name remains
# ---------------------------------------------------------------------------
_PERSIAN_RE = re.compile(r"[؀-ۿ‌‍‌‍]+")
# Trim edition/variant suffixes that hurt IGDB search precision
_EDITION_SUFFIX_RE = re.compile(
    r"\s+(?:[-–—]\s*)?\b(?:edition|standard|deluxe|gold|platinum|ultimate|complete|"
    r"goty|premium|digital|bundle|remastered|remake|definitive|legendary|collector|"
    r"director[s']?|enhanced|anniversary|launch|cross.gen)\b.*$",
    re.IGNORECASE,
)
_EXTRA_WS = re.compile(r"\s+")


def extract_english_title(db_title: str) -> str:
    """'Elden Ring نسخه Legacy' → 'Elden Ring'"""
    text = _PERSIAN_RE.sub(" ", db_title)
    text = _EDITION_SUFFIX_RE.sub("", text)
    return _EXTRA_WS.sub(" ", text).strip()


# ---------------------------------------------------------------------------
# IGDB / Twitch auth
# ---------------------------------------------------------------------------
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_BASE = "https://api.igdb.com/v4"
# Token cache lives next to this file so it survives across script runs.
_TOKEN_CACHE = Path(__file__).parent / ".igdb_token_cache.json"

# IGDB free tier: 4 requests/second sustained. 0.3 s gap is safe.
_DELAY = 0.3


def _fetch_token(client_id: str, client_secret: str) -> dict:
    resp = requests.post(
        TWITCH_TOKEN_URL,
        params={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def get_access_token(client_id: str, client_secret: str) -> str:
    """Return a valid Twitch access token, using a file cache."""
    if _TOKEN_CACHE.exists():
        cached = json.loads(_TOKEN_CACHE.read_text())
        if cached.get("expires_at", 0) > time.time() + 3600:
            return cached["access_token"]

    data = _fetch_token(client_id, client_secret)
    token = data["access_token"]
    expires_at = time.time() + data.get("expires_in", 86400)
    _TOKEN_CACHE.write_text(json.dumps({"access_token": token, "expires_at": expires_at}))
    return token


# ---------------------------------------------------------------------------
# IGDB query helpers
# ---------------------------------------------------------------------------

def igdb_post(session: requests.Session, client_id: str, token: str, endpoint: str, body: str) -> list:
    resp = session.post(
        f"{IGDB_BASE}/{endpoint}",
        headers={
            "Client-ID": client_id,
            "Authorization": f"Bearer {token}",
        },
        data=body,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def igdb_cover_url(image_id: str) -> str:
    return f"https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"


def enrich_one(
    session: requests.Session,
    client_id: str,
    token: str,
    db_title: str,
) -> dict | None:
    """
    Return {publisher, genre_label, release_year, cover_url} from IGDB
    or None if no match is found.
    """
    en_title = extract_english_title(db_title)
    if not en_title:
        return None

    time.sleep(_DELAY)
    results = igdb_post(
        session, client_id, token, "games",
        f"""
        search "{en_title}";
        fields name,
               cover.image_id,
               genres.name,
               involved_companies.company.name,
               involved_companies.publisher,
               first_release_date;
        limit 1;
        """,
    )
    if not results:
        return None

    game = results[0]

    # Publisher: first involved_company where publisher == true
    publisher: str | None = None
    for ic in game.get("involved_companies") or []:
        if ic.get("publisher"):
            company = ic.get("company") or {}
            publisher = company.get("name") or None
            break

    # Fallback: first company regardless of role
    if publisher is None:
        for ic in game.get("involved_companies") or []:
            company = ic.get("company") or {}
            if company.get("name"):
                publisher = company["name"]
                break

    genres = game.get("genres") or []
    genre_label = genres[0]["name"] if genres else None

    ts = game.get("first_release_date")
    release_year = None
    if ts:
        from datetime import datetime, timezone
        release_year = datetime.fromtimestamp(ts, tz=timezone.utc).year

    cover = game.get("cover") or {}
    image_id = cover.get("image_id")
    cover_url = igdb_cover_url(image_id) if image_id else None

    return {
        "publisher": publisher,
        "genre_label": genre_label,
        "release_year": release_year,
        "cover_url": cover_url,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Enrich game rows with IGDB metadata")
    parser.add_argument("--limit", type=int, default=0, help="Max games to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Show results without writing to DB")
    parser.add_argument("--all", action="store_true", help="Re-enrich games that already have data")
    args = parser.parse_args()

    client_id = os.environ.get("TWITCH_CLIENT_ID")
    client_secret = os.environ.get("TWITCH_CLIENT_SECRET")
    database_url = os.environ.get("DATABASE_URL")

    if not client_id or not client_secret:
        sys.exit(
            "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not set.\n"
            "Create a free app at https://dev.twitch.tv/console/apps and add them to .env"
        )
    if not database_url:
        sys.exit("DATABASE_URL not set — check .env at the repo root")

    token = get_access_token(client_id, client_secret)
    session = requests.Session()
    session.headers["Accept"] = "application/json"

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        if args.all:
            cur.execute("SELECT id, title FROM games ORDER BY title")
        else:
            cur.execute(
                "SELECT id, title FROM games "
                "WHERE publisher IS NULL OR cover_url IS NULL "
                "ORDER BY title"
            )
        rows = cur.fetchall()

    if args.limit:
        rows = rows[: args.limit]

    total = len(rows)
    print(f"{total} games to enrich", file=sys.stderr)

    updated = skipped = errors = 0

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        for i, (game_id, title) in enumerate(rows, start=1):
            label = title[:55]
            print(f"\r[{i:>3}/{total}] {label:<55}", end="", file=sys.stderr)

            try:
                data = enrich_one(session, client_id, token, title)
            except Exception as exc:
                print(f"\n  ERROR: {exc}", file=sys.stderr)
                errors += 1
                continue

            if data is None or all(v is None for v in data.values()):
                skipped += 1
                continue

            if args.dry_run:
                print(f"\n  → {data}", file=sys.stderr)
                updated += 1
                continue

            cur.execute(
                """
                UPDATE games
                SET publisher    = COALESCE(%s, publisher),
                    genre_label  = COALESCE(%s, genre_label),
                    release_year = COALESCE(%s::smallint, release_year),
                    cover_url    = COALESCE(%s, cover_url)
                WHERE id = %s
                """,
                (data["publisher"], data["genre_label"], data["release_year"], data["cover_url"], game_id),
            )
            updated += 1

        if not args.dry_run:
            conn.commit()

    print(
        f"\ndone — {updated} updated, {skipped} not found on IGDB, {errors} errors",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
