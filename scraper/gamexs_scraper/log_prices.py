"""Scrape one seller and log every offer's game/platform/capacity/price.

Price-log monitoring / smoke test for a single adapter. Prints a structured
log line per offer so price movements can be eyeballed without a full
scrape-and-load run.

Usage:
    python -m gamexs_scraper.log_prices gpgaming
"""

from __future__ import annotations

import argparse
import logging

from gamexs_scraper.adapters import ADAPTERS

log = logging.getLogger("gamexs.pricelog")


def log_seller_prices(seller: str) -> dict:
    """Scrape `seller` and return one price record per offer (also logs each)."""
    if seller not in ADAPTERS:
        raise RuntimeError(f"unknown seller {seller!r}")

    adapter = ADAPTERS[seller]()
    prices = []
    for offer in adapter.iter_listings():
        tier_label = offer.tier.value if offer.tier else "N/A"
        record = {
            "game": offer.raw_title,
            "platform": "PS5",
            "capacity": tier_label,
            "price": offer.price_toman,
            "hour": offer.scraped_at.strftime("%H:%M"),
            "date": offer.scraped_at.strftime("%Y-%m-%d"),
        }
        prices.append(record)
        log.info(
            "game=%s | platform=PS5 | capacity=%s | price=%s | hour=%s | date=%s",
            offer.raw_title,
            tier_label,
            offer.price_toman,
            record["hour"],
            record["date"],
        )

    return {"seller": seller, "offers_logged": len(prices), "prices": prices}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scrape a seller and log every offer's price for monitoring."
    )
    parser.add_argument("seller", choices=sorted(ADAPTERS))
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    result = log_seller_prices(args.seller)
    print(f"{result['seller']}: logged {result['offers_logged']} offers")


if __name__ == "__main__":
    main()