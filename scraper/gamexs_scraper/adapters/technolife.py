"""Adapter for technolife.com (Next.js + React Query).

Verified 2026-07-08:
- Server-rendered HTML; all product data is embedded in a __NEXT_DATA__ JSON
  block on both category and product pages — no JS execution needed.
- Only sells physical PS5 discs (no account-game tiers).
- Multiple third-party sellers may list the same product; we take the first
  in-stock offer (the one technolife surfaces by default).
- Pagination: ?page=N query parameter on the category URL.
"""

import json
import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import ProductType, RawOffer

CATEGORY_URL = "https://www.technolife.com/category/gaming/games/ps-games/ps5-games"
BASE_URL = "https://www.technolife.com"

_PRODUCT_HREF_RE = re.compile(r"^/product-\d+/")


class TechnoLifeAdapter(SellerAdapter):
    seller = "technolife"

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
            url = CATEGORY_URL if page == 1 else f"{CATEGORY_URL}?page={page}"
            try:
                resp = self.fetcher.get(url)
            except requests.exceptions.RequestException as exc:
                print(f"stopping at page {page}: {exc}", file=sys.stderr)
                break

            if resp.status_code == 404:
                break
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "lxml")
            found_any = False
            for a in soup.find_all("a", href=_PRODUCT_HREF_RE):
                href = a["href"]
                full_url = BASE_URL + href
                if full_url not in seen:
                    seen.add(full_url)
                    found_any = True
                    yield full_url

            if not found_any:
                break
            page += 1

    def _parse_product(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")

        next_data_el = soup.find("script", id="__NEXT_DATA__")
        if not next_data_el:
            return

        try:
            next_data = json.loads(next_data_el.get_text())
        except json.JSONDecodeError:
            return

        try:
            queries = next_data["props"]["pageProps"]["dehydratedState"]["queries"]
        except (KeyError, TypeError):
            return

        product_info = None
        seller_items_component = None
        for q in queries:
            data = q.get("state", {}).get("data") or {}
            if not isinstance(data, dict):
                continue
            if "product_info" in data:
                product_info = data["product_info"]
            if "seller_items_component" in data:
                seller_items_component = data["seller_items_component"]

        if not product_info:
            return

        raw_title = product_info.get("title") or url

        image_url = None
        for img in product_info.get("sub_images") or []:
            path = img.get("image", "")
            if path:
                image_url = BASE_URL + path if path.startswith("/") else path
                break

        if not seller_items_component:
            return

        # technolife is a marketplace — multiple sellers list the same product.
        # Take the cheapest one: sort by price, yield only that offer.
        # in_stock field is always 0 in the JSON; use available > 0 instead.
        best_item = None
        for component in seller_items_component:
            for item in component.get("seller_items") or []:
                raw_price = item.get("discounted_price") or item.get("price")
                if not raw_price:
                    continue
                try:
                    price_toman = int(float(raw_price))
                except (ValueError, TypeError):
                    continue
                if best_item is None or price_toman < best_item["price_toman"]:
                    best_item = {"price_toman": price_toman, "item": item}

        if best_item is None:
            return

        item = best_item["item"]
        available = item.get("available") or 0
        stock_text = item.get("stock_text") or ""
        in_stock = int(available) > 0 or "موجود" in stock_text

        yield RawOffer(
            seller=self.seller,
            source_url=url,
            raw_title=raw_title,
            product_type=ProductType.DISC,
            price_toman=best_item["price_toman"],
            tier=None,
            in_stock=in_stock,
            image_url=image_url,
        )
