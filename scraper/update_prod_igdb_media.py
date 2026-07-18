"""Update production DB cover_url and screenshot_ids with IGDB image IDs.

This script is meant to run locally against the port-forwarded production
DB (kubectl port-forward ... 5435:5432) when images cannot be downloaded
to the k8s pod.

Instead of downloading files:
  - cover_url  → set to https://images.igdb.com/... (cover-proxy serves it in prod)
  - screenshot_ids → set to raw IGDB image IDs (no extension); games-repo.ts
    detects these and routes them through /api/cover-proxy at runtime.

Usage (from the scraper/ directory):
    python update_prod_igdb_media.py --db-url postgresql://gamexs:gamexs@localhost:5435/gamexs

Or set DATABASE_URL env var (loads from .env by default).
"""

import argparse
import os
import sys
import time

import psycopg
import requests
from dotenv import load_dotenv

TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"
IGDB_LOCALIZATIONS_URL = "https://api.igdb.com/v4/game_localizations"

COVER_URL_TEMPLATE = "https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg"

REGION_NA = 2
_RATE_DELAY = 0.28
_BATCH_SIZE = 50
_MAX_SCREENSHOTS = 10


def get_access_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(
        TWITCH_TOKEN_URL,
        data={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_na_covers(session: requests.Session, igdb_ids: list[int]) -> dict[int, str]:
    ids_str = ", ".join(str(i) for i in igdb_ids)
    query = (
        f"fields game, cover.image_id, region; "
        f"where game = ({ids_str}) & region = {REGION_NA}; "
        f"limit {len(igdb_ids)};"
    )
    resp = session.post(IGDB_LOCALIZATIONS_URL, data=query, timeout=15)
    resp.raise_for_status()
    result: dict[int, str] = {}
    for item in resp.json():
        game_id = item.get("game")
        image_id = (item.get("cover") or {}).get("image_id")
        if game_id and image_id:
            result[game_id] = image_id
    return result


def fetch_main_covers_and_screenshots(session: requests.Session, igdb_ids: list[int]) -> dict[int, dict]:
    ids_str = ", ".join(str(i) for i in igdb_ids)
    query = (
        f"fields id, cover.image_id, screenshots.image_id; "
        f"where id = ({ids_str}); "
        f"limit {len(igdb_ids)};"
    )
    resp = session.post(IGDB_GAMES_URL, data=query, timeout=15)
    resp.raise_for_status()
    result: dict[int, dict] = {}
    for item in resp.json():
        cover_id = (item.get("cover") or {}).get("image_id")
        shots = [s["image_id"] for s in (item.get("screenshots") or []) if "image_id" in s]
        result[item["id"]] = {"cover_image_id": cover_id, "screenshot_ids": shots}
    return result


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Update prod DB cover_url and screenshot_ids from IGDB")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"), help="Postgres connection URL")
    parser.add_argument("--limit", type=int, default=0, help="Max games to process (0 = all)")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without writing")
    args = parser.parse_args()

    db_url = args.db_url
    if not db_url:
        sys.exit("DATABASE_URL not set — pass --db-url or set in .env")

    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in .env")

    print("Fetching games from DB …", file=sys.stderr)
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, igdb_id, slug, title FROM games WHERE igdb_id IS NOT NULL ORDER BY title"
            )
            all_games = cur.fetchall()

    if args.limit:
        all_games = all_games[: args.limit]

    total = len(all_games)
    print(f"{total} games with igdb_id found", file=sys.stderr)

    print("Obtaining IGDB access token …", file=sys.stderr)
    token = get_access_token(client_id, client_secret)

    session = requests.Session()
    session.headers.update({
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    })

    # Build igdb_id → list of (game_id, slug) mapping
    igdb_to_rows: dict[int, list[tuple[int, str]]] = {}
    for game_id, igdb_id, slug, _ in all_games:
        igdb_to_rows.setdefault(igdb_id, []).append((game_id, slug))

    igdb_ids = list(igdb_to_rows.keys())
    batches = [igdb_ids[i: i + _BATCH_SIZE] for i in range(0, len(igdb_ids), _BATCH_SIZE)]

    updates: list[tuple[str | None, list[str], int]] = []  # (cover_url, screenshot_ids, game_id)

    for batch_num, batch in enumerate(batches, start=1):
        print(f"\r[batch {batch_num}/{len(batches)}] querying IGDB …", end="", file=sys.stderr)
        try:
            na_covers = fetch_na_covers(session, batch)
            time.sleep(_RATE_DELAY)
            main_data = fetch_main_covers_and_screenshots(session, batch)
            time.sleep(_RATE_DELAY)
        except requests.RequestException as exc:
            print(f"\n  batch {batch_num} error: {exc}", file=sys.stderr)
            continue

        for igdb_id in batch:
            rows = igdb_to_rows[igdb_id]
            info = main_data.get(igdb_id, {})

            cover_image_id = na_covers.get(igdb_id) or info.get("cover_image_id")
            shot_ids = (info.get("screenshot_ids") or [])[:_MAX_SCREENSHOTS]

            cover_url = COVER_URL_TEMPLATE.format(image_id=cover_image_id) if cover_image_id else None

            for game_id, slug in rows:
                updates.append((cover_url, shot_ids, game_id))
                if args.dry_run:
                    print(f"  [{slug}] cover={cover_image_id or '—'}  screenshots={len(shot_ids)}")

    print(f"\n{len(updates)} rows to update", file=sys.stderr)

    if args.dry_run:
        print("Dry run — no changes written.")
        return

    print("Writing to DB …", file=sys.stderr)
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            for cover_url, shot_ids, game_id in updates:
                cur.execute(
                    """
                    UPDATE games
                    SET cover_url = COALESCE(%s, cover_url),
                        screenshot_ids = %s
                    WHERE id = %s
                    """,
                    (cover_url, shot_ids if shot_ids else None, game_id),
                )
        conn.commit()

    print(f"Done — updated {len(updates)} game rows.", file=sys.stderr)


if __name__ == "__main__":
    main()
