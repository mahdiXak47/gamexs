import argparse
import csv
import dataclasses
import json
import os
import sys

from .adapters import ADAPTERS
from .models import AccessTier, ProductType, RawOffer
from .normalize import normalize_game_name

COLUMNS = [
    "game",
    "account capacity 1",
    "account capacity 2",
    "account capacity 3",
    "game on customer account",
    "game disk",
]
PRICE_COLUMNS = COLUMNS[1:]

_TIER_COLUMN = {
    AccessTier.CAPACITY_1: "account capacity 1",
    AccessTier.CAPACITY_2: "account capacity 2",
    AccessTier.CAPACITY_3: "account capacity 3",
}
_PRODUCT_TYPE_COLUMN = {
    ProductType.OWN_ACCOUNT_GAME: "game on customer account",
    ProductType.DISC: "game disk",
}


def _offer_column(offer: RawOffer) -> str | None:
    if offer.product_type == ProductType.ACCOUNT_GAME and offer.tier is not None:
        return _TIER_COLUMN.get(offer.tier)
    return _PRODUCT_TYPE_COLUMN.get(offer.product_type)


def build_rows(offers: list[RawOffer]) -> list[dict]:
    rows: dict[str, dict] = {}
    for offer in offers:
        column = _offer_column(offer)
        if column is None:
            continue
        game = normalize_game_name(offer.raw_title)
        if not game:
            continue
        row = rows.setdefault(game, {col: 0 for col in COLUMNS})
        row["game"] = game
        if row[column] == 0 or offer.price_toman < row[column]:
            row[column] = offer.price_toman
    return [rows[key] for key in sorted(rows)]


def write_csv(rows: list[dict], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def load_cached_offers(path: str) -> list[RawOffer]:
    offers = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            record = json.loads(line)
            record["product_type"] = ProductType(record["product_type"])
            record["tier"] = AccessTier(record["tier"]) if record["tier"] else None
            del record["scraped_at"]
            offers.append(RawOffer(**record))
    return offers


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape a seller and export a per-game price CSV")
    parser.add_argument("seller", choices=sorted(ADAPTERS))
    parser.add_argument("-o", "--output", default=None, help="Output CSV path (default: <seller>.csv)")
    parser.add_argument("--limit-products", type=int, default=None, help="Stop after N product pages (for testing)")
    parser.add_argument(
        "--cache",
        default=None,
        help="JSONL file of raw offers. If it exists, rebuild the CSV from it with no network calls "
        "(useful after fixing classification logic). Otherwise, offers are scraped and saved there.",
    )
    args = parser.parse_args()

    if args.cache and os.path.exists(args.cache):
        print(f"loading cached offers from {args.cache}", file=sys.stderr)
        offers = load_cached_offers(args.cache)
    else:
        adapter = ADAPTERS[args.seller]()
        offers = []
        seen_urls: set[str] = set()
        cache_file = open(args.cache, "w", encoding="utf-8") if args.cache else None
        try:
            for offer in adapter.iter_listings():
                if offer.source_url not in seen_urls:
                    seen_urls.add(offer.source_url)
                    if args.limit_products and len(seen_urls) > args.limit_products:
                        break
                offers.append(offer)
                if cache_file:
                    cache_file.write(json.dumps(dataclasses.asdict(offer), ensure_ascii=False, default=str) + "\n")
                print(f"\rscraped {len(seen_urls)} products, {len(offers)} offers", end="", file=sys.stderr)
        finally:
            if cache_file:
                cache_file.close()
        print(file=sys.stderr)

    rows = build_rows(offers)
    output_path = args.output or f"{args.seller}.csv"
    write_csv(rows, output_path)
    print(f"wrote {len(rows)} games to {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
