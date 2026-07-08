"""Adapter for game-center.ir (WooCommerce + WoodMart theme, server-rendered).

Verified 2026-07-08:
- Account games only — no disc products.
- PS5 category: /product-category/بازی-ps5/ with /page/N/ path-segment pagination.
- Tier attribute key: attribute_pa_نوع-ظرفیت (URL-encoded in JSON); values:
  ظرفیت-3/ظرفیت3 → CAPACITY_3, ظرفیت-2/ظرفیت2 → CAPACITY_2, etc.
  Normalize by stripping hyphens after URL-decoding.
- Variation data in form[data-product_variations] as JSON array.
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

CATEGORY_URL = "https://game-center.ir/product-category/%d8%a8%d8%a7%d8%b2%db%8c-ps5/"
BASE_URL = "https://game-center.ir"

_PRODUCT_HREF_RE = re.compile(r"^https://game-center\.ir/product/")

_TIER_MAP = {
    "ظرفیت1": AccessTier.CAPACITY_1,
    "ظرفیتکامل": AccessTier.CAPACITY_1,  # "full capacity" = exclusive account
    "ظرفیت2": AccessTier.CAPACITY_2,
    "ظرفیت3": AccessTier.CAPACITY_3,
}


def _normalize_slug(raw: str) -> str:
    """URL-decode and strip whitespace/hyphens."""
    return re.sub(r"[\s\-]+", "", unquote(raw))


def _decode_attrs(attrs: dict) -> dict[str, str]:
    return {unquote(k): unquote(v) for k, v in attrs.items()}


class GameCenterAdapter(SellerAdapter):
    seller = "gamecenter"

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

        image_url = None
        if variations[0].get("image", {}).get("src"):
            image_url = variations[0]["image"]["src"]

        # Products can have platform × edition × tier combos. For each PS5 tier,
        # take the cheapest in-stock price across all editions.
        best_per_tier: dict[AccessTier, int] = {}
        for v in variations:
            attrs = _decode_attrs(v.get("attributes", {}))
            platform = attrs.get("attribute_pa_platform", "")
            # Skip if platform is explicitly set to something other than ps5
            if platform and platform != "ps5":
                continue
            tier_raw = ""
            for key, val in attrs.items():
                if "ظرفیت" in key:
                    tier_raw = val
                    break
            tier = _TIER_MAP.get(_normalize_slug(tier_raw))
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
