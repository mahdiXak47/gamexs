"""Adapter for nakhlmarket.com (WordPress + WooCommerce, custom nakhlmarket theme).

Verified against the live site on 2026-07-08:
- Category pages render products empty on initial GET; a POST to admin-ajax.php
  with action=filter_products_wc returns products as an HTML string in JSON.
- No cookie, nonce, or session auth required for the AJAX endpoint.
- Variable products (account games): all variation data is in a
  `var allVariations = [...]` JS block inside div.variations on the product page.
- Simple products (disc games): price in span.price.price-fields text.
- Only tiers 2 and 3 observed in the wild; tier 1 handled defensively.
"""

import json
import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

AJAX_URL = "https://nakhlmarket.com/wp-admin/admin-ajax.php"

# (ProductType, WooCommerce term_id)
_CATEGORIES = [
    (ProductType.ACCOUNT_GAME, 137),  # /product-category/game/ps5-games/accountps5/
    (ProductType.DISC, 142),           # /product-category/game/ps5-games/playstation5-games/
]

TIER_MAP: dict[str, AccessTier] = {
    "ظرفیت 1": AccessTier.CAPACITY_1,
    "ظرفیت 2": AccessTier.CAPACITY_2,
    "ظرفیت 3": AccessTier.CAPACITY_3,
}

_ATTR_TIER = "انتخاب-ظرفیت-اکانت"
_ALL_VARIATIONS_RE = re.compile(r"var\s+allVariations\s*=\s*(\[.*?\]);", re.DOTALL)
_LAZY_RE = re.compile(r"lazy", re.IGNORECASE)
_PRODUCT_DIV_RE = re.compile(r"^product-\d+$")


def _cover_url(soup: BeautifulSoup) -> str | None:
    img = soup.select_one("img.wp-post-image")
    if not img:
        return None
    for attr in ("data-large_image", "data-src", "data-lazy-src", "src"):
        val = img.get(attr, "")
        if val and not _LAZY_RE.search(val) and not val.startswith("data:"):
            return val
    return None


class NakhlMarketAdapter(SellerAdapter):
    seller = "nakhlmarket"

    def iter_listings(self) -> Iterator[RawOffer]:
        for product_type, term_id in _CATEGORIES:
            for product_url in self._iter_product_urls(term_id):
                try:
                    yield from self._parse_product(product_url, product_type)
                except requests.exceptions.RequestException as exc:
                    print(f"skipping {product_url}: {exc}", file=sys.stderr)

    def _iter_product_urls(self, term_id: int) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        while True:
            try:
                resp = self.fetcher.post(AJAX_URL, data={
                    "action": "filter_products_wc",
                    "main_cat_id": term_id,
                    "archive_taxonomy": "product_cat",
                    "archive_term_id": term_id,
                    "is_brand_archive": "0",
                    "current_brand_slug": "",
                    "page": page,
                })
            except requests.exceptions.RequestException as exc:
                print(f"stopping pagination at page {page} (term {term_id}): {exc}", file=sys.stderr)
                break

            resp.raise_for_status()
            try:
                data = resp.json()
            except ValueError:
                break

            products_html = data.get("products", "")
            if not products_html:
                break

            soup = BeautifulSoup(products_html, "lxml")
            found_any = False
            for box in soup.select("div.nm-product-box"):
                a = box.find("a", href=True)
                if a and "/product/" in a["href"] and a["href"] not in seen:
                    seen.add(a["href"])
                    found_any = True
                    yield a["href"]

            if not found_any:
                break
            page += 1

    def _parse_product(self, url: str, expected_type: ProductType) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        title_el = soup.select_one("span.product-title")
        raw_title = title_el.get_text(strip=True) if title_el else url

        image_url = _cover_url(soup)

        product_div = soup.find("div", id=_PRODUCT_DIV_RE)
        classes = product_div.get("class", []) if product_div else []
        is_variable = "product-type-variable" in classes

        if is_variable and expected_type == ProductType.ACCOUNT_GAME:
            yield from self._parse_variable(url, raw_title, image_url, soup)
        elif not is_variable and expected_type == ProductType.DISC:
            yield from self._parse_disc(url, raw_title, image_url, soup, classes)

    def _parse_variable(
        self, url: str, raw_title: str, image_url: str | None, soup: BeautifulSoup
    ) -> Iterator[RawOffer]:
        variations_div = soup.select_one("div.variations")
        if not variations_div:
            return

        script_text = ""
        for script in variations_div.find_all("script"):
            text = script.get_text()
            if "allVariations" in text:
                script_text = text
                break

        if not script_text:
            return

        m = _ALL_VARIATIONS_RE.search(script_text)
        if not m:
            return

        try:
            variations: list[dict] = json.loads(m.group(1))
        except json.JSONDecodeError:
            return

        for var in variations:
            attrs = var.get("attributes") or {}
            tier_key = attrs.get(_ATTR_TIER, "")
            tier = TIER_MAP.get(tier_key)
            if tier is None:
                if tier_key:
                    print(f"unknown tier {tier_key!r} at {url}", file=sys.stderr)
                continue

            raw_price = var.get("display_price")
            if raw_price is None:
                continue

            try:
                price_toman = int(float(raw_price))
            except (ValueError, TypeError):
                continue

            in_stock = bool(var.get("in_stock", False))

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

    def _parse_disc(
        self, url: str, raw_title: str, image_url: str | None, soup: BeautifulSoup, classes: list[str]
    ) -> Iterator[RawOffer]:
        price_el = soup.select_one("span.price.price-fields")
        if not price_el:
            # Fallback: any woocommerce price amount
            price_el = soup.select_one("span.woocommerce-Price-amount")
        if not price_el:
            return

        price_text = price_el.get_text(strip=True).replace(",", "").replace("تومان", "").strip()
        try:
            price_toman = int(float(price_text))
        except (ValueError, TypeError):
            return

        in_stock = "instock" in classes

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
