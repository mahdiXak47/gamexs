#!/usr/bin/env python3
"""Self-host one official trailer per game on our S3 (migration 037).

For games with a PlayStation Store concept_id this takes the first PREVIEW
video on the concept page (the store's featured trailer, a plain MP4 on
vulcan.dl.playstation.net), transcodes it to a web-friendly 720p H.264/AAC MP4
with the moov atom up front (+faststart, so playback starts before the whole
file downloads), uploads it to trailers/<slug>-<hash>.mp4 and records it.

Sources are 60–140 MB at full resolution; the 720p copy is ~15–30 MB. The key
includes a hash of the source URL so objects stay immutable and a new store
trailer gets a new URL. Unchanged trailers are skipped, and --limit spreads
the backlog over daily runs instead of hogging bandwidth in one go.

    python fetch_trailers.py --limit 25            # daily pipeline step
    python fetch_trailers.py --slug ea-sports-fc-27 --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import psycopg
import requests

from fetch_psstore_prices import HEADERS, PS_STORE_BASE
from gamexs_scraper.pipeline import report_progress
from upload_to_s3 import make_client

_VIDEO_RE = re.compile(r'\{[^{}]*"type":"VIDEO"[^{}]*\}')
MAX_SOURCE_BYTES = 400 * 1024 * 1024  # refuse anything absurdly large


def featured_trailer_url(concept_html: str) -> str | None:
    """First PREVIEW video on a PS Store concept page, in page order."""
    for match in _VIDEO_RE.finditer(concept_html):
        try:
            media = json.loads(match.group(0))
        except json.JSONDecodeError:
            continue
        url = media.get("url") or ""
        if media.get("role") == "PREVIEW" and url.startswith("https://") and url.endswith(".mp4"):
            return url
    return None


def trailer_key(slug: str, source_url: str) -> str:
    return f"trailers/{slug}-{hashlib.sha256(source_url.encode()).hexdigest()[:10]}.mp4"


def _get(url: str, **kwargs) -> requests.Response:
    """Sony's CDN is reachable directly from Iran; fall back to the env proxy."""
    direct = requests.Session()
    direct.trust_env = False
    try:
        return direct.get(url, headers=HEADERS, timeout=60, **kwargs)
    except requests.exceptions.RequestException:
        return requests.get(url, headers=HEADERS, timeout=60, **kwargs)


def download(url: str, dest: Path) -> None:
    with _get(url, stream=True) as response:
        response.raise_for_status()
        size = 0
        with dest.open("wb") as out:
            for chunk in response.iter_content(1 << 20):
                size += len(chunk)
                if size > MAX_SOURCE_BYTES:
                    raise ValueError(f"source larger than {MAX_SOURCE_BYTES >> 20} MB")
                out.write(chunk)


def transcode(src: Path, dest: Path) -> None:
    """720p (never upscaled), H.264 main, CRF 27 capped at ~2.5 Mb/s, AAC 128k, faststart."""
    subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
            "-vf", "scale=-2:'min(720,ih)'",
            "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p",
            "-crf", "27", "-maxrate", "2500k", "-bufsize", "5000k",
            "-c:a", "aac", "-b:a", "128k", "-ac", "2",
            "-movflags", "+faststart", str(dest),
        ],
        check=True,
        timeout=900,
    )


def candidates(conn: psycopg.Connection, slug: str | None, limit: int) -> list[tuple[int, str, str, str | None]]:
    # Games without a trailer first, then the longest-unchecked ones.
    rows = conn.execute(
        """
        SELECT id, slug, concept_id, trailer_source_url
        FROM ps5_games
        WHERE concept_id IS NOT NULL AND (%s::text IS NULL OR slug = %s)
        ORDER BY trailer_url IS NOT NULL, trailer_updated_at NULLS FIRST, id
        LIMIT %s
        """,
        (slug, slug, limit),
    ).fetchall()
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=25, help="games to check this run")
    parser.add_argument("--slug", help="only this game")
    parser.add_argument("--dry-run", action="store_true", help="find trailers, do not download or upload")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    endpoint = os.environ.get("S3_ENDPOINT_URL", "").rstrip("/")
    bucket = os.environ.get("S3_BUCKET", "")
    if not db_url or (not args.dry_run and not all([endpoint, bucket, os.environ.get("S3_ACCESS_KEY"), os.environ.get("S3_SECRET_KEY")])):
        sys.exit("DATABASE_URL and S3_ENDPOINT_URL / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY are required")

    s3 = None if args.dry_run else make_client(endpoint, os.environ["S3_ACCESS_KEY"], os.environ["S3_SECRET_KEY"])
    uploaded = unchanged = missing = failed = 0
    with psycopg.connect(db_url, autocommit=True) as conn:
        games = candidates(conn, args.slug, args.limit)
        for i, (game_id, slug, concept_id, known_source) in enumerate(games, start=1):
            report_progress(i - 1, len(games), f"trailer for {slug}")
            try:
                page = _get(f"{PS_STORE_BASE}/en-us/concept/{concept_id}")
                page.raise_for_status()
                source = featured_trailer_url(page.text)
                if not source:
                    missing += 1
                    conn.execute("UPDATE ps5_games SET trailer_updated_at = now() WHERE id = %s", (game_id,))
                    continue
                if source == known_source:
                    unchanged += 1
                    conn.execute("UPDATE ps5_games SET trailer_updated_at = now() WHERE id = %s", (game_id,))
                    continue
                if args.dry_run:
                    print(f"[dry-run] {slug}: {source}", flush=True)
                    continue
                key = trailer_key(slug, source)
                with tempfile.TemporaryDirectory() as tmp:
                    raw, web = Path(tmp) / "source.mp4", Path(tmp) / "web.mp4"
                    download(source, raw)
                    transcode(raw, web)
                    s3.upload_file(
                        str(web), bucket, key,
                        ExtraArgs={"ContentType": "video/mp4", "CacheControl": "public, max-age=31536000, immutable"},
                    )
                    size_mb = web.stat().st_size / 1e6
                conn.execute(
                    "UPDATE ps5_games SET trailer_url = %s, trailer_source_url = %s, trailer_updated_at = now() WHERE id = %s",
                    (f"{endpoint}/{bucket}/{key}", source, game_id),
                )
                uploaded += 1
                print(f"{slug}: uploaded {key} ({size_mb:.1f} MB)", flush=True)
            except Exception as exc:  # one bad trailer must not stop the batch
                failed += 1
                print(f"{slug}: failed: {exc}", file=sys.stderr, flush=True)
    report_progress(len(games), len(games), f"{uploaded} uploaded, {unchanged} unchanged, {missing} without trailer, {failed} failed", force=True)
    print(f"trailers: {uploaded} uploaded, {unchanged} unchanged, {missing} without trailer, {failed} failed", flush=True)
    return 1 if failed and not (uploaded or unchanged or missing) else 0


if __name__ == "__main__":
    sys.exit(main())
