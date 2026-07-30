"""Adapter for game-pulse.ir (WooCommerce variable products).

Verified 2026-07-30:
- PS5 account games: /product-category/ps5/, ~13 pages, ~24 products/page.
- Variable products with two attributes:
    attribute_pa_platform: "ps5" or "ps4" -- filter for ps5 only.
    attribute_pa_z: "z1" / "z2" / "z3" -> CAPACITY_1 / 2 / 3.
- Stock: variation["is_in_stock"] boolean.
- Price: variation["display_price"].
- Image: og:image meta tag (.avif / .webp).
"""

import json
import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

_CATEGORY_URL = "https://www.game-pulse.ir/product-category/ps5/"
_PRODUCT_HREF_RE = re.compile(r"^https://www\.game-pulse\.ir/product/")

_TIER_MAP: dict[str, AccessTier] = {
    "z1": AccessTier.CAPACITY_1,
    "z2": AccessTier.CAPACITY_2,
    "z3": AccessTier.CAPACITY_3,
}

_ATTR_PLATFORM = "attribute_pa_platform"
_ATTR_Z = "attribute_pa_z"


class GamePulseAdapter(SellerAdapter):
    seller = "gamepulse"

    def iter_listings(self) -> Iterator[RawOffer]:
        for product_url in self._iter_product_urls():
            try:
                yield from self._parse_product(product_url)
            except requests.exceptions.RequestException as exc:
                print(f"skipping {product_url}: {exc}", file=sys.stderr)

    def _iter_product_urls(self) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        while True:
            url = _CATEGORY_URL if page == 1 else f"{_CATEGORY_URL}page/{page}/"
            try:
                resp = self.fetcher.get(url)
            except requests.exceptions.RequestException as exc:
                print(f"stopping at page {page}: {exc}", file=sys.stderr)
                break

            if resp.status_code == 404:
                break
            resp.raise_for_status()

            soup = BeautifulSoup(resp.content, "lxml")
            found_any = False
            for a in soup.find_all("a", href=_PRODUCT_HREF_RE):
                href = a["href"].rstrip("/") + "/"
                if href not in seen:
                    seen.add(href)
                    found_any = True
                    yield href

            if not found_any:
                break
            page += 1

    def _parse_product(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "lxml")

        title_el = soup.find("h1")
        raw_title = title_el.get_text(strip=True) if title_el else url

        form = soup.find("form", class_="variations_form")
        if not form:
            return

        try:
            variations = json.loads(form.get("data-product_variations", "[]"))
        except (json.JSONDecodeError, TypeError):
            return

        og = soup.find("meta", property="og:image")
        image_url = og["content"] if og else None

        for v in variations:
            attrs = v.get("attributes", {})

            if attrs.get(_ATTR_PLATFORM) != "ps5":
                continue

            tier = _TIER_MAP.get(attrs.get(_ATTR_Z, ""))
            if not tier:
                continue

            if not v.get("is_in_stock"):
                continue

            price = v.get("display_price") or 0
            if price <= 0:
                continue

            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=raw_title,
                product_type=ProductType.ACCOUNT_GAME,
                price_toman=price,
                tier=tier,
                in_stock=True,
                image_url=image_url,
            )
