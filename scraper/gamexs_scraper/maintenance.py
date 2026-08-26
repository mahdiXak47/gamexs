"""Post-scrape DB maintenance: mark stale listings inactive, drop orphaned games.

IGDB-imported catalog rows are retained even before a seller lists them. The
add_game command records those rows in ps5_game_aliases, which acts as the
explicit catalog-retention marker.

Designed to run at the end of the daily scrape pipeline (see scrape_all.sh).
Idempotent — re-running is safe.

Usage:
    python -m gamexs_scraper.maintenance
    python -m gamexs_scraper.maintenance --stale-days 3
    python -m gamexs_scraper.maintenance --db-url postgresql://gamexs:gamexs@localhost:5434/gamexs

DATABASE_URL env var is used when --db-url is not passed.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import psycopg


def cleanup_stale_listings(database_url: str, stale_days: int = 3) -> dict:
    """Mark listings unseen for `stale_days` as inactive, then remove orphaned games.

    A game is an orphan (safe to delete) when it has no remaining active listing.
    Returns a summary dict with the affected row counts.
    """
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE listings SET is_active = false
            WHERE is_active = true
              AND last_seen_at < NOW() - (%s::text || ' days')::interval
            """,
            (stale_days,),
        )
        stale = cur.rowcount
        cur.execute(
            """
            DELETE FROM ps5_games
            WHERE id NOT IN (SELECT DISTINCT game_id FROM listings WHERE is_active)
              AND NOT EXISTS (
                  SELECT 1
                  FROM ps5_game_aliases a
                  WHERE a.game_id = ps5_games.id
              )
            """
        )
        orphans = cur.rowcount
        conn.commit()

    return {
        "stale_listings_marked_inactive": stale,
        "orphaned_games_removed": orphans,
        "cleaned_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Mark stale listings inactive and remove games with no active listings."
    )
    parser.add_argument(
        "--stale-days", type=int, default=3,
        help="Mark listings inactive after this many unseen days (default: 3)",
    )
    parser.add_argument(
        "--db-url", default=None,
        help="Postgres connection string (fallback: DATABASE_URL env var)",
    )
    args = parser.parse_args()

    database_url = args.db_url or os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("ERROR: provide --db-url or set DATABASE_URL env var")

    result = cleanup_stale_listings(database_url, args.stale_days)
    print(
        "marked %s listings inactive, removed %s orphaned games"
        % (result["stale_listings_marked_inactive"], result["orphaned_games_removed"])
    )


if __name__ == "__main__":
    main()
