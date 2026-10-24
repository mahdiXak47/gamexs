#!/usr/bin/env python3
"""Move shop listings off catalog rows whose IGDB match is the wrong game.

Each repair names the row the shops' listings wrongly sit on and the row that
is the product they actually sell. Two kinds:

- merge: the wrong row is junk (e.g. IGDB 134619 "Hades 2", a 2001 PC game) —
  move listings/history/aliases/clicks to the target, delete the row and keep
  its old URL as a 308 redirect (ps5_game_slug_aliases).
- move:  the wrong row is a real game the shops just don't sell — move the
  listings and history only; the row stays. Only useful when the shops' titles
  will also resolve to the target (the loader re-resolves every load).

Dry run by default (prints what would change and rolls back); --apply commits.

    python repair_catalog_matches.py            # preview
    python repair_catalog_matches.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys

import psycopg

from gamexs_scraper.catalog_merge import merge_game_relations
from gamexs_scraper.normalize import normalize_game_name

# (wrong slug, target slug, kind) — verified 2026-10-24 against the listings.
REPAIRS = [
    ("hades-2", "hades-ii", "merge"),            # IGDB 134619 = 2001 PC game; shops sell Supergiant's Hades II
    ("jumanji", "jumanji-the-video-game", "merge"),  # IGDB 70577 = 1996 game; Nakhlmarket sells the 2019 game
]


def ids(cur: psycopg.Cursor, wrong: str, target: str) -> tuple[int, int] | None:
    cur.execute("SELECT slug, id FROM ps5_games WHERE slug = ANY(%s)", ([wrong, target],))
    found = dict(cur.fetchall())
    if wrong not in found or target not in found:
        print(f"skip {wrong} -> {target}: missing {sorted({wrong, target} - set(found))}")
        return None
    return found[wrong], found[target]


def move_listings(cur: psycopg.Cursor, src: int, dst: int) -> int:
    """Re-point listings (their history follows); a listing the target already has keeps the target's."""
    cur.execute(
        """
        UPDATE listings l SET game_id = %s
        WHERE l.game_id = %s AND NOT EXISTS (
            SELECT 1 FROM listings t
            WHERE t.game_id = %s AND t.seller_id = l.seller_id AND t.source_url = l.source_url
              AND t.product_type = l.product_type AND t.tier IS NOT DISTINCT FROM l.tier)
        """,
        (dst, src, dst),
    )
    return cur.rowcount


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="commit the changes (default: dry run)")
    args = parser.parse_args()
    db_url = os.environ.get("DATABASE_URL") or sys.exit("DATABASE_URL is required")

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        for wrong, target, kind in REPAIRS:
            pair = ids(cur, wrong, target)
            if not pair:
                continue
            src, dst = pair
            if kind == "move":
                print(f"move {wrong} -> {target}: {move_listings(cur, src, dst)} listings")
                continue
            cur.execute("SELECT platform_id, title FROM ps5_games WHERE id = %s", (src,))
            platform_id, wrong_title = cur.fetchone()
            moved = merge_game_relations(cur, src, dst)
            cur.execute("UPDATE outbound_clicks SET game_id = %s WHERE game_id = %s", (dst, src))
            clicks = cur.rowcount
            cur.execute("SELECT to_regclass('public.wishlist_wishlistitem') IS NOT NULL")
            if cur.fetchone()[0]:  # Django table, no FK to ps5_games: move, never orphan
                cur.execute(
                    "UPDATE wishlist_wishlistitem w SET game_id = %s WHERE w.game_id = %s AND NOT EXISTS "
                    "(SELECT 1 FROM wishlist_wishlistitem t WHERE t.game_id = %s AND t.user_id = w.user_id)",
                    (dst, src, dst),
                )
                cur.execute("DELETE FROM wishlist_wishlistitem WHERE game_id = %s", (src,))
            cur.execute("UPDATE ps5_game_slug_aliases SET game_id = %s WHERE game_id = %s", (dst, src))
            cur.execute("DELETE FROM ps5_games WHERE id = %s", (src,))
            cur.execute(
                "INSERT INTO ps5_game_slug_aliases (game_id, slug) VALUES (%s, %s) "
                "ON CONFLICT (slug) DO UPDATE SET game_id = EXCLUDED.game_id",
                (dst, wrong),
            )
            # The loader re-resolves every listing on each load (listing game_id is
            # upserted), so shops' titles for the old row must now resolve here.
            cur.execute(
                "INSERT INTO ps5_game_aliases (platform_id, game_id, normalized_name, source) "
                "VALUES (%s, %s, %s, 'manual') ON CONFLICT (platform_id, normalized_name) DO NOTHING",
                (platform_id, dst, normalize_game_name(wrong_title)),
            )
            print(f"merge {wrong} -> {target}: listings/deduped/aliases {moved}, clicks {clicks}, "
                  f"alias '{normalize_game_name(wrong_title)}', /games/{wrong} now redirects")
        if args.apply:
            conn.commit()
            print("applied")
        else:
            conn.rollback()
            print("dry run — nothing changed (use --apply)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
