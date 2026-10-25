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
- rematch: the row IS the product the shops sell, only its IGDB match is wrong
  (Resident Evil 2 Remake stored as the 1998 game). The target is the correct
  IGDB slug: the row keeps its id, URL, listings, clicks and description, gets
  the right IGDB metadata (same mapping as add_game.py), and loses the wrong
  game's screenshots, PS Store link and trailers so the pipeline refills them.

Dry run by default (prints what would change and rolls back); --apply commits.

    python repair_catalog_matches.py            # preview
    python repair_catalog_matches.py --apply
"""

from __future__ import annotations

import argparse
import os
import sys

import psycopg
import requests
from psycopg import sql

from gamexs_scraper.catalog_merge import merge_game_relations
from gamexs_scraper.normalize import normalize_game_name

# (wrong slug, target slug, kind) — verified 2026-10-24 against the listings.
REPAIRS = [
    ("hades-2", "hades-ii", "merge"),            # IGDB 134619 = 2001 PC game; shops sell Supergiant's Hades II
    ("jumanji", "jumanji-the-video-game", "merge"),  # IGDB 70577 = 1996 game; Nakhlmarket sells the 2019 game
    # rematch targets are IGDB slugs, verified 2026-10-25 against the shops' listings.
    ("resident-evil-2-remake", "resident-evil-2--1", "rematch"),  # 347128 (1998 game, 2025 port) -> 19686 (2019 remake)
    ("ben-10", "ben-10", "rematch"),  # 363904 (2006 HyperScan) -> 71455 (Outright Games, 2017, PS4)
    ("lisa-definitive-edition", "lisa-definitive-edition", "rematch"),  # 26652 (LISA: The First, 2012) -> 252184
    ("the-last-of-us-complete-collector", "the-last-of-us-complete-collectors-edition", "rematch"),  # 1009 (2013 PS3) -> 340226
]


def ids(cur: psycopg.Cursor, wrong: str, target: str) -> tuple[int, int] | None:
    cur.execute("SELECT slug, id FROM ps5_games WHERE slug = ANY(%s)", ([wrong, target],))
    found = dict(cur.fetchall())
    if wrong not in found or target not in found:
        print(f"skip {wrong} -> {target}: missing {sorted({wrong, target} - set(found))}")
        return None
    return found[wrong], found[target]


def igdb_session() -> requests.Session:
    from gamexs_scraper.enrich_metadata import get_access_token

    token = get_access_token(os.environ["IGDB_CLIENT_ID"], os.environ["IGDB_CLIENT_SECRET"])
    session = requests.Session()
    session.headers.update({"Client-ID": os.environ["IGDB_CLIENT_ID"], "Authorization": f"Bearer {token}", "Content-Type": "text/plain"})
    return session


# The wrong game's media/store data; the pipeline refills them for the right game.
_CLEARED = ("screenshot_ids", "main_background_image_url", "concept_id", "trailer_url",
            "trailer_source_url", "trailers", "trailer_updated_at")


def rematch(cur: psycopg.Cursor, slug: str, igdb_slug: str, session: requests.Session) -> None:
    from add_game import _available_columns, _metadata
    from gamexs_scraper.enrich_metadata import _igdb_by_slug

    cur.execute("SELECT id, platform_id, title, igdb_id FROM ps5_games WHERE slug = %s", (slug,))
    row = cur.fetchone()
    result = _igdb_by_slug(session, igdb_slug)
    if not row or not result:
        print(f"skip rematch {slug}: {'row' if not row else 'IGDB game ' + igdb_slug} not found")
        return
    game_id, platform_id, old_title, old_igdb = row
    if old_igdb == result["id"]:
        print(f"rematch {slug}: already IGDB {old_igdb}")
        return
    cur.execute("SELECT slug FROM ps5_games WHERE igdb_id = %s", (result["id"],))
    taken = cur.fetchone()
    if taken:
        print(f"skip rematch {slug}: IGDB {result['id']} already belongs to {taken[0]} (merge instead)")
        return
    metadata = _metadata(result)
    metadata.pop("slug")  # keep the URL (and its search ranking)
    columns = _available_columns(cur, "ps5_games")
    sets = [(column, value) for column, value in metadata.items() if column in columns]
    sets += [(column, None) for column in _CLEARED if column in columns]
    cur.execute(
        sql.SQL("UPDATE ps5_games SET {} WHERE id = %s").format(
            sql.SQL(", ").join(sql.SQL("{} = %s").format(sql.Identifier(column)) for column, _ in sets)
        ),
        [value for _, value in sets] + [game_id],
    )
    # Shops' titles must keep resolving here after the title changes.
    cur.execute(
        "INSERT INTO ps5_game_aliases (platform_id, game_id, normalized_name, source) "
        "VALUES (%s, %s, %s, 'manual') ON CONFLICT (platform_id, normalized_name) DO NOTHING",
        (platform_id, game_id, normalize_game_name(old_title)),
    )
    print(f"rematch {slug}: IGDB {old_igdb} -> {result['id']} ({metadata['title']}); media and PS Store link cleared for refill")


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

    session = igdb_session() if any(kind == "rematch" for _, _, kind in REPAIRS) else None
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        for wrong, target, kind in REPAIRS:
            if kind == "rematch":
                rematch(cur, wrong, target, session)
                continue
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
