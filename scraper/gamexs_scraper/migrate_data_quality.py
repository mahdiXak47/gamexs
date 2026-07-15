"""Data quality migration — sync local fixes to production.

Applies three fixes that exist on the local dev DB but not production:

  1. Strip & from game slugs
     & is treated as a query-string delimiter in URLs → 404 on those game pages.

  2. Merge duplicate RDR bundle rows
     Two rows for the same game merged into one canonical row.

  3. Strip 'و قیمت' prefix from slugs/titles
     Seller boilerplate that leaked into DB during early scrapes.

All steps are idempotent — safe to run multiple times.

Usage:
    # Local dev DB:
    python -m gamexs_scraper.migrate_data_quality

    # Production (port-forward must be active on 5435):
    DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5435/gamexs \\
      python -m gamexs_scraper.migrate_data_quality

    # Dry run (print what would change, touch nothing):
    python -m gamexs_scraper.migrate_data_quality --dry-run
"""

import argparse
import os
import re
import sys

import psycopg
from dotenv import load_dotenv

_VA_QIMAT_PREFIX = "و-قیمت-"
_VA_QIMAT_TITLE_RE = re.compile(r"^و\s+قیمت\s+", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Fix 1: & in slugs
# ---------------------------------------------------------------------------

def _fix_ampersand(cur: psycopg.Cursor, dry_run: bool) -> int:
    cur.execute("SELECT id, slug FROM games WHERE slug LIKE '%&%' ORDER BY id")
    rows = cur.fetchall()
    if not rows:
        print("  [1] ✓  No & in slugs — already clean")
        return 0

    print(f"  [1]    {len(rows)} slugs contain & — will strip")
    if dry_run:
        for game_id, slug in rows[:10]:
            clean = slug.replace("&", "").replace("--", "-").strip("-")
            print(f"         {game_id}: {slug!r}  →  {clean!r}")
        if len(rows) > 10:
            print(f"         … and {len(rows) - 10} more")
        return len(rows)

    cur.execute("""
        UPDATE games
        SET slug = trim('-' from regexp_replace(replace(slug, '&', ''), '-{2,}', '-', 'g'))
        WHERE slug LIKE '%&%'
    """)
    print(f"  [1] ✓  stripped & from {cur.rowcount} slugs")
    return cur.rowcount


# ---------------------------------------------------------------------------
# Fix 2: RDR bundle deduplication
# ---------------------------------------------------------------------------

def _merge_rdr_bundle(cur: psycopg.Cursor, dry_run: bool) -> int:
    cur.execute("""
        SELECT g.id, g.slug, g.title,
               COUNT(l.id) AS listing_count
        FROM games g
        LEFT JOIN listings l ON l.game_id = g.id
        WHERE g.slug LIKE '%red-dead-redemption%bundle%'
        GROUP BY g.id, g.slug, g.title
        ORDER BY listing_count DESC, g.id
    """)
    rows = cur.fetchall()

    if len(rows) <= 1:
        print(f"  [2] ✓  RDR bundle: {len(rows)} row — no merge needed")
        return 0

    canonical_id, canonical_slug, canonical_title, _ = rows[0]
    duplicates = rows[1:]
    print(
        f"  [2]    RDR bundle: {len(rows)} rows — keeping id={canonical_id} "
        f"({canonical_slug!r}), merging {len(duplicates)} duplicate(s)"
    )
    for dup_id, dup_slug, _, dup_count in duplicates:
        print(f"         merge id={dup_id} ({dup_slug!r}, {dup_count} listings) → id={canonical_id}")

    if dry_run:
        return len(duplicates)

    for dup_id, *_ in duplicates:
        cur.execute("UPDATE listings SET game_id = %s WHERE game_id = %s", (canonical_id, dup_id))
        cur.execute("DELETE FROM games WHERE id = %s", (dup_id,))

    # Ensure canonical has a clean slug and title
    clean_slug  = "red-dead-redemption-red-dead-redemption-2-bundle"
    clean_title = "Red Dead Redemption & Red Dead Redemption 2 Bundle"
    cur.execute(
        "UPDATE games SET slug = %s, title = %s WHERE id = %s",
        (clean_slug, clean_title, canonical_id),
    )
    print(f"  [2] ✓  merged {len(duplicates)} duplicate(s); canonical slug → {clean_slug!r}")
    return len(duplicates)


# ---------------------------------------------------------------------------
# Fix 3: و قیمت prefix
# ---------------------------------------------------------------------------

def _fix_va_qimat(cur: psycopg.Cursor, dry_run: bool) -> int:
    cur.execute(
        "SELECT id, slug, title FROM games WHERE slug LIKE %s ORDER BY id",
        (f"{_VA_QIMAT_PREFIX}%",),
    )
    rows = cur.fetchall()
    if not rows:
        print("  [3] ✓  No و-قیمت- prefix slugs — already clean")
        return 0

    print(f"  [3]    {len(rows)} slugs have و-قیمت- prefix")
    renamed = merged = 0

    for game_id, slug, title in rows:
        clean_slug  = slug[len(_VA_QIMAT_PREFIX):]
        clean_title = _VA_QIMAT_TITLE_RE.sub("", title).strip()

        # Does a canonical row already exist with the clean slug?
        cur.execute(
            "SELECT id FROM games WHERE slug = %s AND id != %s",
            (clean_slug, game_id),
        )
        canonical = cur.fetchone()

        if canonical:
            canonical_id = canonical[0]
            if dry_run:
                print(f"         MERGE  id={game_id} {slug!r} → id={canonical_id} {clean_slug!r}")
                merged += 1
                continue
            cur.execute(
                "UPDATE listings SET game_id = %s WHERE game_id = %s",
                (canonical_id, game_id),
            )
            cur.execute("DELETE FROM games WHERE id = %s", (game_id,))
            merged += 1
        else:
            if dry_run:
                print(f"         RENAME id={game_id} {slug!r} → {clean_slug!r}")
                renamed += 1
                continue
            cur.execute(
                "UPDATE games SET slug = %s, title = %s WHERE id = %s",
                (clean_slug, clean_title, game_id),
            )
            renamed += 1

    if not dry_run:
        print(f"  [3] ✓  {renamed} renamed, {merged} merged into existing canonical")
    return renamed + merged


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv()

    parser = argparse.ArgumentParser(description="Apply data quality fixes to the DB")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without applying them")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL is not set — check .env or pass it as an env var")

    label = "(DRY RUN) " if args.dry_run else ""
    print(f"\n{'='*60}")
    print(f"  Data quality migration {label}")
    print(f"  DB: {database_url}")
    print(f"{'='*60}\n")

    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            _fix_ampersand(cur, args.dry_run)
            print()
            _merge_rdr_bundle(cur, args.dry_run)
            print()
            _fix_va_qimat(cur, args.dry_run)
            print()

        if args.dry_run:
            conn.rollback()
            print("Dry run complete — nothing written.")
        else:
            conn.commit()
            print("Migration complete — all changes committed.")


if __name__ == "__main__":
    main()
