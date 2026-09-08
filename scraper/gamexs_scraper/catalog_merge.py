"""Shared, collision-safe helpers for merging duplicate catalog rows."""

from typing import Any


def merge_game_relations(cur: Any, source_game_id: int, target_game_id: int) -> tuple[int, int, int]:
    """Move a game's listings, price history, and aliases to another game.

    Listing identity is protected by a unique key in the database. When both
    games contain the same listing, history is copied to the target listing
    before the source listing is deleted; otherwise the source listing is
    reassigned in place. Alias conflicts are kept on the existing owner.

    The caller owns the transaction and is responsible for deleting the source
    ``ps5_games`` row after this function returns.
    """

    moved_listings = 0
    deduplicated_listings = 0
    moved_aliases = 0

    cur.execute(
        """
        SELECT id, seller_id, source_url, product_type, tier,
               is_active, first_seen_at, last_seen_at
        FROM listings
        WHERE game_id = %s
        ORDER BY id
        """,
        (source_game_id,),
    )
    source_listings = cur.fetchall()
    for (
        source_listing_id,
        seller_id,
        source_url,
        product_type,
        tier,
        is_active,
        first_seen_at,
        last_seen_at,
    ) in source_listings:
        cur.execute(
            """
            SELECT id
            FROM listings
            WHERE game_id = %s
              AND seller_id = %s
              AND source_url = %s
              AND product_type = %s
              AND tier IS NOT DISTINCT FROM %s
            """,
            (target_game_id, seller_id, source_url, product_type, tier),
        )
        target_listing = cur.fetchone()
        if target_listing is None:
            cur.execute("UPDATE listings SET game_id = %s WHERE id = %s", (target_game_id, source_listing_id))
            moved_listings += 1
            continue

        target_listing_id = target_listing[0]
        cur.execute(
            """
            INSERT INTO price_history (listing_id, price_toman, in_stock, scraped_at)
            SELECT %s, price_toman, in_stock, scraped_at
            FROM price_history
            WHERE listing_id = %s
            ON CONFLICT (listing_id, scraped_at) DO NOTHING
            """,
            (target_listing_id, source_listing_id),
        )
        cur.execute(
            """
            UPDATE listings
            SET is_active = is_active OR %s,
                first_seen_at = LEAST(first_seen_at, %s),
                last_seen_at = GREATEST(last_seen_at, %s)
            WHERE id = %s
            """,
            (is_active, first_seen_at, last_seen_at, target_listing_id),
        )
        cur.execute("DELETE FROM listings WHERE id = %s", (source_listing_id,))
        deduplicated_listings += 1

    cur.execute(
        """
        SELECT id, platform_id, normalized_name
        FROM ps5_game_aliases
        WHERE game_id = %s
        ORDER BY id
        """,
        (source_game_id,),
    )
    for alias_id, platform_id, normalized_name in cur.fetchall():
        cur.execute(
            """
            SELECT id
            FROM ps5_game_aliases
            WHERE platform_id = %s AND normalized_name = %s AND id <> %s
            """,
            (platform_id, normalized_name, alias_id),
        )
        existing_alias = cur.fetchone()
        if existing_alias is None:
            cur.execute("UPDATE ps5_game_aliases SET game_id = %s WHERE id = %s", (target_game_id, alias_id))
            moved_aliases += 1
        else:
            # The existing alias may belong to the target or to a third game;
            # in either case deleting the source alias preserves the unique
            # owner instead of inventing a many-to-one alias relation.
            cur.execute("DELETE FROM ps5_game_aliases WHERE id = %s", (alias_id,))

    return moved_listings, deduplicated_listings, moved_aliases
