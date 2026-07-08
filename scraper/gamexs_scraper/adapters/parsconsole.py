"""Adapter for parsconsole.com (WooCommerce + WoodMart theme, server-rendered).

Verified 2026-07-09:
- Account games only — no disc products.
- Category: /product-category/خرید-اکانت-قانونی/ with /page/N/ pagination, ~7 pages ~364 products.
- Tier attribute: attribute_pa_capacity (URL-encoded in JSON); values after decoding:
  ظرفیت-1 / ظرفیت-کامل → CAPACITY_1, ظرفیت-دوم → CAPACITY_2, ظرفیت-سوم → CAPACITY_3.
- Filter variations by attribute_pa_platform == 'ps5'.
- Stock: variation["is_in_stock"] boolean.
"""

import json
import re
import sys
from collections.abc import Iterator
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = "https://parsconsole.com/product-category/%d8%ae%d8%b1%db%8c%d8%af-%d8%a7%da%a9%d8%a7%d9%86%d8%aa-%d9%82%d8%a7%d9%86%d9%88%d9%86%db%8c/"
BASE_URL = "https://parsconsole.com"

_PRODUCT_HREF_RE = re.compile(r"^https://parsconsole\.com/product/")

_TIER_MAP = {
    "ظرفیت1": AccessTier.CAPACITY_1,
    "ظرفیتکامل": AccessTier.CAPACITY_1,  # full/exclusive account = capacity 1
    "ظرفیتدوم": AccessTier.CAPACITY_2,
    "ظرفیتسوم": AccessTier.CAPACITY_3,
}


def _normalize_capacity(raw: str) -> str:
    """URL-decode and strip hyphens/spaces for tier map lookup."""
    return re.sub(r"[\s\-]+", "", unquote(raw))


class ParsConsoleAdapter(SellerAdapter):
    seller = "parsconsole"

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
            url = CATEGORY_URL if page == 1 else f"{CATEGORY_URL}page/{page}/"
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

        img_el = soup.select_one(".woocommerce-product-gallery__wrapper img[data-large_image]")
        image_url = img_el["data-large_image"] if img_el else None
        if not image_url:
            og = soup.find("meta", property="og:image")
            image_url = og["content"] if og else None

        form = soup.find("form", class_="variations_form")
        if not form:
            return

        try:
            variations = json.loads(form.get("data-product_variations", "[]"))
        except (json.JSONDecodeError, TypeError):
            return

        if not variations:
            return

        for v in variations:
            attrs = {unquote(k): unquote(val) for k, val in v.get("attributes", {}).items()}

            platform = attrs.get("attribute_pa_platform", "")
            if platform and platform != "ps5":
                continue

            capacity_raw = attrs.get("attribute_pa_capacity", "")
            tier = _TIER_MAP.get(_normalize_capacity(capacity_raw))
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
