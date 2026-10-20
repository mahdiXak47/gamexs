"""Post-scrape DB maintenance: mark stale listings inactive (games are kept).

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
    """Mark listings unseen for `stale_days` as inactive.

    Games are never deleted: a game no shop sells right now keeps its page,
    metadata, trailer and URL (it just shows no current offers), and comes back
    automatically when a seller lists it again.
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
        conn.commit()

    return {
        "stale_listings_marked_inactive": stale,
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
    print(f"marked {result['stale_listings_marked_inactive']} listings inactive")


if __name__ == "__main__":
    main()
