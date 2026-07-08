"""Adapter for persianconsole.ir (custom PHP e-commerce, server-rendered).

Verified 2026-07-08:
- Disc games: /games/game-ps55, paginated with ?page=N.
- Account games: /akant-ghanooni, paginated with ?page=N.
- Product data in JSON-LD (price in IRR ÷10 = Toman) for disc products.
- Account products use a `product_variants` JS object with a `variants` array;
  prices there are already in Toman. Two tiers: ظرفیت دو (CAPACITY_2) and
  ظرفیت سه (CAPACITY_3).
- No headless browser needed — plain GET is sufficient.
"""

import html
import json
import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

BASE_URL = "https://persianconsole.ir"
DISC_CATEGORY_URL = f"{BASE_URL}/games/game-ps55"
ACCOUNT_CATEGORY_URL = f"{BASE_URL}/akant-ghanooni"

_PRODUCT_HREF_RE = re.compile(r"^https://persianconsole\.ir/product/")
_VARIANTS_RE = re.compile(r'"variants"\s*:\s*(\[.*?\])\s*,\s*\n', re.DOTALL)

_TIER_MAP = {
    "ظرفیت یک": AccessTier.CAPACITY_1,
    "ظرفیت دو": AccessTier.CAPACITY_2,
    "ظرفیت سه": AccessTier.CAPACITY_3,
}


def _json_ld(soup: BeautifulSoup) -> dict:
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.get_text())
            if isinstance(data, list):
                data = data[0] if data else {}
            if isinstance(data, dict) and data.get("@type") == "Product":
                return data
        except (json.JSONDecodeError, IndexError):
            continue
    return {}


def _variants(soup: BeautifulSoup) -> list[dict]:
    for script in soup.find_all("script"):
        text = script.get_text()
        if '"variants"' not in text:
            continue
        m = _VARIANTS_RE.search(text)
        if not m:
            continue
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            return []
    return []


class PersianConsoleAdapter(SellerAdapter):
    seller = "persianconsole"

    def iter_listings(self) -> Iterator[RawOffer]:
        for url in self._iter_product_urls(DISC_CATEGORY_URL):
            try:
                yield from self._parse_disc(url)
            except requests.exceptions.RequestException as exc:
                print(f"skipping {url}: {exc}", file=sys.stderr)

        for url in self._iter_product_urls(ACCOUNT_CATEGORY_URL):
            try:
                yield from self._parse_account(url)
            except requests.exceptions.RequestException as exc:
                print(f"skipping {url}: {exc}", file=sys.stderr)

    def _iter_product_urls(self, base_url: str) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        while True:
            url = base_url if page == 1 else f"{base_url}?page={page}"
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
            for a in soup.find_all("a", href=_PRODUCT_HREF_RE):
                href = a["href"]
                if href not in seen:
                    seen.add(href)
                    found_any = True
                    yield href

            if not found_any:
                break
            page += 1

    def _parse_disc(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        ld = _json_ld(soup)
        if not ld:
            return

        offers = ld.get("offers") or {}
        price_rial = offers.get("price")
        if not price_rial:
            return
        try:
            price_toman = int(price_rial) // 10
        except (ValueError, TypeError):
            return

        availability = offers.get("availability", "")
        in_stock = "InStock" in availability

        raw_title = html.unescape(ld.get("name") or url)
        images = ld.get("image") or []
        image_url = images[0] if images else None

        yield RawOffer(
            seller=self.seller,
            source_url=url,
            raw_title=raw_title,
            product_type=ProductType.DISC,
            price_toman=price_toman,
            tier=None,
            in_stock=in_stock,
            image_url=image_url,
        )

    def _parse_account(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        ld = _json_ld(soup)
        raw_title = html.unescape(ld.get("name") or url)
        images = ld.get("image") or []
        image_url = images[0] if images else None

        for variant in _variants(soup):
            option2 = variant.get("option2") or ""
            tier = _TIER_MAP.get(option2)
            if not tier:
                continue

            try:
                price_toman = int(variant["price"])
            except (ValueError, TypeError, KeyError):
                continue

            status = str(variant.get("status", "0"))
            available = variant.get("available", False)
            in_stock = status == "1" or available is True

            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=raw_title,
                product_type=ProductType.ACCOUNT_GAME,
                price_toman=price_toman,
                tier=tier,
                in_stock=in_stock,
                image_url=image_url,
            )
