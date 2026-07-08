"""Load a scraper JSONL cache into Postgres.

    python -m gamexs_scraper.load_to_postgres pspro --cache output/pspro_500_offers.jsonl

games/listings are upserted (safe to re-run against an updated cache);
price_history is append-only but deduplicated on (listing_id, scraped_at) so
replaying the same cache file twice doesn't create duplicate history rows.

Reads connection info from the DATABASE_URL env var (loaded from the repo
root's .env via python-dotenv).
"""

import argparse
import os
import re
import sys

import psycopg
from dotenv import load_dotenv

from .download_images import slugify
from .export_csv import load_cached_offers
from .models import RawOffer
from .normalize import clean_title, normalize_game_name

# download_images.slugify() only strips filesystem-unsafe characters — fine
# for image filenames, but "#" and "%" have structural meaning in a URL path
# (a leading "#" turns the whole thing into a fragment, so the link silently
# does nothing instead of navigating) and must not survive into a DB slug
# that the frontend uses directly as a route segment.
_URL_UNSAFE_RE = re.compile(r"[#%]+")
_EDGE_DASH_RE = re.compile(r"^-+|-+$")


def url_slugify(name: str) -> str:
    return _EDGE_DASH_RE.sub("", _URL_UNSAFE_RE.sub("", slugify(name)))


def get_or_create_game(cur: psycopg.Cursor, platform_id: int, slug: str, title: str) -> int:
    cur.execute(
        """
        INSERT INTO games (platform_id, slug, title)
        VALUES (%s, %s, %s)
        ON CONFLICT (platform_id, slug) DO NOTHING
        RETURNING id
        """,
        (platform_id, slug, title),
    )
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute("SELECT id FROM games WHERE platform_id = %s AND slug = %s", (platform_id, slug))
    return cur.fetchone()[0]


def upsert_listing(
    cur: psycopg.Cursor, game_id: int, seller_id: int, product_type: str, tier: str | None, source_url: str
) -> int:
    cur.execute(
        """
        INSERT INTO listings (game_id, seller_id, product_type, tier, source_url)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (seller_id, source_url, product_type, tier) DO UPDATE SET
            game_id = EXCLUDED.game_id,
            is_active = true,
            last_seen_at = now()
        RETURNING id
        """,
        (game_id, seller_id, product_type, tier, source_url),
    )
    return cur.fetchone()[0]


def insert_price_point(cur: psycopg.Cursor, listing_id: int, offer: RawOffer) -> None:
    cur.execute(
        """
        INSERT INTO price_history (listing_id, price_toman, in_stock, scraped_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (listing_id, scraped_at) DO NOTHING
        """,
        (listing_id, offer.price_toman, offer.in_stock, offer.scraped_at),
    )


def load_offers(cur: psycopg.Cursor, platform_id: int, seller_id: int, offers: list[RawOffer]) -> tuple[int, int]:
    games_seen: set[int] = set()
    listings_seen: set[int] = set()

    for i, offer in enumerate(offers, start=1):
        slug = url_slugify(normalize_game_name(offer.raw_title))
        if not slug:
            print(f"\nskipping offer with empty slug: {offer.raw_title!r}", file=sys.stderr)
            continue

        game_id = get_or_create_game(cur, platform_id, slug, clean_title(offer.raw_title))
        games_seen.add(game_id)

        tier = offer.tier.value.upper() if offer.tier else None
        listing_id = upsert_listing(cur, game_id, seller_id, offer.product_type.value.upper(), tier, offer.source_url)
        listings_seen.add(listing_id)

        insert_price_point(cur, listing_id, offer)
        print(f"\r{i}/{len(offers)} offers loaded", end="", file=sys.stderr)

    print(file=sys.stderr)
    return len(games_seen), len(listings_seen)


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Load a scraper JSONL cache into Postgres")
    parser.add_argument("seller")
    parser.add_argument("--cache", required=True, help="JSONL file of raw offers (from export_csv --cache)")
    parser.add_argument("--platform", default="ps5")
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("DATABASE_URL is not set (check .env at the repo root)")

    offers = load_cached_offers(args.cache)
    print(f"loaded {len(offers)} offers from {args.cache}", file=sys.stderr)

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM platforms WHERE slug = %s", (args.platform,))
        platform_row = cur.fetchone()
        if not platform_row:
            sys.exit(f"unknown platform {args.platform!r} — seed it in db/init/02_seed.sql first")

        cur.execute("SELECT id FROM sellers WHERE slug = %s", (args.seller,))
        seller_row = cur.fetchone()
        if not seller_row:
            sys.exit(f"unknown seller {args.seller!r} — seed it in db/init/02_seed.sql first")

        games_count, listings_count = load_offers(cur, platform_row[0], seller_row[0], offers)
        conn.commit()

    print(f"done — {games_count} games, {listings_count} listings, {len(offers)} price points", file=sys.stderr)


if __name__ == "__main__":
    main()
