"""Fetch every PS5 game from IGDB and report which ones are absent from our DB.

Outputs two files to scraper/output/:
  missing_ps5_games.csv  — games in IGDB that have no matching igdb_id in our games table
  missing_ps5_games.json — same data as JSON for programmatic use

Games are sorted by rating_count descending so the most popular missing titles
come first.

Usage:
    python -m gamexs_scraper.find_missing_ps5_games [--output-dir PATH]

Required env vars (same as enrich_metadata.py):
    DATABASE_URL, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
"""

import argparse
import csv
import json
import os
import sys
import time
from datetime import datetime, timezone

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL   = "https://api.igdb.com/v4/games"
PS5_PLATFORM_ID  = 167

# Categories that represent a proper releasable game.
# IGDB omits category=0 (main_game) from the response because it's the default
# numeric value — treat missing category as 0.
_MAIN_CATEGORIES = {
    0,   # main_game
    4,   # standalone_expansion
    8,   # remake
    9,   # remaster
    10,  # expanded_game
    11,  # expanded_game (alt id in some IGDB versions)
}

_PAGE_SIZE = 500
_RATE_DELAY = 0.3   # seconds between IGDB requests


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def _get_token(client_id: str, client_secret: str) -> str:
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
# IGDB fetch (paginated)
# ---------------------------------------------------------------------------
def _fetch_igdb_ps5_games(session: requests.Session) -> list[dict]:
    """Return all PS5 games from IGDB across however many pages needed."""
    all_games: list[dict] = []
    offset = 0

    while True:
        query = (
            f"fields id,name,category,first_release_date,"
            f"follows,rating,rating_count,hypes,cover.image_id;"
            f" where platforms = ({PS5_PLATFORM_ID});"
            f" sort id asc;"
            f" limit {_PAGE_SIZE}; offset {offset};"
        )
        resp = session.post(IGDB_GAMES_URL, data=query, timeout=20)
        resp.raise_for_status()
        page = resp.json()

        if not page:
            break

        all_games.extend(page)
        print(
            f"\r  fetched {len(all_games):,} games from IGDB …",
            end="",
            flush=True,
            file=sys.stderr,
        )
        time.sleep(_RATE_DELAY)

        if len(page) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE

    print(file=sys.stderr)
    return all_games


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------
def _fetch_our_igdb_ids(database_url: str) -> set[int]:
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT igdb_id FROM games WHERE igdb_id IS NOT NULL")
            return {row[0] for row in cur.fetchall()}


def _count_our_games(database_url: str) -> tuple[int, int]:
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*), COUNT(igdb_id) FROM games")
            return cur.fetchone()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _release_year(game: dict) -> int | None:
    ts = game.get("first_release_date")
    return datetime.fromtimestamp(ts, tz=timezone.utc).year if ts else None


def _cover_url(game: dict) -> str | None:
    image_id = (game.get("cover") or {}).get("image_id")
    return (
        f"https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"
        if image_id
        else None
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Find PS5 games on IGDB missing from our DB")
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "..", "output"),
        help="Directory to write output files (default: scraper/output/)",
    )
    parser.add_argument(
        "--no-filter",
        action="store_true",
        help="Include DLC/episodes/mods, not just main game categories",
    )
    args = parser.parse_args()

    database_url  = os.environ.get("DATABASE_URL")
    client_id     = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")

    if not database_url:
        sys.exit("DATABASE_URL is not set")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set")

    # --- Auth ---
    print("obtaining IGDB token …", file=sys.stderr)
    token = _get_token(client_id, client_secret)
    session = requests.Session()
    session.headers.update({
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    })

    # --- Fetch IGDB ---
    print("fetching all PS5 games from IGDB …", file=sys.stderr)
    igdb_games = _fetch_igdb_ps5_games(session)
    print(f"  total from IGDB: {len(igdb_games):,}", file=sys.stderr)

    # --- Filter to main game categories ---
    if not args.no_filter:
        igdb_games = [
            g for g in igdb_games
            # category field absent → default 0 (main_game)
            if g.get("category", 0) in _MAIN_CATEGORIES
        ]
        print(f"  after category filter (main games only): {len(igdb_games):,}", file=sys.stderr)

    # --- Our DB ---
    total_db, enriched_db = _count_our_games(database_url)
    our_igdb_ids = _fetch_our_igdb_ids(database_url)
    print(
        f"  our DB: {total_db:,} games total, {enriched_db:,} enriched with igdb_id "
        f"({total_db - enriched_db:,} not yet matched)",
        file=sys.stderr,
    )

    # --- Diff ---
    missing = [g for g in igdb_games if g["id"] not in our_igdb_ids]
    print(
        f"  IGDB has but we don't: {len(missing):,} games",
        file=sys.stderr,
    )

    # Sort by rating_count desc (most popular first), then follows, then name
    missing.sort(
        key=lambda g: (
            -(g.get("rating_count") or 0),
            -(g.get("follows") or 0),
            -(g.get("hypes") or 0),
            g.get("name", ""),
        )
    )

    # --- Write CSV ---
    os.makedirs(args.output_dir, exist_ok=True)
    csv_path  = os.path.join(args.output_dir, "missing_ps5_games.csv")
    json_path = os.path.join(args.output_dir, "missing_ps5_games.json")

    fieldnames = [
        "igdb_id", "name", "release_year",
        "rating", "rating_count", "follows", "hypes",
        "category", "cover_url",
    ]

    rows: list[dict] = []
    for g in missing:
        rows.append({
            "igdb_id":      g["id"],
            "name":         g.get("name", ""),
            "release_year": _release_year(g) or "",
            "rating":       round(g.get("rating") or 0, 1),
            "rating_count": g.get("rating_count") or 0,
            "follows":      g.get("follows") or 0,
            "hypes":        g.get("hypes") or 0,
            "category":     g.get("category", 0),
            "cover_url":    _cover_url(g) or "",
        })

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)

    print(f"\nwrote {len(rows):,} missing games to:", file=sys.stderr)
    print(f"  {csv_path}", file=sys.stderr)
    print(f"  {json_path}", file=sys.stderr)

    # --- Print top 30 to stdout ---
    print(f"\nTop 30 most popular PS5 games missing from our catalogue:\n")
    print(f"{'#':<4} {'IGDB':>7}  {'Rating':>6}  {'Votes':>5}  {'Year':>4}  Name")
    print("-" * 80)
    for i, r in enumerate(rows[:30], start=1):
        print(
            f"{i:<4} {r['igdb_id']:>7}  "
            f"{r['rating']:>6.1f}  "
            f"{r['rating_count']:>5}  "
            f"{str(r['release_year']):>4}  "
            f"{r['name']}"
        )


if __name__ == "__main__":
    main()
