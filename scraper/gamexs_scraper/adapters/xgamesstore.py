"""Adapter for xgamesstore.org (WooCommerce, server-rendered).

Verified 2026-07-09:
- Account games only (plus PS Plus subscriptions, which we skip).
- PS5 category: /product-category/play-station-5/ with /page/N/ pagination.
- Products in #mx_products, not the standard ul.products list.
- Tier attribute: attribute_pa_نوع-محصول (URL-encoded); values:
  ظرفیت-اول/دوم/سوم → CAPACITY_1/2/3.
- Filter by attribute_pa_کنسول == 'ps5'; skip products with no ps5 variation.
- Price in Toman from variation["display_price"].
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

CATEGORY_URL = "https://xgamesstore.org/product-category/play-station-5/"

_PRODUCT_HREF_RE = re.compile(r"^https://xgamesstore\.org/product/")

_TIER_MAP = {
    "ظرفیت-اول": AccessTier.CAPACITY_1,
    "ظرفیت-دوم": AccessTier.CAPACITY_2,
    "ظرفیت-سوم": AccessTier.CAPACITY_3,
}


class XgamesStoreAdapter(SellerAdapter):
    seller = "xgamesstore"

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
            mx = soup.select_one("#mx_products")
            if not mx:
                break

            found_any = False
            for a in mx.select('a[href*="/product/"]'):
                href = a["href"].rstrip("/") + "/"
                if href not in seen and re.match(_PRODUCT_HREF_RE, href):
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

        title_el = soup.select_one("span.last")
        if not title_el:
            og = soup.find("meta", property="og:title")
            raw_title = re.split(r"\s*-\s*خرید", og["content"])[0].strip() if og else url
        else:
            raw_title = title_el.get_text(strip=True)

        form = soup.select_one("form.variations_form")
        if not form:
            return

        try:
            variations = json.loads(form.get("data-product_variations", "[]"))
        except (json.JSONDecodeError, TypeError):
            return

        if not variations:
            return

        image_url = None
        if variations[0].get("image", {}).get("full_src"):
            image_url = variations[0]["image"]["full_src"]
        if not image_url:
            og = soup.find("meta", property="og:image")
            image_url = og["content"] if og else None

        best_per_tier: dict[AccessTier, int] = {}
        for v in variations:
            attrs = {unquote(k): unquote(val) for k, val in v.get("attributes", {}).items()}
            console = attrs.get("attribute_pa_کنسول", "")
            if console and console != "ps5":
                continue

            tier_raw = attrs.get("attribute_pa_نوع-محصول", "")
            tier = _TIER_MAP.get(tier_raw)
            if not tier:
                continue

            if not v.get("is_in_stock"):
                continue
            price = v.get("display_price") or 0
            if price <= 0:
                continue

            if tier not in best_per_tier or price < best_per_tier[tier]:
                best_per_tier[tier] = price

        for tier, price in best_per_tier.items():
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
