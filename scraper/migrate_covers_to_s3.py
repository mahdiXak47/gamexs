"""One-shot migration: download IGDB cover URLs already stored in the DB,
upload to S3, and update cover_url to the S3 address.

No IGDB API credentials needed — it reads the URL straight from cover_url.

Usage (from the scraper/ directory):
    python migrate_covers_to_s3.py                   # local DB + S3
    python migrate_covers_to_s3.py --db-url postgresql://gamexs:gamexs@localhost:5436/gamexs  # prod

Env vars (loaded from ../.env automatically):
    DATABASE_URL, S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
    HTTPS_PROXY   (optional) — used when IGDB CDN is blocked locally
"""

import argparse
import io
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

COVERS_DIR = Path(__file__).parent / "output" / "images" / "covers"
WORKERS = 6
RATE_DELAY = 0.1  # seconds between downloads


# ── S3 ────────────────────────────────────────────────────────────────────────

def make_s3(endpoint: str, key: str, secret: str):
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def existing_keys(s3, bucket: str) -> set[str]:
    keys: set[str] = set()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix="covers/"):
        for obj in page.get("Contents", []):
            keys.add(obj["Key"])
    return keys


def upload_bytes(s3, bucket: str, key: str, data: bytes) -> None:
    s3.upload_fileobj(
        io.BytesIO(data),
        bucket,
        key,
        ExtraArgs={
            "ContentType": "image/webp",
            "CacheControl": "public, max-age=31536000, immutable",
        },
    )


# ── Download ──────────────────────────────────────────────────────────────────

def build_session() -> requests.Session:
    session = requests.Session()
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if proxy:
        session.proxies = {"http": proxy, "https": proxy}
        print(f"Using proxy: {proxy}", file=sys.stderr)
    session.headers["User-Agent"] = "GameXS-migrator/1.0"
    return session


def download(session: requests.Session, url: str) -> bytes | None:
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        return r.content
    except Exception as exc:
        print(f"\n  FAIL download {url}: {exc}", file=sys.stderr)
        return None


# ── DB ────────────────────────────────────────────────────────────────────────

def fetch_igdb_games(db_url: str) -> list[tuple[int, str, str]]:
    """Return [(id, slug, cover_url)] for games still on IGDB CDN."""
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, slug, cover_url FROM games "
                "WHERE cover_url LIKE '%images.igdb.com%' "
                "ORDER BY slug"
            )
            return cur.fetchall()


def update_cover_url(db_url: str, game_id: int, s3_url: str) -> None:
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE games SET cover_url = %s WHERE id = %s",
                (s3_url, game_id),
            )
        conn.commit()


def bulk_update_cover_urls(db_url: str, updates: list[tuple[str, int]]) -> None:
    """updates = [(s3_url, game_id), ...]"""
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "UPDATE games SET cover_url = %s WHERE id = %s", updates
            )
        conn.commit()


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate IGDB covers → S3")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--limit", type=int, default=0, help="Process only N games (0=all)")
    parser.add_argument("--upload-only", action="store_true", help="Skip download, upload from disk")
    parser.add_argument("--db-only", action="store_true", help="Skip upload, only update DB from bucket")
    args = parser.parse_args()

    db_url = args.db_url
    endpoint = os.environ.get("S3_ENDPOINT_URL", "").rstrip("/")
    access_key = os.environ.get("S3_ACCESS_KEY", "")
    secret_key = os.environ.get("S3_SECRET_KEY", "")
    bucket = os.environ.get("S3_BUCKET", "")

    if not db_url:
        sys.exit("DATABASE_URL not set")
    if not all([endpoint, access_key, secret_key, bucket]):
        sys.exit("S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET must be set in .env")

    s3 = make_s3(endpoint, access_key, secret_key)
    base_url = f"{endpoint}/{bucket}"

    print("Fetching games with IGDB cover URLs from DB …", file=sys.stderr)
    games = fetch_igdb_games(db_url)
    if args.limit:
        games = games[: args.limit]
    total = len(games)
    print(f"  {total} games to migrate.", file=sys.stderr)

    if not total:
        print("Nothing to do — all covers are already on S3.", file=sys.stderr)
        return

    # ── Step 1: list what's already in S3 ──────────────────────────────────
    print("Listing existing objects in S3 bucket …", file=sys.stderr)
    already_in_s3 = existing_keys(s3, bucket)
    print(f"  {len(already_in_s3)} cover objects already in bucket.", file=sys.stderr)

    COVERS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Step 2: download + upload ──────────────────────────────────────────
    db_updates: list[tuple[str, int]] = []
    ok = skip = fail = 0

    if args.db_only:
        # Just wire up DB from whatever is already in S3
        for game_id, slug, _ in games:
            key = f"covers/{slug}-main-cover.webp"
            if key in already_in_s3:
                db_updates.append((f"{base_url}/{key}", game_id))
                ok += 1
            else:
                fail += 1
    else:
        session = build_session()

        def process(game: tuple[int, str, str]) -> tuple[int, str, str | None]:
            game_id, slug, igdb_url = game
            s3_key = f"covers/{slug}-main-cover.webp"
            s3_url = f"{base_url}/{s3_key}"

            # Already in S3 — skip download
            if s3_key in already_in_s3:
                return game_id, slug, s3_url

            if not args.upload_only:
                # Try local disk cache first
                local = COVERS_DIR / f"{slug}-main-cover.webp"
                if local.exists() and local.stat().st_size > 0:
                    data = local.read_bytes()
                else:
                    data = download(session, igdb_url)
                    if data:
                        local.write_bytes(data)
            else:
                local = COVERS_DIR / f"{slug}-main-cover.webp"
                data = local.read_bytes() if (local.exists() and local.stat().st_size > 0) else None

            if not data:
                return game_id, slug, None

            try:
                upload_bytes(s3, bucket, s3_key, data)
                return game_id, slug, s3_url
            except Exception as exc:
                print(f"\n  FAIL upload {s3_key}: {exc}", file=sys.stderr)
                return game_id, slug, None

        done = 0
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(process, g): g for g in games}
            for future in as_completed(futures):
                game_id, slug, s3_url = future.result()
                done += 1
                if s3_url:
                    if s3_url in [u for u, _ in db_updates]:
                        skip += 1
                    else:
                        ok += 1
                    db_updates.append((s3_url, game_id))
                else:
                    fail += 1
                print(
                    f"\r  [{done}/{total}] uploaded={ok} skipped={skip} failed={fail}   ",
                    end="",
                    file=sys.stderr,
                )
                time.sleep(RATE_DELAY / WORKERS)

        print(file=sys.stderr)

    # ── Step 3: bulk update DB ─────────────────────────────────────────────
    if db_updates:
        print(f"Updating {len(db_updates)} rows in DB …", file=sys.stderr)
        bulk_update_cover_urls(db_url, db_updates)
        print("Done.", file=sys.stderr)
    else:
        print("No successful uploads — DB not updated.", file=sys.stderr)

    print(
        f"\nSummary: {ok} uploaded, {skip} already in S3, {fail} failed  "
        f"({len(db_updates)} DB rows updated)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
