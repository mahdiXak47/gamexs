"""Sync games.cover_url and games.screenshot_ids to local /api/ paths.

Scans scraper/output/images/covers/ and scraper/output/images/screenshots/
for files created by download_igdb_images.py, then updates every matching
DB row so cover_url and screenshot_ids point to the local serving paths
instead of the remote IGDB CDN URLs.

Safe to run repeatedly — uses COALESCE so it only overwrites when a local
file actually exists.

Usage (from the scraper/ directory):
    .venv/bin/python -m gamexs_scraper.update_local_paths [--output-dir DIR]
"""

import argparse
import os
import re
import sys

import psycopg
from dotenv import load_dotenv


def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Sync local image paths to DB")
    parser.add_argument("--output-dir", default="output", help="Base output dir (default: output)")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL not set — check .env")

    covers_dir = os.path.join(args.output_dir, "images", "covers")
    screenshots_dir = os.path.join(args.output_dir, "images", "screenshots")

    # --- Build slug → cover filename map ---
    cover_map: dict[str, str] = {}
    for fname in os.listdir(covers_dir):
        if fname.endswith("-main-cover.webp"):
            slug = fname[: -len("-main-cover.webp")]
            cover_map[slug] = fname

    # --- Build slug → sorted screenshot filename list ---
    shot_pattern = re.compile(r"^(.+)-catalog-pic-(\d+)\.webp$")
    shot_map: dict[str, list[tuple[int, str]]] = {}
    for fname in os.listdir(screenshots_dir):
        m = shot_pattern.match(fname)
        if m:
            slug, n = m.group(1), int(m.group(2))
            shot_map.setdefault(slug, []).append((n, fname))

    sorted_shots: dict[str, list[str]] = {
        slug: [f for _, f in sorted(pairs)]
        for slug, pairs in shot_map.items()
    }

    all_slugs = sorted(set(cover_map) | set(sorted_shots))
    print(
        f"covers on disk:      {len(cover_map)}\n"
        f"screenshot sets:     {len(sorted_shots)}\n"
        f"unique slugs total:  {len(all_slugs)}\n",
        file=sys.stderr,
    )

    updated = skipped = 0

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for slug in all_slugs:
                cover_path: str | None = None
                if slug in cover_map:
                    cover_path = f"/api/covers/{cover_map[slug]}"

                shot_filenames: list[str] | None = sorted_shots.get(slug) or None

                cur.execute(
                    """
                    UPDATE games
                    SET
                        cover_url      = COALESCE(%s, cover_url),
                        screenshot_ids = COALESCE(%s, screenshot_ids)
                    WHERE slug = %s
                    """,
                    (cover_path, shot_filenames, slug),
                )

                if cur.rowcount:
                    updated += 1
                else:
                    skipped += 1

        conn.commit()

    print(
        f"Done.\n"
        f"  {updated} DB rows updated\n"
        f"  {skipped} slugs had no matching DB row (likely deleted games or extra files)",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
