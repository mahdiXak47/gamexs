"""Adapter for yungcenter.com (WordPress + WooCommerce + Woodmart theme).

Verified against the live site on 2026-07-08:
- Plain HTTP GET returns fully server-rendered HTML — no JS execution needed.
- All variation prices and stock are embedded as JSON in the
  `data-product_variations` attribute on the add-to-cart form;
  no form submission or XHR required.
- The main account-game category is /product-category/acc-play-station/,
  which mixes PS4 and PS5 listings. We filter to PS5-only variations by
  checking `attribute_pa_انتخاب-پلتفرم` in each variation's attribute map.
- Tier mapping: ظرفیت-اول/ظرفیت-کامل → CAPACITY_1 (both are full-account
  handovers), ظرفیت-دوم → CAPACITY_2, ظرفیت-سوم → CAPACITY_3.
"""

import json
import re
import sys
from collections.abc import Iterator
from html import unescape
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = "https://yungcenter.com/product-category/acc-play-station/"

# URL-decoded values that appear in `attribute_pa_انتخاب-ظرفیت`
TIER_MAP: dict[str, AccessTier] = {
    "ظرفیت-اول": AccessTier.CAPACITY_1,
    "ظرفیت-کامل": AccessTier.CAPACITY_1,  # full-account handover = full capacity
    "ظرفیت-دوم": AccessTier.CAPACITY_2,
    "ظرفیت-سوم": AccessTier.CAPACITY_3,
}

# WooCommerce attribute key names (after unquoting)
ATTR_PLATFORM = "attribute_pa_انتخاب-پلتفرم"
ATTR_TIER = "attribute_pa_انتخاب-ظرفیت"

_LAZY_SRC_RE = re.compile(r"lazy", re.IGNORECASE)


def _real_img(tag) -> str | None:
    """Return the actual image URL from a lazy-loaded WooCommerce <img>."""
    for attr in ("data-src", "data-wood-src", "data-large_image"):
        val = tag.get(attr, "")
        if val and not _LAZY_SRC_RE.search(val):
            return val
    src = tag.get("src", "")
    return src if src and not _LAZY_SRC_RE.search(src) else None


class YungCenterAdapter(SellerAdapter):
    seller = "yungcenter"

    def iter_listings(self) -> Iterator[RawOffer]:
        for product_url in self._iter_product_urls():
            try:
                offers = list(self._parse_product(product_url))
            except requests.exceptions.RequestException as exc:
                print(f"skipping {product_url}: {exc}", file=sys.stderr)
                continue
            yield from offers

    def _iter_product_urls(self) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        while True:
            url = CATEGORY_URL if page == 1 else f"{CATEGORY_URL}page/{page}/"
            try:
                resp = self.fetcher.get(url)
            except requests.exceptions.RequestException as exc:
                print(f"stopping category pagination at page {page}: {exc}", file=sys.stderr)
                break
            if resp.status_code == 404:
                break
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "lxml")

            found_any = False
            for a in soup.select("h3.wd-entities-title > a"):
                href = a.get("href", "")
                if href and "/product/" in href and href not in seen:
                    seen.add(href)
                    found_any = True
                    yield href

            if not found_any:
                break
            page += 1

    def _parse_product(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title_el = soup.select_one("h1.product_title")
        raw_title = title_el.get_text(strip=True) if title_el else url

        image_el = soup.select_one("img.wp-post-image")
        image_url = _real_img(image_el) if image_el else None

        form = soup.select_one("form.variations_form")
        if form is None:
            return  # non-variable product — no tier/price info available

        raw_json = form.get("data-product_variations", "")
        if not raw_json:
            return

        try:
            variations: list[dict] = json.loads(unescape(raw_json))
        except json.JSONDecodeError:
            return

        for var in variations:
            # Both attribute keys and values are URL-encoded in WooCommerce's
            # data-product_variations JSON — decode keys and values together.
            raw_attrs = var.get("attributes") or {}
            attrs = {unquote(k): unquote(v) for k, v in raw_attrs.items()}

            # Filter to PS5 variations only; skip if explicitly another platform
            platform = attrs.get(ATTR_PLATFORM, "").lower()
            if platform and platform != "ps5":
                continue

            tier_key = attrs.get(ATTR_TIER, "")
            tier = TIER_MAP.get(tier_key)
            if tier is None:
                continue  # unknown or missing tier — can't classify

            raw_price = var.get("display_price")
            if raw_price is None:
                continue

            try:
                price_toman = int(float(raw_price))
            except (ValueError, TypeError):
                continue

            in_stock = bool(var.get("is_in_stock", False))

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