"""Migration 003: apply title-case normalization to all games.

What this migration does
------------------------
1. Translates Persian edition words in titles/slugs to English equivalents
   (کالکتور -> Collector, دلوکس -> Deluxe, لگسی -> Legacy, etc.)
2. Strips Persian noise like "نسخه" and "کارکرده" that survived earlier imports.
3. Applies consistent Title Case across all seller variants.
4. Regenerates slugs from the cleaned titles.
5. Merges game rows that normalize to the same (platform_id, slug):
   - Listings from the duplicate are reassigned to the primary (lower game id).
   - The duplicate row is deleted.

Usage
-----
    cd scraper
    .venv/bin/python ../db/migrations/003_normalize_titles.py [--dry-run]

Options
-------
    --dry-run   Print what would change without touching the database.

The migration is idempotent: re-running it after a successful run is a no-op.
"""

import argparse
import os
import sys
from collections import defaultdict

import psycopg
from dotenv import load_dotenv

# Add the scraper package to sys.path so we can import its modules.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scraper"))

from gamexs_scraper.load_to_postgres import url_slugify
from gamexs_scraper.normalize import clean_title, normalize_game_name


def compute_plan(games: list[tuple]) -> tuple[list, list]:
    """Return (merges, updates) given all (id, platform_id, slug, title) rows.

    merges: [(duplicate_id, primary_id)]   — duplicate is deleted, its listings moved
    updates: [(game_id, new_slug, new_title)]  — title/slug change for primary games
    """
    # Group all games by their desired final (platform_id, slug).
    groups: dict[tuple, list] = defaultdict(list)
    for gid, pid, old_slug, old_title in games:
        new_title = clean_title(old_title)
        new_slug  = url_slugify(normalize_game_name(old_title))
        groups[(pid, new_slug)].append((gid, old_slug, old_title, new_title))

    merges: list[tuple[int, int]] = []
    updates: list[tuple[int, str, str]] = []

    for (_, new_slug), entries in groups.items():
        # Lowest game_id wins as primary (it was inserted first = more canonical).
        entries.sort(key=lambda e: e[0])
        primary_gid, primary_old_slug, primary_old_title, primary_new_title = entries[0]

        for dup_gid, *_ in entries[1:]:
            merges.append((dup_gid, primary_gid))

        if new_slug != primary_old_slug or primary_new_title != primary_old_title:
            updates.append((primary_gid, new_slug, primary_new_title))

    return merges, updates


def run(dry_run: bool = False) -> None:
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL is not set — check .env at the repo root")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, platform_id, slug, title FROM ps5_games ORDER BY id")
            games = cur.fetchall()

        print(f"Loaded {len(games)} games from database.")

        merges, updates = compute_plan(games)

        print(f"Plan: {len(merges)} merges, {len(updates)} title/slug updates.")
        print()

        if merges:
            print("=== MERGES (duplicate games collapsing into primary) ===")
            gid_map = {g[0]: g for g in games}
            for dup_id, primary_id in merges:
                dup   = gid_map[dup_id]
                prim  = gid_map[primary_id]
                dup_title   = dup[3]
                prim_title  = prim[3]
                print(f"  game#{dup_id} {dup[2]!r}")
                print(f"    title: {dup_title!r}")
                print(f"    -> merged into game#{primary_id} ({prim_title!r})")
            print()

        if updates:
            print("=== UPDATES (title / slug changes) ===")
            gid_map = {g[0]: g for g in games}
            changed_slug  = [(gid, ns, nt) for gid, ns, nt in updates if gid_map[gid][2] != ns]
            changed_title = [(gid, ns, nt) for gid, ns, nt in updates if gid_map[gid][3] != nt]
            print(f"  Slug changes:  {len(changed_slug)}")
            print(f"  Title changes: {len(changed_title)}")
            if len(updates) <= 30:
                for gid, new_slug, new_title in updates:
                    row = gid_map[gid]
                    if row[2] != new_slug:
                        print(f"  #{gid} slug: {row[2]!r} -> {new_slug!r}")
                    if row[3] != new_title:
                        print(f"  #{gid} title: {row[3]!r} -> {new_title!r}")
            print()

        if dry_run:
            print("Dry run — no changes made.")
            return

        if not merges and not updates:
            print("Nothing to do — database is already normalized.")
            return

        print("Applying migration...")

        with conn.cursor() as cur:
            merge_count  = 0
            delete_count = 0
            update_count = 0

            # Phase 1: merge duplicates
            for dup_id, primary_id in merges:
                # Reassign all listings from the duplicate to the primary.
                # The listings unique key is (seller_id, source_url, product_type, tier),
                # so no two listings share the same URL — the UPDATE is always conflict-free.
                cur.execute(
                    "UPDATE listings SET game_id = %s WHERE game_id = %s",
                    (primary_id, dup_id),
                )
                merge_count += cur.rowcount

                cur.execute("DELETE FROM ps5_games WHERE id = %s", (dup_id,))
                delete_count += cur.rowcount

            # Phase 2: update slug + title on primaries
            for gid, new_slug, new_title in updates:
                cur.execute(
                    "UPDATE ps5_games SET slug = %s, title = %s WHERE id = %s",
                    (new_slug, new_title, gid),
                )
                update_count += cur.rowcount

        conn.commit()

        print(f"Done.")
        print(f"  Listings reassigned: {merge_count}")
        print(f"  Duplicate games deleted: {delete_count}")
        print(f"  Games updated: {update_count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply title normalization to games table")
    parser.add_argument("--dry-run", action="store_true", help="Print plan without modifying DB")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
