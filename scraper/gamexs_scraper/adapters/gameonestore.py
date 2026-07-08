"""Adapter for gameonestore.com (WooCommerce + WoodMart, server-rendered).

Verified 2026-07-09:
- Disc games only — all products are WooCommerce simple (no variations).
- PS5 category: /product-category/games/ps5-game/ with /page/N/ pagination.
- Price uses Persian digits in Toman — translate before int().
- Stock: "instock" class on the product div.
- Price scope: wd_single_product_price Elementor widget to avoid cross-sell bleed.
"""

import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import ProductType, RawOffer

CATEGORY_URL = "https://gameonestore.com/product-category/games/ps5-game/"

_PRODUCT_HREF_RE = re.compile(r"^https://gameonestore\.com/product/")
_PERSIAN_DIGIT_TABLE = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")


def _parse_price(el) -> int | None:
    if not el:
        return None
    raw = el.get_text(strip=True)
    digits = re.sub(r"[^\d]", "", raw.translate(_PERSIAN_DIGIT_TABLE))
    if not digits:
        return None
    return int(digits)


class GameoneStoreAdapter(SellerAdapter):
    seller = "gameonestore"

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

        title_el = soup.select_one(".product_title")
        raw_title = title_el.get_text(strip=True) if title_el else url

        # Stock from product div class
        prod_div = soup.select_one("div.product.type-product")
        in_stock = prod_div is not None and "instock" in (prod_div.get("class") or [])

        # Price scoped to the price widget to avoid cross-sell contamination
        widget = soup.select_one('[data-widget_type="wd_single_product_price.default"]')
        price_scope = widget if widget else soup
        sale_el = price_scope.select_one(".price ins .woocommerce-Price-amount bdi")
        reg_el = price_scope.select_one(".price .woocommerce-Price-amount bdi")
        price_toman = _parse_price(sale_el or reg_el)
        if not price_toman:
            return

        # Cover image — first gallery image is the cover
        img_el = soup.select_one(".woocommerce-product-gallery__wrapper img[data-large_image]")
        image_url = img_el["data-large_image"] if img_el else None
        if not image_url:
            og = soup.find("meta", property="og:image")
            image_url = og["content"] if og else None

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
