"""Download IGDB key art (artworks) and upload to S3, then update DB.

For each game with an igdb_id, fetches the first IGDB artwork image,
downloads it at t_screenshot_huge resolution (1280×720, WebP), uploads to
S3 under the artworks/ prefix, and writes the object-storage URL into
games.key_art_url.

Files already in S3 are skipped — safe to re-run and resume.

Usage (from the scraper/ directory):
    # Full run against local dev DB
    python download_artworks.py

    # Against production DB (port-forward on 5435)
    python download_artworks.py --db-url postgresql://gamexs:gamexs@localhost:5435/gamexs

    # Only games that don't yet have key_art_url
    python download_artworks.py --missing-only --db-url ...

Required env vars (loaded from ../.env automatically):
    IGDB_CLIENT_ID, IGDB_CLIENT_SECRET
    S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
    DATABASE_URL  (overridden by --db-url)
"""

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
import psycopg
import requests
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

TWITCH_TOKEN_URL  = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL    = "https://api.igdb.com/v4/games"
ARTWORK_TEMPLATE  = "https://images.igdb.com/igdb/image/upload/t_screenshot_huge/{image_id}.webp"
ARTWORKS_DIR      = Path(__file__).parent / "output" / "images" / "artworks"
_RATE_DELAY       = 0.28
_BATCH_SIZE       = 50
WORKERS           = 8


# ---------------------------------------------------------------------------
# Auth & IGDB
# ---------------------------------------------------------------------------
def get_access_token(client_id: str, client_secret: str) -> str:
    resp = requests.post(TWITCH_TOKEN_URL, data={
        "client_id": client_id, "client_secret": client_secret,
        "grant_type": "client_credentials",
    }, timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_artworks(session: requests.Session, igdb_ids: list[int]) -> dict[int, list[str]]:
    """Return {igdb_id: [image_id, ...]} for each game."""
    ids_str = ", ".join(str(i) for i in igdb_ids)
    resp = session.post(IGDB_GAMES_URL,
        data=f"fields id, artworks.image_id; where id = ({ids_str}); limit {len(igdb_ids)};",
        timeout=15)
    resp.raise_for_status()
    result: dict[int, list[str]] = {}
    for item in resp.json():
        ids = [a["image_id"] for a in (item.get("artworks") or []) if "image_id" in a]
        if ids:
            result[item["id"]] = ids
    return result


# ---------------------------------------------------------------------------
# S3
# ---------------------------------------------------------------------------
def make_s3(endpoint: str, access: str, secret: str):
    return boto3.client("s3", endpoint_url=endpoint,
        aws_access_key_id=access, aws_secret_access_key=secret,
        config=Config(signature_version="s3v4"), region_name="us-east-1")


def list_existing_keys(s3, bucket: str) -> set[str]:
    existing: set[str] = set()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix="artworks/"):
        for obj in page.get("Contents", []):
            existing.add(obj["Key"])
    return existing


def upload_file(s3, bucket: str, local: Path, key: str) -> str:
    s3.upload_file(str(local), bucket, key, ExtraArgs={
        "ContentType": "image/webp",
        "CacheControl": "public, max-age=31536000, immutable",
    })
    return key


# ---------------------------------------------------------------------------
# Download helper
# ---------------------------------------------------------------------------
def download(url: str, dest: Path, dl_session: requests.Session) -> bool:
    if dest.exists() and dest.stat().st_size > 0:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = dl_session.get(url, timeout=30)
        r.raise_for_status()
        dest.write_bytes(r.content)
        return True
    except Exception as exc:
        print(f"\n  download failed ({url}): {exc}", file=sys.stderr)
        return False


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------
def fetch_games(db_url: str, missing_only: bool) -> list[tuple[int, int, str]]:
    """Return [(id, igdb_id, slug)] for games with igdb_id."""
    sql = ("SELECT id, igdb_id, slug FROM games WHERE igdb_id IS NOT NULL"
           + (" AND key_art_url IS NULL" if missing_only else "")
           + " ORDER BY slug")
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
            return cur.fetchall()


def update_key_art(db_url: str, updates: list[tuple[str, int]]) -> None:
    """Bulk-update key_art_url. updates = [(url, game_id), ...]"""
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.executemany("UPDATE games SET key_art_url = %s WHERE id = %s", updates)
        conn.commit()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description="Download IGDB artworks → S3 → DB")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--missing-only", action="store_true",
                        help="Only process games without key_art_url")
    args = parser.parse_args()

    if not args.db_url:
        sys.exit("DATABASE_URL not set — pass --db-url or set in .env")

    client_id     = os.environ.get("IGDB_CLIENT_ID", "").strip()
    client_secret = os.environ.get("IGDB_CLIENT_SECRET", "").strip()
    endpoint      = os.environ.get("S3_ENDPOINT_URL", "").strip()
    access        = os.environ.get("S3_ACCESS_KEY", "").strip()
    secret        = os.environ.get("S3_SECRET_KEY", "").strip()
    bucket        = os.environ.get("S3_BUCKET", "").strip()

    if not all([client_id, client_secret, endpoint, access, secret, bucket]):
        sys.exit("Missing required env vars — check ../.env")

    base_url = f"{endpoint.rstrip('/')}/{bucket}"
    s3 = make_s3(endpoint, access, secret)

    print("Fetching games from DB …", file=sys.stderr)
    games = fetch_games(args.db_url, args.missing_only)
    total = len(games)
    print(f"  {total} games to process", file=sys.stderr)

    print("Listing existing artworks in S3 …", file=sys.stderr)
    existing_keys = list_existing_keys(s3, bucket)
    print(f"  {len(existing_keys)} artworks already in bucket", file=sys.stderr)

    print("Obtaining IGDB access token …", file=sys.stderr)
    token = get_access_token(client_id, client_secret)
    igdb = requests.Session()
    igdb.headers.update({"Client-ID": client_id, "Authorization": f"Bearer {token}", "Content-Type": "text/plain"})
    dl = requests.Session()
    dl.headers.update({"User-Agent": "GameXS/1.0"})

    # Build igdb_id → list of (game_id, slug)
    igdb_to_rows: dict[int, list[tuple[int, str]]] = {}
    for game_id, igdb_id, slug in games:
        igdb_to_rows.setdefault(igdb_id, []).append((game_id, slug))

    igdb_ids = list(igdb_to_rows.keys())
    batches  = [igdb_ids[i:i + _BATCH_SIZE] for i in range(0, len(igdb_ids), _BATCH_SIZE)]

    # Collect (local_path, s3_key, game_id, slug) for parallel upload
    to_upload: list[tuple[Path, str, int, str]] = []
    db_updates: list[tuple[str, int]] = []   # (url, game_id) for already-in-S3 rows

    processed = 0
    for batch_num, batch in enumerate(batches, 1):
        print(f"\r[{processed}/{total}] fetching IGDB batch {batch_num}/{len(batches)} …",
              end="", file=sys.stderr)
        try:
            artworks = fetch_artworks(igdb, batch)
            time.sleep(_RATE_DELAY)
        except requests.RequestException as exc:
            print(f"\n  batch {batch_num} error: {exc}", file=sys.stderr)
            continue

        for igdb_id in batch:
            rows       = igdb_to_rows[igdb_id]
            image_ids  = artworks.get(igdb_id, [])
            if not image_ids:
                processed += len(rows)
                continue
            first_id = image_ids[0]

            for game_id, slug in rows:
                s3_key   = f"artworks/{slug}-key-art.webp"
                local    = ARTWORKS_DIR / f"{slug}-key-art.webp"
                full_url = f"{base_url}/{s3_key}"

                if s3_key in existing_keys:
                    db_updates.append((full_url, game_id))
                else:
                    img_url = ARTWORK_TEMPLATE.format(image_id=first_id)
                    if download(img_url, local, dl):
                        to_upload.append((local, s3_key, game_id, slug))
                    # else: skip silently, will retry next run

                processed += 1

    print(f"\r[{processed}/{total}] IGDB fetch complete.         ", file=sys.stderr)

    # Upload in parallel
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(upload_file, s3, bucket, local, key): (game_id, slug, key)
                   for local, key, game_id, slug in to_upload}
        done = 0
        for future in as_completed(futures):
            game_id, slug, key = futures[future]
            done += 1
            try:
                future.result()
                db_updates.append((f"{base_url}/{key}", game_id))
                ok += 1
            except Exception as exc:
                fail += 1
                print(f"\n  upload failed [{slug}]: {exc}", file=sys.stderr)
            print(f"\r  uploading {done}/{len(to_upload)}  ok={ok}  fail={fail}   ",
                  end="", file=sys.stderr)

    print(file=sys.stderr)
    print(f"\nUpload done — {ok} uploaded, {fail} failed.", file=sys.stderr)

    if db_updates:
        print(f"Updating DB ({len(db_updates)} rows) …", file=sys.stderr)
        update_key_art(args.db_url, db_updates)
        print("DB updated.", file=sys.stderr)
    else:
        print("No DB updates needed.", file=sys.stderr)


if __name__ == "__main__":
    main()
