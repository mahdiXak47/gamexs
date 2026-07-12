"""Enrich the games table with metadata from IGDB.

Searches IGDB for each game that has no igdb_id yet, picks the best match
using name similarity + PS5 platform preference, and writes:
  cover_url, genre_label, publisher, release_year, igdb_id

IGDB covers overwrite any previously-scraped seller image (canonical quality).
If IGDB has no cover for a matched game the seller image is kept as fallback.

Safe to re-run: only games with igdb_id IS NULL are processed by default.
Use --all to re-enrich games that already have an igdb_id.

Usage:
    python -m gamexs_scraper.enrich_metadata [--limit N] [--dry-run] [--all]

Required env vars:
    DATABASE_URL          — Postgres connection string
    IGDB_CLIENT_ID        — Twitch app client_id
    IGDB_CLIENT_SECRET    — Twitch app client_secret
"""

import argparse
import os
import re
import sys
import time
from datetime import datetime, timezone
from difflib import SequenceMatcher

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"
PS5_PLATFORM_ID = 167
COVER_URL_TEMPLATE = "https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"

# Categories that represent a proper releasable game (not DLC, episode, etc.)
_MAIN_CATEGORIES = {
    0,   # main_game
    4,   # standalone_expansion
    8,   # remake
    9,   # remaster
    10,  # expanded_game
}

# Accept IGDB match only if score reaches this threshold (0–1 + bonuses).
_MIN_SCORE = 0.65

# Seconds between requests — IGDB free tier allows 4 req/s; 0.28 s ≈ 3.5/s.
_RATE_DELAY = 0.28

# IGDB fields returned per game result.
_FIELDS = (
    "name,category,cover.image_id,"
    "genres.name,"
    "first_release_date,"
    "involved_companies.company.name,involved_companies.publisher,"
    "platforms.id"
)

# Strip Persian/Arabic Unicode block so only English remains for IGDB search.
_PERSIAN_RE = re.compile(r"[؀-ۿ‌‍]+")

# Strip common edition/variant suffixes that confuse IGDB search ranking.
_EDITION_RE = re.compile(
    r"\s*[-–—]?\s*\b("
    r"edition|standard|deluxe|gold|platinum|ultimate|complete|"
    r"goty|premium|digital|bundle|remastered|remake|definitive|legendary|"
    r"collector[s']?|director[s']?|enhanced|anniversary|launch|cross.gen|"
    r"نسخه|ویژه|دیجیتال|کامل|اسپشیال"
    r")\b.*$",
    re.IGNORECASE,
)

_WS_RE = re.compile(r"\s+")


def _search_title(raw: str) -> str:
    """Derive a clean English search term from a potentially mixed-language title."""
    text = _PERSIAN_RE.sub(" ", raw)
    text = _EDITION_RE.sub("", text)
    text = _WS_RE.sub(" ", text).strip()
    # Escape double-quotes so the IGDB query string doesn't break.
    return text.replace('"', '\\"')


# ---------------------------------------------------------------------------
# Twitch OAuth
# ---------------------------------------------------------------------------
def get_access_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        TWITCH_TOKEN_URL,
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# IGDB query
# ---------------------------------------------------------------------------
def _igdb_search(session: requests.Session, title: str) -> list[dict]:
    """Return up to 5 IGDB results for *title*. Returns [] on no match."""
    if not title:
        return []
    query = f'search "{title}"; fields {_FIELDS}; limit 5;'
    resp = session.post(IGDB_GAMES_URL, data=query, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Match scoring and selection
# ---------------------------------------------------------------------------
def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _score(result: dict, query: str) -> float:
    """Score 0..~1.2. Higher = better match for *query*."""
    name_sim = _similarity(result.get("name", ""), query)
    ps5_bonus = 0.08 if PS5_PLATFORM_ID in [p["id"] for p in result.get("platforms", [])] else 0.0
    cat_bonus = 0.05 if result.get("category", -1) in _MAIN_CATEGORIES else 0.0
    return name_sim + ps5_bonus + cat_bonus


def _pick_best(results: list[dict], query: str) -> dict | None:
    if not results:
        return None
    best = max(results, key=lambda r: _score(r, query))
    if _score(best, query) < _MIN_SCORE:
        return None
    return best


# ---------------------------------------------------------------------------
# Data extraction from a matched IGDB result
# ---------------------------------------------------------------------------
def _cover_url(result: dict) -> str | None:
    image_id = (result.get("cover") or {}).get("image_id")
    return COVER_URL_TEMPLATE.format(image_id=image_id) if image_id else None


def _publisher(result: dict) -> str | None:
    companies = result.get("involved_companies") or []
    for ic in companies:
        if ic.get("publisher"):
            return (ic.get("company") or {}).get("name")
    # Fall back to first listed company if no explicit publisher role
    for ic in companies:
        name = (ic.get("company") or {}).get("name")
        if name:
            return name
    return None


def _genre(result: dict) -> str | None:
    genres = result.get("genres") or []
    return genres[0]["name"] if genres else None


def _year(result: dict) -> int | None:
    ts = result.get("first_release_date")
    return datetime.fromtimestamp(ts, tz=timezone.utc).year if ts else None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Enrich game rows with IGDB metadata")
    parser.add_argument("--limit", type=int, default=0, help="Max games to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to DB")
    parser.add_argument(
        "--all",
        action="store_true",
        help="Re-enrich games that already have an igdb_id (full refresh)",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")

    if not database_url:
        sys.exit("DATABASE_URL is not set — check .env at the repo root")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in .env")

    print("obtaining IGDB access token …", file=sys.stderr)
    token = get_access_token(client_id, client_secret)

    session = requests.Session()
    session.headers.update({
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    })

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            if args.all:
                cur.execute("SELECT id, title FROM games ORDER BY title")
            else:
                cur.execute("SELECT id, title FROM games WHERE igdb_id IS NULL ORDER BY title")
            games = cur.fetchall()

    if args.limit:
        games = games[: args.limit]

    total = len(games)
    print(f"{total} games to enrich", file=sys.stderr)

    matched = skipped = errors = 0

    with psycopg.connect(database_url) as conn:
        for i, (game_id, title) in enumerate(games, start=1):
            print(f"\r[{i:>4}/{total}] {title[:55]:<55}", end="", file=sys.stderr)

            search_term = _search_title(title)
            if not search_term:
                skipped += 1
                continue

            try:
                results = _igdb_search(session, search_term)
                time.sleep(_RATE_DELAY)
            except requests.RequestException as exc:
                print(f"\n  request error for {title!r}: {exc}", file=sys.stderr)
                errors += 1
                continue

            best = _pick_best(results, search_term)
            if not best:
                skipped += 1
                continue

            igdb_id = best["id"]
            cover = _cover_url(best)
            genre = _genre(best)
            publisher = _publisher(best)
            year = _year(best)

            if args.dry_run:
                print(
                    f"\n  → igdb:{igdb_id} {best['name']!r}  "
                    f"genre={genre} pub={publisher} year={year} cover={'yes' if cover else 'no'}",
                    file=sys.stderr,
                )
                matched += 1
                continue

            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE games SET
                        igdb_id      = %s,
                        genre_label  = COALESCE(%s, genre_label),
                        publisher    = COALESCE(%s, publisher),
                        release_year = COALESCE(%s::smallint, release_year),
                        cover_url    = COALESCE(%s, cover_url)
                    WHERE id = %s
                    """,
                    (igdb_id, genre, publisher, year, cover, game_id),
                )
            conn.commit()
            matched += 1

    print(file=sys.stderr)
    print(
        f"done — {matched} matched and updated, {skipped} no confident match, {errors} request errors",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
