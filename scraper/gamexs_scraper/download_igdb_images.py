"""Download IGDB cover images and screenshots to local disk.

For each game that has an igdb_id in the database:
  1. Fetches the North America localized cover from IGDB (game_localizations,
     region=2). Falls back to the main cover.image_id when no NA cover exists.
  2. Downloads → output/images/covers/{slug}-main-cover.webp
  3. Fetches all screenshots from IGDB.
  4. Downloads each → output/images/screenshots/{slug}-catalog-pic-{n}.webp
  5. Updates games.cover_url to the local serving path (/api/covers/…)
     in the database so the frontend never needs to proxy IGDB.
  6. Updates games.screenshot_ids to an array of local filenames
     (e.g. ["007-first-light-catalog-pic-1.webp", …]).

Files already on disk are skipped — safe to re-run and resume.

Usage (from the scraper/ directory):
    python -m gamexs_scraper.download_igdb_images [options]

Options:
    --limit N            Process only the first N games (0 = all)
    --max-screenshots N  Screenshots to download per game (default: 10)
    --covers-only        Skip screenshot download
    --screenshots-only   Skip cover download
    --output-dir DIR     Base output dir (default: output)

Required env vars:
    DATABASE_URL
    IGDB_CLIENT_ID
    IGDB_CLIENT_SECRET
"""

import argparse
import os
import shutil
import sys
import time

import psycopg
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"
IGDB_LOCALIZATIONS_URL = "https://api.igdb.com/v4/game_localizations"

# webp for both covers and screenshots — smaller files, same IGDB CDN support.
COVER_URL_TEMPLATE = (
    "https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.webp"
)
SCREENSHOT_URL_TEMPLATE = (
    "https://images.igdb.com/igdb/image/upload/t_720p/{image_id}.webp"
)

# IGDB region IDs
REGION_NA = 2

# IGDB free tier: ≤ 4 req/s → 0.28 s gap between calls.
_RATE_DELAY = 0.28
_BATCH_SIZE = 50
_RECONNECT_DELAY = 20


# ---------------------------------------------------------------------------
# Auth
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
# IGDB API
# ---------------------------------------------------------------------------
def fetch_na_covers(
    session: requests.Session, igdb_ids: list[int]
) -> dict[int, str]:
    """Return {igdb_id: na_cover_image_id} for games that have an NA localization."""
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


def fetch_main_covers_and_screenshots(
    session: requests.Session, igdb_ids: list[int]
) -> dict[int, dict]:
    """Return {igdb_id: {cover_image_id, screenshot_ids}} for a batch of games."""
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
        shots = [
            s["image_id"]
            for s in (item.get("screenshots") or [])
            if "image_id" in s
        ]
        result[item["id"]] = {"cover_image_id": cover_id, "screenshot_ids": shots}
    return result


# ---------------------------------------------------------------------------
# File download
# ---------------------------------------------------------------------------
def download_file(url: str, dest: str, dl_session: requests.Session) -> bool:
    """Download *url* to *dest*. Returns True on success (or already cached)."""
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return True
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        resp = dl_session.get(url, timeout=30)
        resp.raise_for_status()
    except Exception as exc:
        print(f"\n  download failed ({url}): {exc}", file=sys.stderr)
        return False
    with open(dest, "wb") as f:
        f.write(resp.content)
    return True


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
def _db_connect(database_url: str) -> psycopg.Connection:
    attempt = 0
    while True:
        try:
            return psycopg.connect(database_url, connect_timeout=10)
        except psycopg.OperationalError as exc:
            attempt += 1
            print(
                f"\n  DB unavailable (attempt {attempt}): {exc}\n"
                f"  Waiting {_RECONNECT_DELAY}s …",
                file=sys.stderr,
            )
            time.sleep(_RECONNECT_DELAY)


def fetch_games(database_url: str) -> list[tuple[int, int, str, str]]:
    """Return [(id, igdb_id, slug, title)] for all games with an igdb_id."""
    with _db_connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, igdb_id, slug, title FROM games "
                "WHERE igdb_id IS NOT NULL ORDER BY title"
            )
            return cur.fetchall()


def fetch_games_missing_local(database_url: str) -> list[tuple[int, int, str, str]]:
    """Return games that still have a remote cover URL (not yet downloaded)."""
    with _db_connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, igdb_id, slug, title FROM games "
                "WHERE igdb_id IS NOT NULL "
                "AND (cover_url IS NULL OR cover_url NOT LIKE '/api/%') "
                "ORDER BY title"
            )
            return cur.fetchall()


def update_game_media(
    database_url: str,
    game_id: int,
    cover_local_path: str | None,
    screenshot_filenames: list[str],
) -> None:
    """Write local cover path and screenshot filenames back to the DB."""
    while True:
        try:
            with _db_connect(database_url) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE games SET
                            cover_url      = COALESCE(%s, cover_url),
                            screenshot_ids = %s
                        WHERE id = %s
                        """,
                        (
                            cover_local_path,
                            screenshot_filenames if screenshot_filenames else None,
                            game_id,
                        ),
                    )
                conn.commit()
            return
        except psycopg.OperationalError as exc:
            print(f"\n  write failed: {exc}; retrying …", file=sys.stderr)
            time.sleep(_RECONNECT_DELAY)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Download IGDB covers + screenshots and store local paths in DB"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Max games to process (0 = all)"
    )
    parser.add_argument(
        "--max-screenshots",
        type=int,
        default=10,
        help="Max screenshots per game (default: 10)",
    )
    parser.add_argument("--covers-only", action="store_true", help="Skip screenshots")
    parser.add_argument("--screenshots-only", action="store_true", help="Skip covers")
    parser.add_argument(
        "--output-dir", default="output", help="Base output dir (default: output)"
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Only process games that don't yet have a local cover URL",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")

    if not database_url:
        sys.exit("DATABASE_URL not set — check .env")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in .env")

    covers_dir = os.path.join(args.output_dir, "images", "covers")
    screenshots_dir = os.path.join(args.output_dir, "images", "screenshots")
    os.makedirs(covers_dir, exist_ok=True)
    os.makedirs(screenshots_dir, exist_ok=True)

    print("obtaining IGDB access token …", file=sys.stderr)
    token = get_access_token(client_id, client_secret)

    igdb_session = requests.Session()
    igdb_session.headers.update(
        {
            "Client-ID": client_id,
            "Authorization": f"Bearer {token}",
            "Content-Type": "text/plain",
        }
    )
    dl_session = requests.Session()
    dl_session.headers.update({"User-Agent": "GameXS/1.0"})

    all_games = (
        fetch_games_missing_local(database_url)
        if args.missing_only
        else fetch_games(database_url)
    )
    if args.limit:
        all_games = all_games[: args.limit]

    total = len(all_games)
    unique_igdb_ids = len({igdb_id for _, igdb_id, _, _ in all_games})
    print(f"{total} game rows ({unique_igdb_ids} unique IGDB IDs) to process", file=sys.stderr)

    # Map igdb_id → list of (game_id, slug) — one igdb_id can appear in multiple rows.
    igdb_to_rows: dict[int, list[tuple[int, str]]] = {}
    for game_id, igdb_id, slug, _ in all_games:
        igdb_to_rows.setdefault(igdb_id, []).append((game_id, slug))

    igdb_ids = list(igdb_to_rows.keys())
    batches = [igdb_ids[i : i + _BATCH_SIZE] for i in range(0, len(igdb_ids), _BATCH_SIZE)]

    covers_ok = covers_skip = covers_fail = 0
    shots_ok = shots_fail = 0
    processed = 0

    for batch_num, batch in enumerate(batches, start=1):
        print(
            f"\r[batch {batch_num}/{len(batches)}] querying IGDB …",
            end="",
            file=sys.stderr,
        )

        # Fetch NA localized covers and main covers + screenshots in parallel calls.
        try:
            na_covers = fetch_na_covers(igdb_session, batch)
            time.sleep(_RATE_DELAY)
            main_data = fetch_main_covers_and_screenshots(igdb_session, batch)
            time.sleep(_RATE_DELAY)
        except requests.RequestException as exc:
            print(f"\n  batch {batch_num} request error: {exc}", file=sys.stderr)
            continue

        for igdb_id in batch:
            rows = igdb_to_rows[igdb_id]
            processed += len(rows)
            info = main_data.get(igdb_id, {})

            # Prefer NA localized cover; fall back to main cover.image_id.
            cover_image_id = na_covers.get(igdb_id) or info.get("cover_image_id")
            shot_image_ids = (info.get("screenshot_ids") or [])[: args.max_screenshots]

            # Download once for the first slug; copy for duplicates.
            primary_slug = rows[0][1]

            primary_cover_dest: str | None = None
            primary_cover_path: str | None = None

            if cover_image_id and not args.screenshots_only:
                filename = f"{primary_slug}-main-cover.webp"
                dest = os.path.join(covers_dir, filename)
                url = COVER_URL_TEMPLATE.format(image_id=cover_image_id)
                if download_file(url, dest, dl_session):
                    primary_cover_dest = dest
                    primary_cover_path = f"/api/covers/{filename}"
                    covers_ok += 1
                else:
                    covers_fail += 1
            else:
                covers_skip += 1

            primary_shot_filenames: list[str] = []
            primary_shot_dests: list[str] = []

            if not args.covers_only:
                for n, sid in enumerate(shot_image_ids, start=1):
                    filename = f"{primary_slug}-catalog-pic-{n}.webp"
                    dest = os.path.join(screenshots_dir, filename)
                    url = SCREENSHOT_URL_TEMPLATE.format(image_id=sid)
                    if download_file(url, dest, dl_session):
                        primary_shot_filenames.append(filename)
                        primary_shot_dests.append(dest)
                        shots_ok += 1
                    else:
                        shots_fail += 1

            # Update DB for every row sharing this igdb_id, copying files for extras.
            for idx, (game_id, slug) in enumerate(rows):
                if idx == 0:
                    cover_path = primary_cover_path
                    shot_filenames = primary_shot_filenames
                else:
                    # Copy cover file for this slug.
                    cover_path = None
                    if primary_cover_dest and not args.screenshots_only:
                        dup_cover = os.path.join(covers_dir, f"{slug}-main-cover.webp")
                        if not (os.path.exists(dup_cover) and os.path.getsize(dup_cover) > 0):
                            shutil.copy2(primary_cover_dest, dup_cover)
                        cover_path = f"/api/covers/{slug}-main-cover.webp"

                    # Copy screenshot files for this slug.
                    shot_filenames = []
                    if not args.covers_only:
                        for n, src in enumerate(primary_shot_dests, start=1):
                            dup_shot = os.path.join(screenshots_dir, f"{slug}-catalog-pic-{n}.webp")
                            if not (os.path.exists(dup_shot) and os.path.getsize(dup_shot) > 0):
                                shutil.copy2(src, dup_shot)
                            shot_filenames.append(f"{slug}-catalog-pic-{n}.webp")

                update_game_media(database_url, game_id, cover_path, shot_filenames)

            print(
                f"\r[{processed}/{total}]  "
                f"covers: {covers_ok} ok / {covers_fail} fail  "
                f"screenshots: {shots_ok} ok / {shots_fail} fail   ",
                end="",
                file=sys.stderr,
            )

    print(file=sys.stderr)
    print(
        f"\nDone.\n"
        f"  Covers:      {covers_ok} downloaded, {covers_skip} skipped, {covers_fail} failed\n"
        f"  Screenshots: {shots_ok} downloaded, {shots_fail} failed",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
