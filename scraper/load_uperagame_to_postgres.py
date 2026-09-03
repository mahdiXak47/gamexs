"""Load a Upera Game Crawl4AI snapshot into GameXS PostgreSQL.

Game offers reuse the normal RawOffer loader. PS Plus offers use the dedicated
ps_plus and ps_plus_price_history tables because subscriptions are not games.

Usage:
    python load_uperagame_to_postgres.py \
        --games-cache output/uperagame_offers.jsonl \
        --plus-cache output/uperagame_ps_plus.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg
from dotenv import load_dotenv

from gamexs_scraper.export_csv import load_cached_offers
from gamexs_scraper.load_to_postgres import load_offers

VALID_PLUS_TIERS = {"ESSENTIAL", "EXTRA", "PREMIUM"}
VALID_CAPACITIES = {"CAPACITY_1", "CAPACITY_2", "CAPACITY_3"}


def load_plus_cache(path: str | Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    with open(path, encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid JSON on line {line_number} of {path}: {exc}") from exc
            tier = str(record.get("plus_tier", "")).upper()
            capacity = str(record.get("capacity", "")).upper()
            price = record.get("price_toman")
            if tier not in VALID_PLUS_TIERS:
                raise ValueError(f"invalid PS Plus tier on line {line_number}: {tier!r}")
            if capacity not in VALID_CAPACITIES:
                raise ValueError(f"invalid PS Plus capacity on line {line_number}: {capacity!r}")
            if not isinstance(price, int) or price <= 0:
                raise ValueError(f"invalid PS Plus Toman price on line {line_number}: {price!r}")
            record["plus_tier"] = tier
            record["capacity"] = capacity
            record["term"] = str(record.get("term") or "unspecified")
            record["scraped_at"] = datetime.fromisoformat(str(record["scraped_at"]))
            records.append(record)
    return records


def load_plus_offers(
    cur: psycopg.Cursor,
    seller_id: int,
    records: list[dict[str, Any]],
) -> int:
    seen_ids: set[int] = set()
    for record in records:
        cur.execute(
            """
            INSERT INTO ps_plus (tier, seller_id, capacity, term, source_url, cover_url)
            VALUES (%s::ps_plus_tier, %s, %s::access_tier, %s, %s, %s)
            ON CONFLICT (tier, seller_id, capacity, term) DO UPDATE SET
                source_url = EXCLUDED.source_url,
                cover_url = COALESCE(ps_plus.cover_url, EXCLUDED.cover_url),
                is_active = true,
                last_seen_at = now()
            RETURNING id
            """,
            (
                record["plus_tier"],
                seller_id,
                record["capacity"],
                record["term"],
                record["source_url"],
                record.get("image_url"),
            ),
        )
        plus_id = cur.fetchone()[0]
        seen_ids.add(plus_id)
        cur.execute(
            """
            INSERT INTO ps_plus_price_history (ps_plus_id, price_toman, in_stock, scraped_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (ps_plus_id, scraped_at) DO NOTHING
            """,
            (plus_id, record["price_toman"], bool(record["in_stock"]), record["scraped_at"]),
        )

    if records:
        run_started = min(record["scraped_at"] for record in records)
        cur.execute(
            """
            UPDATE ps_plus
            SET is_active = false
            WHERE seller_id = %s
              AND last_seen_at < %s
            """,
            (seller_id, run_started),
        )
    return len(seen_ids)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Load Upera Game offers into PostgreSQL")
    parser.add_argument("--games-cache", required=True)
    parser.add_argument("--plus-cache", required=True)
    parser.add_argument("--db-url", default=None)
    args = parser.parse_args()

    database_url = args.db_url or os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL is not set (check .env at the repo root)")

    games = load_cached_offers(args.games_cache)
    plus = load_plus_cache(args.plus_cache)
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM platforms WHERE slug = 'ps5'")
        platform_row = cur.fetchone()
        if not platform_row:
            sys.exit("unknown platform 'ps5' — seed it in db/init/02_seed.sql first")
        cur.execute("SELECT id FROM sellers WHERE slug = 'uperagame'")
        seller_row = cur.fetchone()
        if not seller_row:
            sys.exit("unknown seller 'uperagame' — run migration 027 first")

        games_count, listings_count = load_offers(
            cur, platform_row[0], seller_row[0], "uperagame", games
        )
        plus_count = load_plus_offers(cur, seller_row[0], plus)
        conn.commit()

    print(
        f"done — {games_count} games, {listings_count} listings, "
        f"{len(games)} game price points, {plus_count} PS Plus identities, "
        f"{len(plus)} PS Plus price points"
    )


if __name__ == "__main__":
    main()
