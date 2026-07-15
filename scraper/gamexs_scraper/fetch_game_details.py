"""Fetch rich per-game metadata from IGDB and save one JSON file per game.

Reads every game in our DB that has an igdb_id, queries IGDB in batches of 50,
and writes output/game_details/<slug>.json.  Existing files are skipped unless
--refresh is passed (idempotent).

Fields saved per game:
  slug, igdb_id, name, summary
  developers, publishers
  genres, themes, game_modes, player_perspectives
  series, franchises, game_engine
  keywords, alternative_names, websites, release_dates

Usage:
    python -m gamexs_scraper.fetch_game_details [--output-dir PATH] [--limit N] [--refresh]

Required env vars:
    DATABASE_URL, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
"""

import argparse
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

_BATCH_SIZE  = 50    # IGDB allows up to 500 per request; 50 keeps payloads light
_RATE_DELAY  = 0.30  # seconds between requests (≤ 3.3/s within the 4/s free-tier limit)

_FIELDS = (
    "name,summary,"
    "genres.name,"
    "themes.name,"
    "game_modes.name,"
    "player_perspectives.name,"
    "involved_companies.company.name,involved_companies.developer,involved_companies.publisher,"
    "collections.name,"          # series
    "franchises.name,"
    "game_engines.name,"
    "keywords.name,"
    "alternative_names.name,alternative_names.comment,"
    "websites.*,"                # use * to get all website fields incl. type
    "release_dates.platform.name,"
    "release_dates.region,"
    "release_dates.date,"
    "release_dates.human,"
    "release_dates.status,"
    "parent_game.name,"          # "is a spin-off of"
    "first_release_date,"
    "artworks.image_id,"         # artwork images
    "videos.video_id,videos.name"  # YouTube videos with title
)

# IGDB website type integer → human-readable label
# Field name in IGDB response is "type", not "category"
_WEBSITE_TYPE = {
    1:  "Official Website",
    2:  "Community Wiki",
    3:  "Wikipedia",
    4:  "Facebook",
    5:  "Twitter",
    6:  "Twitch",
    8:  "Instagram",
    9:  "YouTube",
    10: "iPhone",
    11: "iPad",
    12: "Android",
    13: "Steam",
    14: "Subreddit",
    15: "Itch",
    16: "Epic",
    17: "GOG",
    18: "Discord",
    19: "Bluesky",
    22: "Xbox Store",
    23: "PlayStation Store",
}

# IGDB release_dates.region integer → label
_REGION = {
    1: "Europe",
    2: "North America",
    3: "Australia",
    4: "New Zealand",
    5: "Japan",
    6: "China",
    7: "Asia",
    8: "Worldwide",
    9: "Korea",
    10: "Brazil",
}

# IGDB release_dates.status integer → label
_RELEASE_STATUS = {
    0: "Released",
    2: "Alpha",
    3: "Beta",
    4: "Early Access",
    5: "Offline",
    6: "Cancelled",
    7: "Rumored",
    8: "Delisted",
}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def _get_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        TWITCH_TOKEN_URL,
        data={
            "client_id":     client_id,
            "client_secret": client_secret,
            "grant_type":    "client_credentials",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------
def _fetch_db_games(database_url: str) -> list[dict]:
    """Return list of {id, slug, title, igdb_id} for all enriched games."""
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, slug, title, igdb_id FROM games "
                "WHERE igdb_id IS NOT NULL ORDER BY title"
            )
            return [
                {"id": row[0], "slug": row[1], "title": row[2], "igdb_id": row[3]}
                for row in cur.fetchall()
            ]


# ---------------------------------------------------------------------------
# IGDB batch fetch
# ---------------------------------------------------------------------------
def _fetch_batch(session: requests.Session, igdb_ids: list[int]) -> list[dict]:
    ids_str = ", ".join(str(i) for i in igdb_ids)
    query = f"fields {_FIELDS}; where id = ({ids_str}); limit {len(igdb_ids)};"
    resp = session.post(IGDB_GAMES_URL, data=query, timeout=20)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Shape raw IGDB response into our JSON format
# ---------------------------------------------------------------------------
def _shape(raw: dict, slug: str, igdb_id: int) -> dict:
    companies = raw.get("involved_companies") or []
    developers = [
        ic["company"]["name"]
        for ic in companies
        if ic.get("developer") and ic.get("company")
    ]
    publishers = [
        ic["company"]["name"]
        for ic in companies
        if ic.get("publisher") and ic.get("company")
    ]

    genres      = [g["name"] for g in (raw.get("genres") or [])]
    themes      = [t["name"] for t in (raw.get("themes") or [])]
    game_modes  = [m["name"] for m in (raw.get("game_modes") or [])]
    perspectives = [p["name"] for p in (raw.get("player_perspectives") or [])]
    series      = [c["name"] for c in (raw.get("collections") or [])]
    franchises  = [f["name"] for f in (raw.get("franchises") or [])]
    engines     = [e["name"] for e in (raw.get("game_engines") or [])]
    keywords    = [k["name"] for k in (raw.get("keywords") or [])]

    alt_names = []
    for an in (raw.get("alternative_names") or []):
        entry = {"name": an.get("name", "")}
        if an.get("comment"):
            entry["comment"] = an["comment"]
        alt_names.append(entry)

    websites = [
        {
            "label": _WEBSITE_TYPE.get(w.get("type"), f"Website ({w.get('type')})"),
            "url":   w.get("url", ""),
        }
        for w in (raw.get("websites") or [])
    ]

    release_dates = []
    for rd in (raw.get("release_dates") or []):
        platform = (rd.get("platform") or {}).get("name")
        status_code = rd.get("status")  # absent/null in IGDB means 0 = Released
        entry = {
            "platform": platform,
            "region":   _REGION.get(rd.get("region"), rd.get("region")),
            "date":     rd.get("human"),
            "status":   _RELEASE_STATUS.get(status_code if status_code is not None else 0, f"status_{status_code}"),
        }
        if rd.get("date"):
            ts = rd["date"]
            entry["date_iso"] = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        release_dates.append(entry)

    spin_off_of = None
    if raw.get("parent_game"):
        spin_off_of = raw["parent_game"].get("name")

    first_release_ts = raw.get("first_release_date")
    first_release_year = (
        datetime.fromtimestamp(first_release_ts, tz=timezone.utc).year
        if first_release_ts else None
    )

    artworks = [
        f"https://images.igdb.com/igdb/image/upload/t_1080p/{aw['image_id']}.jpg"
        for aw in (raw.get("artworks") or [])
        if aw.get("image_id")
    ]

    videos = [
        {
            "title": v.get("name", ""),
            "youtube_id": v.get("video_id", ""),
            "url": f"https://www.youtube.com/watch?v={v['video_id']}",
        }
        for v in (raw.get("videos") or [])
        if v.get("video_id")
    ]

    return {
        "slug":               slug,
        "igdb_id":            igdb_id,
        "name":               raw.get("name", ""),
        "summary":            raw.get("summary", ""),
        "first_release_year": first_release_year,
        "developers":         developers,
        "publishers":         publishers,
        "genres":             genres,
        "themes":             themes,
        "game_modes":         game_modes,
        "player_perspectives": perspectives,
        "series":             series,
        "spin_off_of":        spin_off_of,
        "franchises":         franchises,
        "game_engines":       engines,
        "keywords":           keywords,
        "alternative_names":  alt_names,
        "websites":           websites,
        "release_dates":      release_dates,
        "artworks":           artworks,
        "videos":             videos,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Fetch rich IGDB details and save one JSON per game")
    parser.add_argument(
        "--output-dir",
        default=os.path.join(os.path.dirname(__file__), "..", "output", "game_details"),
        help="Directory to write JSON files (default: output/game_details/)",
    )
    parser.add_argument("--limit", type=int, default=0, help="Max games to process (0 = all)")
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Re-fetch games that already have a JSON file",
    )
    args = parser.parse_args()

    database_url  = os.environ.get("DATABASE_URL")
    client_id     = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")

    if not database_url:
        sys.exit("DATABASE_URL is not set")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set")

    os.makedirs(args.output_dir, exist_ok=True)

    print("obtaining IGDB token …", file=sys.stderr)
    token = _get_token(client_id, client_secret)
    session = requests.Session()
    session.headers.update({
        "Client-ID":     client_id,
        "Authorization": f"Bearer {token}",
        "Content-Type":  "text/plain",
    })

    print("reading games from DB …", file=sys.stderr)
    games = _fetch_db_games(database_url)
    print(f"  {len(games):,} enriched games in DB", file=sys.stderr)

    if not args.refresh:
        games = [
            g for g in games
            if not os.path.exists(os.path.join(args.output_dir, f"{g['slug']}.json"))
        ]
        print(f"  {len(games):,} need fetching (use --refresh to re-fetch all)", file=sys.stderr)

    if args.limit:
        games = games[: args.limit]

    total  = len(games)
    done   = 0
    errors = 0

    # Build igdb_id → db row lookup so we can map responses back to slugs
    igdb_to_game = {g["igdb_id"]: g for g in games}

    igdb_ids = [g["igdb_id"] for g in games]

    for batch_start in range(0, len(igdb_ids), _BATCH_SIZE):
        batch = igdb_ids[batch_start : batch_start + _BATCH_SIZE]
        print(
            f"\r  [{done:>4}/{total}] fetching batch of {len(batch)} …",
            end="",
            flush=True,
            file=sys.stderr,
        )

        try:
            results = _fetch_batch(session, batch)
            time.sleep(_RATE_DELAY)
        except requests.RequestException as exc:
            print(f"\n  batch request failed: {exc}", file=sys.stderr)
            errors += len(batch)
            continue

        for raw in results:
            igdb_id = raw["id"]
            game    = igdb_to_game.get(igdb_id)
            if not game:
                continue

            shaped = _shape(raw, game["slug"], igdb_id)
            out_path = os.path.join(args.output_dir, f"{game['slug']}.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(shaped, f, ensure_ascii=False, indent=2)
            done += 1

    print(file=sys.stderr)
    print(
        f"done — {done} JSON files written, {errors} errors",
        file=sys.stderr,
    )
    print(f"output directory: {os.path.abspath(args.output_dir)}", file=sys.stderr)


if __name__ == "__main__":
    main()
