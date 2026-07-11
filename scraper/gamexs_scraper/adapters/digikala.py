"""Adapter for digikala.com (React SPA with a clean JSON API).

Verified 2026-07-09:
- All product data is available from the listing API — no individual product page visits needed.
- Endpoint: api.digikala.com/v1/categories/home-console-games/search/
  with filter[compatible_with_consoles]=playstation-5 and page=N.
- 196 pages, ~3,920 products (20 per page). Pages beyond last return HTTP 400.
- All products in this category are DISC type (physical console games).
- Prices are in Iranian Rial — divide by 10 for Toman.
- API only returns marketable (purchasable) products; all are treated as in_stock.
"""

import sys
from collections.abc import Iterator

import requests

from ..base import SellerAdapter
from ..models import ProductType, RawOffer

API_BASE = "https://api.digikala.com/v1/categories/home-console-games/search/"
PRODUCT_BASE = "https://www.digikala.com"

_PARAMS = {
    "filter[compatible_with_consoles]": "playstation-5",
}


class DigikalaAdapter(SellerAdapter):
    seller = "digikala"

    def iter_listings(self) -> Iterator[RawOffer]:
        page = 1
        while True:
            try:
                resp = self.fetcher.get(API_BASE, params={**_PARAMS, "page": page})
            except requests.exceptions.RequestException as exc:
                print(f"stopping at page {page}: {exc}", file=sys.stderr)
                break

            if resp.status_code == 400:
                break
            resp.raise_for_status()

            body = resp.json()
            data = body.get("data", {})
            products = data.get("products", [])
            if not products:
                break

            for p in products:
                offer = self._parse_product(p)
                if offer:
                    yield offer

            pager = data.get("pager", {})
            if page >= pager.get("total_pages", page):
                break
            page += 1

    def _parse_product(self, p: dict) -> RawOffer | None:
        dv = p.get("default_variant", {})
        price_rial = dv.get("price", {}).get("selling_price", 0)
        if not price_rial:
            return None
        price_toman = price_rial // 10

        raw_title = p.get("title_fa") or p.get("title_en") or ""
        if not raw_title:
            return None

        uri = p.get("url", {}).get("uri", "")
        source_url = PRODUCT_BASE + uri if uri else ""

        images = p.get("images", {}).get("main", {})
        image_url = (images.get("url") or [None])[0]

        return RawOffer(
            seller=self.seller,
            source_url=source_url,
            raw_title=raw_title,
            product_type=ProductType.DISC,
            price_toman=price_toman,
            tier=None,
            in_stock=True,
            image_url=image_url,
        )
