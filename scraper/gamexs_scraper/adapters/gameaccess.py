"""Adapter for gameaccess.ir (WooCommerce variable products, server-rendered).

Verified 2026-07-30:
- Account games — PS5 capacity variants only; PS4 variants are skipped.
- Category: /product-category/playstation/ with /page/N/ pagination,
  ~24 pages, ~283 products.
- Variations form on each product page; relevant attribute:
    attribute_pa_capacity-selection:
        "ps5-z1"                   -> CAPACITY_1
        "ps5-z2"                   -> CAPACITY_2
        "ظرفیت-سوم-آنلاین-ps5"    -> CAPACITY_3
        "ظرفیت-کامل"               -> CAPACITY_1 (full exclusive account)
        "ps4-*" / "اجاره-*"        -> skip (wrong platform or rental)
  Some products also carry an edition attribute (standard/deluxe/ultimate);
  each (edition, capacity) combination is a separate variation with its own
  price — all in-stock PS5 variations are yielded.
- Stock: variation["is_in_stock"] boolean.
- Price: variation["display_price"] (already numeric).
- Image: og:image meta tag.
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

CATEGORY_URL = "https://gameaccess.ir/product-category/playstation/"

_PRODUCT_HREF_RE = re.compile(r"^https://gameaccess\.ir/product/")

_TIER_MAP: dict[str, AccessTier] = {
    "ps5-z1": AccessTier.CAPACITY_1,
    "ps5-z2": AccessTier.CAPACITY_2,
    "ظرفیت-سوم-آنلاین-ps5": AccessTier.CAPACITY_3,
    "ظرفیت-کامل": AccessTier.CAPACITY_1,
}

_ATTR_CAPACITY = "attribute_pa_capacity-selection"


class GameAccessAdapter(SellerAdapter):
    seller = "gameaccess"

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

        og = soup.find("meta", property="og:image")
        image_url = og["content"] if og else None

        for v in variations:
            attrs = {unquote(k): unquote(val) for k, val in v.get("attributes", {}).items()}

            tier = _TIER_MAP.get(attrs.get(_ATTR_CAPACITY, ""))
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
