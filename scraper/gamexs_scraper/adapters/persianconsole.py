"""Adapter for persianconsole.ir (nopCommerce "Emporium" theme, server-rendered).

Re-verified 2026-10-18 (the site moved off its old custom PHP shop, which broke
the previous /product/ + JSON-LD parser):
- Disc games: /fa/game-ps55; account games: /fa/akant-ghanooni.
  Both paginate with ?pagenumber=N; products are `.product-item` boxes whose
  `.product-title a` href is a relative /fa/<slug> URL.
- Product pages carry schema.org microdata: <meta itemprop="price">,
  "priceCurrency" (currently "Toman") and "availability".
- Account products no longer expose a capacity selector (the only attribute is
  payment method); the tier is taken from the product name when it names one,
  otherwise the offer is skipped. All account products were out of stock at
  verification time.
- No headless browser needed — plain GET is sufficient.
"""

import re
import sys
from collections.abc import Iterator
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

BASE_URL = "https://persianconsole.ir"
DISC_CATEGORY_URL = f"{BASE_URL}/fa/game-ps55"
ACCOUNT_CATEGORY_URL = f"{BASE_URL}/fa/akant-ghanooni"

_TIER_PATTERNS = [
    (re.compile(r"ظرفیت\s*(?:یک|1|۱)"), AccessTier.CAPACITY_1),
    (re.compile(r"ظرفیت\s*(?:دو|2|۲)"), AccessTier.CAPACITY_2),
    (re.compile(r"ظرفیت\s*(?:سه|3|۳)"), AccessTier.CAPACITY_3),
]


def _meta(soup: BeautifulSoup, prop: str) -> str:
    el = soup.find(attrs={"itemprop": prop})
    return (el.get("content") or el.get_text(strip=True)) if el else ""


def _price_toman(soup: BeautifulSoup) -> int | None:
    try:
        price = int(float(_meta(soup, "price")))
    except ValueError:
        return None
    if price <= 0:
        return None
    currency = _meta(soup, "priceCurrency").lower()
    return price // 10 if currency in {"irr", "rial", "ریال"} else price


def _tier(title: str) -> AccessTier | None:
    for pattern, tier in _TIER_PATTERNS:
        if pattern.search(title):
            return tier
    return None


class PersianConsoleAdapter(SellerAdapter):
    seller = "persianconsole"

    def iter_listings(self) -> Iterator[RawOffer]:
        for category, product_type in (
            (DISC_CATEGORY_URL, ProductType.DISC),
            (ACCOUNT_CATEGORY_URL, ProductType.ACCOUNT_GAME),
        ):
            for url in self._iter_product_urls(category):
                try:
                    yield from self._parse_product(url, product_type)
                except requests.exceptions.RequestException as exc:
                    print(f"skipping {url}: {exc}", file=sys.stderr)

    def _iter_product_urls(self, base_url: str) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        while True:
            url = base_url if page == 1 else f"{base_url}?pagenumber={page}"
            try:
                resp = self.fetcher.get(url)
            except requests.exceptions.RequestException as exc:
                print(f"stopping at page {page}: {exc}", file=sys.stderr)
                break

            if resp.status_code == 404:
                break
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "lxml")
            found_any = False
            for a in soup.select(".product-item .product-title a[href]"):
                href = urljoin(BASE_URL, a["href"])
                if href not in seen:
                    seen.add(href)
                    found_any = True
                    yield href

            if not found_any:
                break
            page += 1

    def _parse_product(self, url: str, product_type: ProductType) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        price_toman = _price_toman(soup)
        if price_toman is None:
            return

        raw_title = _meta(soup, "name") or url
        tier = None
        if product_type is ProductType.ACCOUNT_GAME:
            tier = _tier(raw_title)
            if tier is None:
                return

        og_image = soup.find("meta", property="og:image")

        yield RawOffer(
            seller=self.seller,
            source_url=url,
            raw_title=raw_title,
            product_type=product_type,
            price_toman=price_toman,
            tier=tier,
            in_stock="InStock" in _meta(soup, "availability"),
            image_url=og_image.get("content") if og_image else None,
        )
