"""Adapter for gamario.com (WooCommerce custom theme, server-rendered).

Verified 2026-07-08:
- Account games only — no disc products.
- PS5 category: /product-category/capacity-account/play-station-5/ with /page/N/.
- Tier attribute: attribute_pa_capacity; values اول/دوم/سوم (URL-encoded).
  اول → CAPACITY_1, دوم → CAPACITY_2, سوم → CAPACITY_3.
- Filter variations to attribute_pa_console == "playstation-5" only.
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

CATEGORY_URL = "https://gamario.com/product-category/capacity-account/play-station-5/"
BASE_URL = "https://gamario.com"

_PRODUCT_HREF_RE = re.compile(r"^https://gamario\.com/product/")

_TIER_MAP = {
    "کامل": AccessTier.CAPACITY_1,  # full/exclusive account = capacity 1
    "اول": AccessTier.CAPACITY_1,
    "دوم": AccessTier.CAPACITY_2,
    "سوم": AccessTier.CAPACITY_3,
}


class GamarioAdapter(SellerAdapter):
    seller = "gamario"

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

        form = soup.find("form", class_="variations_form")
        if not form:
            return

        try:
            variations = json.loads(form.get("data-product_variations", "[]"))
        except (json.JSONDecodeError, TypeError):
            return

        if not variations:
            return

        # Use the variation's own image (product-specific); fall back to og:image.
        # Avoid attachment-woocommerce_thumbnail via soup.find() — it matches
        # related-product thumbnails lower on the page and returns the wrong image.
        image_url = variations[0].get("image", {}).get("url") or None
        if not image_url:
            og = soup.find("meta", property="og:image")
            image_url = og["content"] if og else None

        for v in variations:
            attrs = v.get("attributes", {})
            # Only PS5 variations
            console = unquote(attrs.get("attribute_pa_console", ""))
            if console and "5" not in console:
                continue

            capacity_raw = unquote(attrs.get("attribute_pa_capacity", ""))
            tier = _TIER_MAP.get(capacity_raw)
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
