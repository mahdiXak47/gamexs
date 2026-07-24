"""Enrich the games table with metadata from IGDB.

Searches IGDB for each game that has no igdb_id yet, picks the best match
using name similarity + PS5 platform preference, and writes:
  igdb_id, igdb_name, title, slug, cover_url, genre_label, publisher,
  release_year, release_date

After a confident IGDB match the game's title and slug are replaced with the
IGDB canonical name (processed through clean_title / url_slugify) so all
display titles come from the authoritative source rather than seller-page H1s.

If the canonical slug already belongs to another game row (a duplicate scraped
under a different seller title), the current game's listings are reassigned to
that canonical row and the duplicate is deleted.

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
from datetime import date, datetime, timezone
from difflib import SequenceMatcher

import psycopg
import requests
from dotenv import load_dotenv

from .load_to_postgres import url_slugify
from .normalize import clean_title, normalize_game_name

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
    "name,slug,category,cover.image_id,"
    "storyline,summary,url,"
    "genres.name,"
    "themes.name,"
    "game_modes.name,"
    "franchises.name,"
    "collections.name,"
    "platforms.id,platforms.name,"
    "involved_companies.company.name,involved_companies.publisher,involved_companies.developer,"
    "first_release_date"
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
    for ic in companies:
        name = (ic.get("company") or {}).get("name")
        if name:
            return name
    return None


def _developers(result: dict) -> list[str]:
    return [
        ic["company"]["name"]
        for ic in (result.get("involved_companies") or [])
        if ic.get("developer") and ic.get("company", {}).get("name")
    ]


def _genre(result: dict) -> str | None:
    genres = result.get("genres") or []
    return genres[0]["name"] if genres else None


def _names(result: dict, key: str) -> list[str]:
    return [item["name"] for item in (result.get(key) or []) if item.get("name")]


def _release_date(result: dict) -> date | None:
    ts = result.get("first_release_date")
    return datetime.fromtimestamp(ts, tz=timezone.utc).date() if ts else None


# ---------------------------------------------------------------------------
# DB write with reconnect-on-failure (survives kubectl port-forward drops)
# ---------------------------------------------------------------------------
_RECONNECT_DELAY = 20  # seconds between reconnect attempts (infinite retries)


def _db_connect(database_url: str) -> psycopg.Connection:
    """Connect with infinite retries — waits for port-forward to come back."""
    attempt = 0
    while True:
        try:
            return psycopg.connect(database_url, connect_timeout=10)
        except psycopg.OperationalError as exc:
            attempt += 1
            print(
                f"\n  DB unavailable (attempt {attempt}): {exc}\n"
                f"  Waiting {_RECONNECT_DELAY}s — restart port-forward if needed …",
                file=sys.stderr,
            )
            time.sleep(_RECONNECT_DELAY)


def _write_game(
    database_url: str,
    game_id: int,
    platform_id: int,
    igdb_id: int,
    igdb_name: str,
    new_title: str,
    new_slug: str,
    genre: str | None,
    publisher: str | None,
    release_dt: date | None,
    cover: str | None,
    storyline: str | None,
    summary: str | None,
    igdb_url: str | None,
    genres: list[str],
    game_modes: list[str],
    platforms: list[str],
    franchises: list[str],
    collections: list[str],
    developers: list[str],
) -> str:
    """Write IGDB metadata to the game row and return a status string.

    Status values:
      "updated"  — game row updated in place
      "merged"   — current game was a duplicate; its listings were reassigned
                   to the canonical row and it was deleted
    """
    year = release_dt.year if release_dt else None
    while True:
        try:
            with _db_connect(database_url) as conn:
                with conn.cursor() as cur:
                    # Check whether another game already owns the canonical slug.
                    cur.execute(
                        "SELECT id FROM ps5_games WHERE platform_id = %s AND slug = %s AND id != %s",
                        (platform_id, new_slug, game_id),
                    )
                    conflict = cur.fetchone()

                    _detail_params = (
                        storyline or None,
                        summary or None,
                        igdb_url or None,
                        genres or None,
                        game_modes or None,
                        platforms or None,
                        franchises or None,
                        collections or None,
                        developers or None,
                    )

                    if conflict:
                        primary_id = conflict[0]
                        cur.execute(
                            "UPDATE listings SET game_id = %s WHERE game_id = %s",
                            (primary_id, game_id),
                        )
                        cur.execute("DELETE FROM ps5_games WHERE id = %s", (game_id,))
                        cur.execute(
                            """
                            UPDATE ps5_games SET
                                igdb_id      = %s,
                                igdb_name    = %s,
                                title        = %s,
                                genre_label  = COALESCE(%s, genre_label),
                                publisher    = COALESCE(%s, publisher),
                                release_year = COALESCE(%s::smallint, release_year),
                                release_date = COALESCE(%s, release_date),
                                cover_url    = COALESCE(%s, cover_url),
                                storyline    = COALESCE(%s, storyline),
                                summary      = COALESCE(%s, summary),
                                igdb_url     = COALESCE(%s, igdb_url),
                                genres       = COALESCE(%s, genres),
                                game_modes   = COALESCE(%s, game_modes),
                                platforms    = COALESCE(%s, platforms),
                                franchises   = COALESCE(%s, franchises),
                                collections  = COALESCE(%s, collections),
                                developers   = COALESCE(%s, developers)
                            WHERE id = %s
                            """,
                            (igdb_id, igdb_name, new_title, genre, publisher, year, release_dt, cover,
                             *_detail_params, primary_id),
                        )
                        conn.commit()
                        return "merged"

                    # No conflict — update this game row with IGDB data.
                    cur.execute(
                        """
                        UPDATE ps5_games SET
                            igdb_id      = %s,
                            igdb_name    = %s,
                            title        = %s,
                            slug         = %s,
                            genre_label  = COALESCE(%s, genre_label),
                            publisher    = COALESCE(%s, publisher),
                            release_year = COALESCE(%s::smallint, release_year),
                            release_date = COALESCE(%s, release_date),
                            cover_url    = COALESCE(%s, cover_url),
                            storyline    = %s,
                            summary      = %s,
                            igdb_url     = %s,
                            genres       = %s,
                            game_modes   = %s,
                            platforms    = %s,
                            franchises   = %s,
                            collections  = %s,
                            developers   = %s
                        WHERE id = %s
                        """,
                        (igdb_id, igdb_name, new_title, new_slug, genre, publisher, year, release_dt, cover,
                         *_detail_params, game_id),
                    )
                conn.commit()
            return "updated"
        except psycopg.OperationalError as exc:
            print(f"\n  Write failed mid-connection: {exc}; retrying …", file=sys.stderr)
            time.sleep(_RECONNECT_DELAY)


def _fetch_games(database_url: str, all_games: bool) -> list[tuple[int, int, str]]:
    with _db_connect(database_url) as conn:
        with conn.cursor() as cur:
            # Exclude games whose title mentions PS4 but not PS5 — these are
            # PS4-only listings that the scraper stored under the PS5 platform
            # because load_to_postgres always uses --platform ps5.
            ps5_only = (
                "(g.title NOT ILIKE '%ps4%' OR g.title ILIKE '%ps5%')"
            )
            base = (
                "SELECT g.id, g.platform_id, g.title FROM ps5_games g "
                f"JOIN platforms p ON p.id = g.platform_id AND p.slug = 'ps5' "
                f"WHERE {ps5_only}"
            )
            if all_games:
                cur.execute(base + " ORDER BY g.title")
            else:
                cur.execute(base + " AND g.igdb_id IS NULL ORDER BY g.title")
            return cur.fetchall()


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

    games = _fetch_games(database_url, args.all)

    if args.limit:
        games = games[: args.limit]

    total = len(games)
    print(f"{total} games to enrich", file=sys.stderr)

    matched = merged = skipped = errors = 0

    for i, (game_id, platform_id, title) in enumerate(games, start=1):
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

        igdb_id   = best["id"]
        igdb_name = best["name"]

        # Decide whether to adopt IGDB's canonical name as the display title.
        # _search_title strips edition words before querying IGDB, so IGDB
        # may return the BASE game even when our DB row is for a specific
        # edition (e.g. "Collector"). In that case, keep our normalized title
        # so edition variants stay as separate rows with correct pricing.
        our_clean_title  = clean_title(title)
        our_has_edition  = bool(_EDITION_RE.search(our_clean_title))
        igdb_has_edition = bool(_EDITION_RE.search(igdb_name))

        if not our_has_edition or igdb_has_edition:
            new_title = clean_title(igdb_name)
            # Prefer IGDB's own slug (already canonical); fall back to computed.
            new_slug  = best.get("slug") or url_slugify(normalize_game_name(igdb_name))
        else:
            new_title = our_clean_title
            new_slug  = url_slugify(normalize_game_name(title))

        cover       = _cover_url(best)
        genre       = _genre(best)
        publisher   = _publisher(best)
        release_dt  = _release_date(best)
        storyline   = best.get("storyline") or None
        summary     = best.get("summary") or None
        igdb_url    = best.get("url") or None
        genres      = _names(best, "genres")
        game_modes  = _names(best, "game_modes")
        platforms   = _names(best, "platforms")
        franchises  = _names(best, "franchises")
        collections = _names(best, "collections")
        developers  = _developers(best)

        if args.dry_run:
            edition_note = " [edition kept]" if (our_has_edition and not igdb_has_edition) else ""
            print(
                f"\n  → igdb:{igdb_id} {igdb_name!r} -> title={new_title!r} slug={new_slug!r}{edition_note}\n"
                f"     genre={genre} pub={publisher} date={release_dt} cover={'yes' if cover else 'no'}\n"
                f"     genres={genres} modes={game_modes} platforms={platforms[:3]}\n"
                f"     franchises={franchises} collections={collections} devs={developers}",
                file=sys.stderr,
            )
            matched += 1
            continue

        status = _write_game(
            database_url, game_id, platform_id,
            igdb_id, igdb_name, new_title, new_slug,
            genre, publisher, release_dt, cover,
            storyline, summary, igdb_url,
            genres, game_modes, platforms, franchises, collections, developers,
        )
        if status == "merged":
            merged += 1
        else:
            matched += 1

    print(file=sys.stderr)
    print(
        f"done — {matched} updated, {merged} merged into canonical row, "
        f"{skipped} no confident match, {errors} request errors",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
