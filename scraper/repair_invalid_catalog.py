"""Repair legacy seller-created duplicate game rows safely.

This tool only merges an invalid ``ps5_games`` row when an existing canonical
English row can be identified by its IGDB ID, verified alias, or normalized
slug. It never invents an IGDB ID and never deletes a row unless all of its
listings, price history, and aliases have been moved. Run without ``--apply``
first to review the plan.

Usage:
    PYTHONPATH=scraper scraper/.venv/bin/python scraper/repair_invalid_catalog.py \
      --db-url "$LOCAL_DATABASE_URL"
    PYTHONPATH=scraper scraper/.venv/bin/python scraper/repair_invalid_catalog.py \
      --db-url "$LOCAL_DATABASE_URL" --apply
"""

from __future__ import annotations

import argparse
import os
import re
import sys

import psycopg
from dotenv import load_dotenv

from gamexs_scraper.catalog_merge import merge_game_relations
from gamexs_scraper.game_aliases import alias_candidates
from gamexs_scraper.load_to_postgres import url_slugify
from gamexs_scraper.normalize import normalize_game_name


_NON_ASCII_RE = "[^[:ascii:]]"
_APOSTROPHES_RE = re.compile(r"['’‘`]")


def _slug_candidates(title: str) -> list[str]:
    normalized = normalize_game_name(title)
    variants = {normalized, _APOSTROPHES_RE.sub("", normalized)}
    return sorted({url_slugify(value) for value in variants if value})


def _find_target(cur: psycopg.Cursor, bad_id: int, platform_id: int, title: str, igdb_id: int | None):
    targets: dict[int, str] = {}

    if igdb_id is not None:
        cur.execute(
            """
            SELECT id, title
            FROM ps5_games
            WHERE platform_id = %s AND igdb_id = %s AND id <> %s
              AND title !~ '[^[:ascii:]]'
            """,
            (platform_id, igdb_id, bad_id),
        )
        for target_id, target_title in cur.fetchall():
            targets[target_id] = target_title

    aliases = sorted(alias_candidates(title))
    if aliases:
        cur.execute(
            """
            SELECT g.id, g.title
            FROM ps5_game_aliases a
            JOIN ps5_games g ON g.id = a.game_id
            WHERE a.platform_id = %s
              AND a.normalized_name = ANY(%s::text[])
              AND g.id <> %s
              AND g.igdb_id IS NOT NULL
              AND g.title !~ '[^[:ascii:]]'
            """,
            (platform_id, aliases, bad_id),
        )
        for target_id, target_title in cur.fetchall():
            targets[target_id] = target_title

    slugs = _slug_candidates(title)
    if slugs:
        cur.execute(
            """
            SELECT id, title
            FROM ps5_games
            WHERE platform_id = %s
              AND slug = ANY(%s::text[])
              AND id <> %s
              AND igdb_id IS NOT NULL
              AND title !~ '[^[:ascii:]]'
            """,
            (platform_id, slugs, bad_id),
        )
        for target_id, target_title in cur.fetchall():
            targets[target_id] = target_title

    if len(targets) == 1:
        return next(iter(targets.items()))
    return None, ", ".join(f"{target_id}:{target_title}" for target_id, target_title in targets.items())


def _merge_game(cur: psycopg.Cursor, bad_id: int, target_id: int) -> tuple[int, int, int]:
    """Move listing/history/alias relations before removing the duplicate row."""
    return merge_game_relations(cur, bad_id, target_id)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db-url", default=None)
    parser.add_argument("--apply", action="store_true", help="apply reviewed merges")
    args = parser.parse_args()
    database_url = args.db_url or os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("provide --db-url or set DATABASE_URL")

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, platform_id, title, igdb_id
            FROM ps5_games
            WHERE igdb_id IS NULL OR title ~ '[^[:ascii:]]'
            ORDER BY id
            """
        )
        invalid_rows = cur.fetchall()
        planned: list[tuple[int, int, str, str]] = []
        unresolved: list[str] = []
        for bad_id, platform_id, title, igdb_id in invalid_rows:
            target_id, target = _find_target(cur, bad_id, platform_id, title, igdb_id)
            if target_id is None:
                unresolved.append(f"{bad_id}\t{title}\t{target or 'no canonical target'}")
                continue
            planned.append((bad_id, target_id, title, target))

        print(f"invalid rows: {len(invalid_rows)}")
        print(f"safe merges: {len(planned)}")
        print(f"manual review: {len(unresolved)}")
        for bad_id, target_id, title, target in planned:
            print(f"MERGE {bad_id}: {title!r} -> {target_id}: {target!r}")
        if unresolved:
            print("UNRESOLVED:")
            print("\n".join(unresolved))

        if args.apply:
            for bad_id, target_id, _, _ in planned:
                _merge_game(cur, bad_id, target_id)
            conn.commit()
            print(f"applied {len(planned)} merges")
        else:
            conn.rollback()
            print("dry-run only; no database changes made")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, psycopg.Error) as exc:
        sys.exit(f"ERROR: {exc}")
