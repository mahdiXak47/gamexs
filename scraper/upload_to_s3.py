"""Upload local IGDB images to S3-compatible object storage and update the DB.

Uploads:
  scraper/output/images/covers/*.webp      → covers/ prefix in bucket
  scraper/output/images/screenshots/*.webp → screenshots/ prefix in bucket

Files already present in the bucket are skipped (safe to re-run / resume).

After upload, updates every game row in the DB:
  games.cover_url      → http://<endpoint>/<bucket>/covers/{slug}-main-cover.webp
  games.screenshot_ids → ARRAY of full object-storage URLs

Usage (from the scraper/ directory):
    # Upload + update local dev DB
    python upload_to_s3.py

    # Upload + update production DB (port-forward running on 5435)
    python upload_to_s3.py --db-url postgresql://gamexs:gamexs@localhost:5435/gamexs

    # Only upload files, skip DB update
    python upload_to_s3.py --upload-only

    # Only update DB (files already uploaded)
    python upload_to_s3.py --db-only --db-url postgresql://...

Required env vars (loaded from .env automatically):
    S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
"""

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
import psycopg
from botocore.client import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

COVERS_DIR = Path(__file__).parent / "output" / "images" / "covers"
SCREENSHOTS_DIR = Path(__file__).parent / "output" / "images" / "screenshots"
WORKERS = 8


def make_client(endpoint: str, key: str, secret: str) -> boto3.client:
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def set_bucket_public(client, bucket: str) -> None:
    policy = json.dumps({
        "Version": "2012-10-17",
        "Statement": [{
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": f"arn:aws:s3:::{bucket}/*",
        }],
    })
    try:
        client.put_bucket_policy(Bucket=bucket, Policy=policy)
        print("Bucket policy set to public-read.", file=sys.stderr)
    except ClientError as e:
        print(f"Warning: could not set bucket policy ({e}) — objects may not be public.", file=sys.stderr)


def list_existing_keys(client, bucket: str) -> set[str]:
    """Return all object keys currently in the bucket."""
    existing: set[str] = set()
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get("Contents", []):
            existing.add(obj["Key"])
    return existing


def upload_file(client, bucket: str, local_path: Path, s3_key: str) -> str:
    """Upload one file; return s3_key on success, raise on failure."""
    client.upload_file(
        str(local_path),
        bucket,
        s3_key,
        ExtraArgs={
            "ContentType": "image/webp",
            "CacheControl": "public, max-age=31536000, immutable",
        },
    )
    return s3_key


def upload_directory(
    client,
    bucket: str,
    local_dir: Path,
    prefix: str,
    existing_keys: set[str],
) -> set[str]:
    """Upload all .webp files in local_dir to bucket under prefix/.

    Returns the set of successfully uploaded (or already-present) s3 keys.
    """
    files = sorted(local_dir.glob("*.webp"))
    total = len(files)
    uploaded_keys: set[str] = set()
    skipped = 0
    failed = 0
    done = 0

    tasks = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for f in files:
            key = f"{prefix}/{f.name}"
            if key in existing_keys:
                skipped += 1
                done += 1
                uploaded_keys.add(key)
                continue
            future = pool.submit(upload_file, client, bucket, f, key)
            tasks[future] = key

        for future in as_completed(tasks):
            key = tasks[future]
            done += 1
            try:
                future.result()
                uploaded_keys.add(key)
            except Exception as exc:
                failed += 1
                print(f"\n  FAIL {key}: {exc}", file=sys.stderr)

            print(
                f"\r  [{prefix}] {done}/{total}  skipped={skipped}  failed={failed}   ",
                end="",
                file=sys.stderr,
            )

    print(file=sys.stderr)
    return uploaded_keys


def update_db(db_url: str, endpoint: str, bucket: str, uploaded_keys: set[str]) -> None:
    base = f"{endpoint.rstrip('/')}/{bucket}"

    print("Querying DB for all games …", file=sys.stderr)
    with psycopg.connect(db_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, slug FROM games ORDER BY slug")
            games = cur.fetchall()

        print(f"{len(games)} games found — computing updates …", file=sys.stderr)

        cover_updates = 0
        shot_updates = 0

        with conn.cursor() as cur:
            for game_id, slug in games:
                cover_key = f"covers/{slug}-main-cover.webp"
                cover_url = f"{base}/{cover_key}" if cover_key in uploaded_keys else None

                shot_urls = []
                n = 1
                while True:
                    key = f"screenshots/{slug}-catalog-pic-{n}.webp"
                    if key not in uploaded_keys:
                        break
                    shot_urls.append(f"{base}/{key}")
                    n += 1

                if cover_url or shot_urls:
                    cur.execute(
                        """
                        UPDATE games
                        SET cover_url      = COALESCE(%s, cover_url),
                            screenshot_ids = COALESCE(%s, screenshot_ids)
                        WHERE id = %s
                        """,
                        (
                            cover_url,
                            shot_urls if shot_urls else None,
                            game_id,
                        ),
                    )
                    if cover_url:
                        cover_updates += 1
                    if shot_urls:
                        shot_updates += 1

        conn.commit()

    print(
        f"DB updated — cover_url: {cover_updates} rows, screenshot_ids: {shot_updates} rows.",
        file=sys.stderr,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload images to S3 and update DB")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--upload-only", action="store_true", help="Skip DB update")
    parser.add_argument("--db-only", action="store_true", help="Skip upload, only update DB")
    args = parser.parse_args()

    endpoint = os.environ.get("S3_ENDPOINT_URL", "").strip()
    access_key = os.environ.get("S3_ACCESS_KEY", "").strip()
    secret_key = os.environ.get("S3_SECRET_KEY", "").strip()
    bucket = os.environ.get("S3_BUCKET", "").strip()

    if not all([endpoint, access_key, secret_key, bucket]):
        sys.exit("S3_ENDPOINT_URL, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET must be set in .env")

    client = make_client(endpoint, access_key, secret_key)

    uploaded_keys: set[str] = set()

    if not args.db_only:
        print("Setting bucket policy to public-read …", file=sys.stderr)
        set_bucket_public(client, bucket)

        print("Listing existing objects in bucket …", file=sys.stderr)
        existing = list_existing_keys(client, bucket)
        print(f"  {len(existing)} objects already in bucket.", file=sys.stderr)

        print(f"\nUploading covers ({len(list(COVERS_DIR.glob('*.webp')))} files) …", file=sys.stderr)
        cover_keys = upload_directory(client, bucket, COVERS_DIR, "covers", existing)

        print(f"Uploading screenshots ({len(list(SCREENSHOTS_DIR.glob('*.webp')))} files) …", file=sys.stderr)
        shot_keys = upload_directory(client, bucket, SCREENSHOTS_DIR, "screenshots", existing)

        uploaded_keys = cover_keys | shot_keys
        print(f"\nUpload complete — {len(uploaded_keys)} objects in bucket.", file=sys.stderr)
    else:
        print("--db-only: listing all existing keys from bucket …", file=sys.stderr)
        uploaded_keys = list_existing_keys(client, bucket)
        print(f"  {len(uploaded_keys)} objects found.", file=sys.stderr)

    if not args.upload_only:
        if not args.db_url:
            sys.exit("DATABASE_URL not set — pass --db-url or set in .env")
        update_db(args.db_url, endpoint, bucket, uploaded_keys)


if __name__ == "__main__":
    main()
