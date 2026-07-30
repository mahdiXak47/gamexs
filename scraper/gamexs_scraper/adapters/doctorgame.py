"""Adapter for doctor-game.ir (WooCommerce with Persian attribute names, server-rendered).

Verified 2026-07-30:
- Account games only — PS5 platform filter applied per variation.
- Category: /product-category/اکانت-قانونی-پلی-استیشن/ with /page/N/ pagination,
  ~12 pages, ~229 products.
- Variations form present on each product page; attribute keys are URL-encoded Persian:
    attribute_کنسول          -> console; filter for "Ps5"
    attribute_انتخاب-ظرفیت  -> capacity tier:
        "ظرفیت اول"       -> CAPACITY_1
        "ظرفیت دوم"       -> CAPACITY_2
        "ظرفیت سوم"       -> CAPACITY_3
        "ثبت فروش مجدد"   -> skip (resale listing fee, not a game purchase)
- Stock: variation["is_in_stock"] boolean.
- Price: variation["display_price"] (already numeric, no parsing needed).
- Image: variation["image"]["url"].
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

CATEGORY_URL = (
    "https://doctor-game.ir/product-category/"
    "%d8%a7%da%a9%d8%a7%d9%86%d8%aa-%d9%82%d8%a7%d9%86%d9%88%d9%86%db%8c-"
    "%d9%be%d9%84%db%8c-%d8%a7%d8%b3%d8%aa%db%8c%d8%b4%d9%86/"
)

_PRODUCT_HREF_RE = re.compile(r"^https://doctor-game\.ir/product/")

_TIER_MAP = {
    "ظرفیت اول": AccessTier.CAPACITY_1,
    "ظرفیت دوم": AccessTier.CAPACITY_2,
    "ظرفیت سوم": AccessTier.CAPACITY_3,
}

_ATTR_CONSOLE = "attribute_کنسول"
_ATTR_CAPACITY = "attribute_انتخاب-ظرفیت"


class DoctorGameAdapter(SellerAdapter):
    seller = "doctorgame"

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

        for v in variations:
            attrs = {unquote(k): unquote(val) for k, val in v.get("attributes", {}).items()}

            if attrs.get(_ATTR_CONSOLE, "").lower() != "ps5":
                continue

            tier = _TIER_MAP.get(attrs.get(_ATTR_CAPACITY, ""))
            if not tier:
                continue

            if not v.get("is_in_stock"):
                continue

            price = v.get("display_price") or 0
            if price <= 0:
                continue

            image_url = (v.get("image") or {}).get("url") or None

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
