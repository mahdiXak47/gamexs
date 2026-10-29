import re
import sys
from abc import ABC, abstractmethod
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import unquote

import requests

from .http import PoliteFetcher, make_session
from .models import AccessTier, ProductType, RawOffer


class SellerAdapter(ABC):
    """One implementation per seller site. Adapters are read-only scrapers:
    they yield RawOffer records and never mutate seller-side state."""

    seller: str
    # Product pages the crawl loaded and parsed, in stock or not. Adapters that can tell
    # "the shop has nothing in stock" from "the crawl broke" set it (technolife);
    # None means unknown, so zero offers stays a failure.
    products_seen: int | None = None
    # WooCommerce shops with a public Store API: product pages are served from
    # one sweep of it instead of one request each (woo_store.py).
    woo_store_url: str | None = None
    # Product pages loading at once in crawl(). For shops that take seconds to
    # answer: requests still start at most one per delay_seconds.
    product_workers: int = 1

    def __init__(self, fetcher: PoliteFetcher | None = None):
        self.fetcher = fetcher or PoliteFetcher(make_session())
        if fetcher is None and self.woo_store_url:
            from .woo_store import WooStoreFetcher

            self.fetcher = WooStoreFetcher(self.fetcher, self.woo_store_url)

    @abstractmethod
    def iter_listings(self) -> Iterator[RawOffer]:
        """Crawl the seller's catalog and yield every offer found."""
        raise NotImplementedError

    def crawl(self, urls: Iterable[str], parse: Callable[[str], Iterable[RawOffer]]) -> Iterator[RawOffer]:
        """Offers from parse(url) for each product URL, in order; a failed page is skipped."""

        def load(url: str) -> list[RawOffer]:
            try:
                return list(parse(url))
            except requests.exceptions.RequestException as exc:
                print(f"skipping {url}: {exc}", file=sys.stderr)
                return []

        if self.product_workers <= 1:
            for url in urls:
                yield from load(url)
            return
        with ThreadPoolExecutor(self.product_workers) as pool:
            for offers in pool.map(load, urls):
                yield from offers


_EDITION_WORDS = {"دیلاکس": "Deluxe", "دلوکس": "Deluxe", "آلتیمیت": "Ultimate", "التیمیت": "Ultimate",
                  "گلد": "Gold", "کالکتور": "Collector", "پریمیوم": "Premium", "استاندارد": "Standard"}


def title_with_edition(raw_title: str, attrs: dict[str, str]) -> str:
    """Append a variation's non-standard edition ("Ultimate Edition") to the title.

    WooCommerce pages often sell Standard and Ultimate/Deluxe side by side
    (cdkeyshare GTA VI). Without the edition every variant landed on the base
    game and the loader kept the cheapest, so an Ultimate price could replace a
    sold-out Standard one. With it, the variant resolves to its own catalog row
    (or stays unresolved if the catalog has none) — never to the wrong game.
    """
    for key, value in attrs.items():
        key = unquote(key).lower()
        # uperagame: "pa_version-type"; psnacctm: "نسخه بازی"; WooCommerce: "pa_edition".
        if not ("ادیشن" in key or "edition" in key or "version" in key or "نسخه" in key):
            continue
        edition = unquote(value).replace("-", " ")
        for fa, en in _EDITION_WORDS.items():
            edition = edition.replace(fa, en)
        edition = re.sub(r"(?:ریجن|region)\s*\S*|[^A-Za-z0-9' ]+", " ", edition, flags=re.I)
        edition = " ".join(edition.split())
        if not edition or edition.lower().startswith("standard"):
            return raw_title
        if not edition.lower().endswith("edition"):
            edition += " Edition"
        return f"{raw_title} {edition}"
    return raw_title


# «ظرفیت کامل» (full capacity: the whole account, all three capacities) is its
# own purchase type, not capacity 1 — some shops sell it, some don't, and it
# costs far more. Tier maps use this marker; account_offer_type() turns it into
# OWN_ACCOUNT_GAME (shown as «ظرفیت کامل») with no tier.
FULL_CAPACITY = "full_capacity"


def account_offer_type(tier):
    """(product_type, tier) for an account offer whose tier may be FULL_CAPACITY."""
    if tier == FULL_CAPACITY:
        return ProductType.OWN_ACCOUNT_GAME, None
    return ProductType.ACCOUNT_GAME, tier
