"""Adapter for gameplayshop.ir (WordPress + WooCommerce, Flatsome theme).

Verified 2026-07-08:
- Single category for PS5 games (disc + account mixed):
  /product-category/playstation/ps5-games/ with path-segment pagination /page/N/
- Variation data is inlined as JSON in form[data-product_variations].
- Disc: attribute_pa_condition (brand-new / used) × attribute_pa_region.
  We take only brand-new, in-stock variations, cheapest price.
- Account: attribute_pa_zarfiat (zarfiat-1/2/3) → CAPACITY_1/2/3.
  Each in-stock tier yields a separate RawOffer.
- If data-product_variations is empty (all OOS), we skip the product.
- No JS execution needed; lazy images use data-src.
"""

import json
import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = "https://gameplayshop.ir/product-category/playstation/ps5-games/"
BASE_URL = "https://gameplayshop.ir"

_PRODUCT_HREF_RE = re.compile(r"^https://gameplayshop\.ir/product/")

_TIER_MAP = {
    "zarfiat-1": AccessTier.CAPACITY_1,
    "zarfiat-2": AccessTier.CAPACITY_2,
    "zarfiat-3": AccessTier.CAPACITY_3,
}


def _cover_url(soup: BeautifulSoup) -> str | None:
    img = soup.select_one(".woocommerce-product-gallery img")
    if not img:
        return None
    val = img.get("data-src") or img.get("src")
    if val and not val.startswith("data:"):
        return val
    # noscript fallback
    noscript = soup.select_one(".woocommerce-product-gallery noscript")
    if noscript:
        ns_soup = BeautifulSoup(noscript.get_text(), "lxml")
        ns_img = ns_soup.find("img")
        if ns_img:
            return ns_img.get("src")
    return None


class GameplayShopAdapter(SellerAdapter):
    seller = "gameplayshop"

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
                href = a["href"].split("?")[0].rstrip("/") + "/"
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

        title_el = soup.select_one("h1.product_title")
        raw_title = title_el.get_text(strip=True) if title_el else url
        image_url = _cover_url(soup)

        form = soup.find("form", class_="variations_form")
        if not form:
            return

        variations_raw = form.get("data-product_variations", "[]")
        try:
            variations = json.loads(variations_raw)
        except (json.JSONDecodeError, TypeError):
            return

        if not variations:
            return

        # Detect product type from first variation's attributes
        first_attrs = variations[0].get("attributes", {}) if variations else {}
        is_account = "attribute_pa_zarfiat" in first_attrs

        if is_account:
            yield from self._emit_account(url, raw_title, image_url, variations)
        else:
            yield from self._emit_disc(url, raw_title, image_url, variations)

    def _emit_disc(
        self,
        url: str,
        raw_title: str,
        image_url: str | None,
        variations: list[dict],
    ) -> Iterator[RawOffer]:
        best_price: int | None = None
        best_in_stock = False

        for v in variations:
            attrs = v.get("attributes", {})
            condition = attrs.get("attribute_pa_condition", "")
            if condition and condition != "brand-new":
                continue
            if not v.get("is_in_stock"):
                continue
            price = v.get("display_price") or 0
            if price <= 0:
                continue
            if best_price is None or price < best_price:
                best_price = price
                best_in_stock = True

        if best_price is None:
            return

        yield RawOffer(
            seller=self.seller,
            source_url=url,
            raw_title=raw_title,
            product_type=ProductType.DISC,
            price_toman=best_price,
            tier=None,
            in_stock=best_in_stock,
            image_url=image_url,
        )

    def _emit_account(
        self,
        url: str,
        raw_title: str,
        image_url: str | None,
        variations: list[dict],
    ) -> Iterator[RawOffer]:
        best_per_tier: dict[AccessTier, dict] = {}

        for v in variations:
            attrs = v.get("attributes", {})
            zarfiat_slug = attrs.get("attribute_pa_zarfiat", "")
            tier = _TIER_MAP.get(zarfiat_slug)
            if not tier:
                continue
            if not v.get("is_in_stock"):
                continue
            price = v.get("display_price") or 0
            if price <= 0:
                continue
            existing = best_per_tier.get(tier)
            if existing is None or price < existing["price"]:
                best_per_tier[tier] = {"price": price}

        for tier, data in best_per_tier.items():
            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=raw_title,
                product_type=ProductType.ACCOUNT_GAME,
                price_toman=data["price"],
                tier=tier,
                in_stock=True,
                image_url=image_url,
            )
