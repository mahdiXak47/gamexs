"""Migration 006: merge duplicate game rows that represent the same edition.

Migration 003 merged rows whose slugs were identical after normalization.
This migration goes further: it groups rows by (igdb_id, edition_type) so
that rows like:

    "007 First Light Collector"      slug: 007-first-light-collector
    "Collector 007 First Light"      slug: collector-007-first-light
    "Fist Light 007 Collector Edition" slug: fist-light-007-collector-edition

are recognised as the same edition and collapsed into one canonical row.

Algorithm
---------
1. Fetch every game that has an igdb_id (IGDB already confirmed the base game).
2. Extract the "edition key" from each title — the set of recognised edition
   words (collector, legacy, deluxe, …) ignoring word order and the word
   "edition" itself.
3. Group rows by (platform_id, igdb_id, edition_key).
4. Groups with more than one row → keep the row whose slug already looks most
   canonical (starts with the base IGDB name), fall back to lowest id.
5. Compute a canonical title/slug from igdb_name + edition words and update
   the primary row.
6. Move all listings from duplicate rows to the primary, then delete duplicates.

Rows with ambiguous edition keys (more than one distinct edition word that
can't be resolved to a single edition type) are skipped and printed for
manual review.

Usage
-----
    cd scraper
    .venv/bin/python ../db/migrations/006_merge_igdb_duplicates.py [--dry-run]

Safe to re-run: groups that already have one member are skipped.
"""

import argparse
import os
import re
import sys
from collections import defaultdict

import psycopg
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scraper"))

from gamexs_scraper.load_to_postgres import url_slugify
from gamexs_scraper.normalize import clean_title, normalize_game_name

# ---------------------------------------------------------------------------
# Edition-word extraction
# ---------------------------------------------------------------------------
# Each entry is (canonical_label, regex_pattern).
# Order matters: check multi-word phrases before single words.
_EDITION_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("day-one",      re.compile(r"\bday[\s\-]?one\b", re.IGNORECASE)),
    ("cross-gen",    re.compile(r"\bcross[\s\-]?gen\b", re.IGNORECASE)),
    ("goty",         re.compile(r"\bgoty\b|\bgame of the year\b", re.IGNORECASE)),
    ("collector",    re.compile(r"\bcollector[s']?\b", re.IGNORECASE)),
    ("legacy",       re.compile(r"\blegacy\b", re.IGNORECASE)),
    ("deluxe",       re.compile(r"\bdeluxe\b", re.IGNORECASE)),
    ("ultimate",     re.compile(r"\bultimate\b", re.IGNORECASE)),
    ("premium",      re.compile(r"\bpremium\b", re.IGNORECASE)),
    ("gold",         re.compile(r"\bgold\b", re.IGNORECASE)),
    ("platinum",     re.compile(r"\bplatinum\b", re.IGNORECASE)),
    ("standard",     re.compile(r"\bstandard\b", re.IGNORECASE)),
    ("complete",     re.compile(r"\bcomplete\b", re.IGNORECASE)),
    ("definitive",   re.compile(r"\bdefinitive\b", re.IGNORECASE)),
    ("legendary",    re.compile(r"\blegendary\b", re.IGNORECASE)),
    ("enhanced",     re.compile(r"\benhanced\b", re.IGNORECASE)),
    ("anniversary",  re.compile(r"\banniversary\b", re.IGNORECASE)),
    ("launch",       re.compile(r"\blaunch\b", re.IGNORECASE)),
    ("digital",      re.compile(r"\bdigital\b", re.IGNORECASE)),
    ("remastered",   re.compile(r"\bremastered\b", re.IGNORECASE)),
    ("remake",       re.compile(r"\bremake\b", re.IGNORECASE)),
    ("bundle",       re.compile(r"\bbundle\b", re.IGNORECASE)),
    ("director",     re.compile(r"\bdirector[s']?\b", re.IGNORECASE)),
    ("special",      re.compile(r"\bspecial\b", re.IGNORECASE)),
]

_LABEL_TO_DISPLAY = {
    "collector":   "Collector Edition",
    "legacy":      "Legacy Edition",
    "deluxe":      "Deluxe Edition",
    "ultimate":    "Ultimate Edition",
    "premium":     "Premium Edition",
    "gold":        "Gold Edition",
    "platinum":    "Platinum Edition",
    "standard":    "Standard Edition",
    "complete":    "Complete Edition",
    "definitive":  "Definitive Edition",
    "legendary":   "Legendary Edition",
    "enhanced":    "Enhanced Edition",
    "anniversary": "Anniversary Edition",
    "launch":      "Launch Edition",
    "digital":     "Digital Edition",
    "remastered":  "Remastered",
    "remake":      "Remake",
    "bundle":      "Bundle",
    "goty":        "Game of the Year Edition",
    "director":    "Director's Cut",
    "day-one":     "Day One Edition",
    "cross-gen":   "Cross-Gen Edition",
    "special":     "Special Edition",
}


def edition_key(title: str) -> frozenset[str]:
    return frozenset(
        label for label, pattern in _EDITION_PATTERNS if pattern.search(title)
    )


def canonical_title(igdb_name: str, ed_key: frozenset[str]) -> str:
    base = clean_title(igdb_name)
    if not ed_key:
        return base
    # Skip edition labels already present in the IGDB name (avoid "Remastered Remastered").
    missing = frozenset(
        label for label in ed_key
        if not next((p for l, p in _EDITION_PATTERNS if l == label), None).search(base)
    )
    if not missing:
        return base
    display = " ".join(
        _LABEL_TO_DISPLAY.get(label, label.capitalize() + " Edition")
        for label in sorted(missing)
    )
    return f"{base} {display}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run(dry_run: bool = False) -> None:
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL is not set — check .env at the repo root")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, platform_id, igdb_id, igdb_name, title, slug
                FROM ps5_games
                WHERE igdb_id IS NOT NULL
                ORDER BY id
            """)
            games = cur.fetchall()

    print(f"Loaded {len(games)} IGDB-matched games.")

    # Group by (platform_id, igdb_id, edition_key)
    groups: dict[tuple, list] = defaultdict(list)
    for gid, pid, igdb_id, igdb_name, title, slug in games:
        ed = edition_key(title)
        groups[(pid, igdb_id, ed)].append((gid, igdb_name, title, slug))

    merges_needed = {k: v for k, v in groups.items() if len(v) > 1}
    ambiguous = {k: v for k, v in merges_needed.items() if len(k[2]) > 1}
    clean_merges = {k: v for k, v in merges_needed.items() if len(k[2]) <= 1}

    print(f"Groups needing merge: {len(merges_needed)}")
    print(f"  Clean (single edition type): {len(clean_merges)}")
    print(f"  Ambiguous (multiple edition words — skipped): {len(ambiguous)}")

    if ambiguous:
        print("\n=== AMBIGUOUS (manual review needed) ===")
        for (pid, igdb_id, ed), rows in ambiguous.items():
            print(f"  igdb:{igdb_id} edition={set(ed)}")
            for gid, _, title, slug in rows:
                print(f"    game#{gid} {slug!r} ({title!r})")

    total_merged = 0
    total_deleted = 0

    print("\n=== MERGES ===")
    for (pid, igdb_id, ed), rows in clean_merges.items():
        # Pick best primary: prefer row whose slug starts with igdb_name base,
        # otherwise fall back to lowest id.
        igdb_name = rows[0][1] or ""
        base_slug = url_slugify(normalize_game_name(igdb_name))

        rows_sorted = sorted(rows, key=lambda r: (0 if r[3].startswith(base_slug) else 1, r[0]))
        primary = rows_sorted[0]
        duplicates = rows_sorted[1:]

        new_title = canonical_title(igdb_name, ed)
        new_slug  = url_slugify(normalize_game_name(new_title))

        print(f"\n  igdb:{igdb_id}  edition={set(ed) or 'base'}")
        print(f"  PRIMARY  game#{primary[0]} {primary[3]!r} → {new_slug!r} ({new_title!r})")
        for dup in duplicates:
            print(f"  MERGE IN game#{dup[0]} {dup[3]!r} ({dup[2]!r})")

        if dry_run:
            continue

        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                for dup_gid, *_ in duplicates:
                    cur.execute(
                        "UPDATE listings SET game_id = %s WHERE game_id = %s",
                        (primary[0], dup_gid),
                    )
                    total_merged += cur.rowcount
                    cur.execute("DELETE FROM ps5_games WHERE id = %s", (dup_gid,))
                    total_deleted += cur.rowcount

                # Update primary to canonical title/slug, handling the case
                # where another row already owns the new slug.
                cur.execute(
                    "SELECT id FROM ps5_games WHERE platform_id = %s AND slug = %s AND id != %s",
                    (pid, new_slug, primary[0]),
                )
                slug_conflict = cur.fetchone()
                if slug_conflict:
                    # The canonical slug belongs to a row that wasn't in this
                    # group (e.g., already merged earlier in this run).
                    conflict_id = slug_conflict[0]
                    cur.execute(
                        "UPDATE listings SET game_id = %s WHERE game_id = %s",
                        (conflict_id, primary[0]),
                    )
                    cur.execute("DELETE FROM ps5_games WHERE id = %s", (primary[0],))
                    total_deleted += 1
                    print(f"  NOTE: canonical slug already owned by game#{conflict_id}; merged primary into it")
                else:
                    cur.execute(
                        "UPDATE ps5_games SET title = %s, slug = %s WHERE id = %s",
                        (new_title, new_slug, primary[0]),
                    )
            conn.commit()

    if dry_run:
        print("\nDry run — no changes made.")
        return

    print(f"\nDone.")
    print(f"  Listings reassigned: {total_merged}")
    print(f"  Duplicate games deleted: {total_deleted}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge duplicate games by IGDB id + edition type")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
