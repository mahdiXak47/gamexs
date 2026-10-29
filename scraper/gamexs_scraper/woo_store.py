"""Serve WooCommerce product pages from the shop's public Store API.

A variable product's page is fetched only for its title, image and the
`data-product_variations` JSON. The Store API lists every variation of the
shop with exactly that data (100 per request), so one sweep of
/wp-json/wc/store/v1/products?type=variation replaces one request per product:
~20–50 requests instead of 400–700 for the larger shops.

`WooStoreFetcher` wraps the seller's PoliteFetcher (same one-request-per-second
gap). A product page whose URL the sweep saw is answered with a minimal page
built from that data, in the shape the adapters already parse; any other URL
(listing pages, simple products such as discs, a product added since the
sweep) is fetched as before. If the API fails the fetcher falls back to plain
crawling, so a shop that closes its API only gets slower. The sweep is sorted
by id (new variations land at the end) and abandoned if the shop's variation
count changes while it runs, so a variation can't slip between two pages.
"""

from __future__ import annotations

import html
import json
import sys
from urllib.parse import parse_qsl, unquote, urlsplit

import requests

_FIELDS = "id,name,parent,permalink,prices,is_in_stock,is_purchasable,images"


def page_key(url: str) -> str:
    """Match a listing href to an API permalink: decoded path, no slashes, lowercase."""
    return unquote(urlsplit(url).path).strip("/").lower()


def variation_record(item: dict) -> dict:
    """One API variation in the data-product_variations shape (attributes from its permalink query)."""
    prices = item.get("prices") or {}
    minor = int(prices.get("currency_minor_unit") or 0)
    price = int(prices.get("price") or 0) // 10**minor
    query = urlsplit(item.get("permalink", "")).query
    return {
        "variation_id": item.get("id"),
        "attributes": {k: v for k, v in parse_qsl(query) if k.startswith("attribute_")},
        "display_price": price,
        "display_regular_price": int(prices.get("regular_price") or price) // 10**minor,
        "is_in_stock": bool(item.get("is_in_stock")),
        "is_purchasable": bool(item.get("is_purchasable", True)),
        "variation_is_active": True,
    }


def product_page(title: str, image: str | None, variations: list[dict]) -> str:
    """Minimal product page carrying everything the Woo adapters read."""
    t, img = html.escape(title), html.escape(image or "")
    data = html.escape(json.dumps(variations, ensure_ascii=False))
    image_tags = (
        f'<meta property="og:image" content="{img}">'
        f'<div class="woocommerce-product-gallery woocommerce-product-gallery__wrapper">'
        f'<img class="wp-post-image" src="{img}" data-large_image="{img}"></div>'
    ) if image else ""
    return (
        f'<html><head><meta property="og:title" content="{t}">{image_tags}</head><body>'
        f'<span class="last">{t}</span><h1 class="product_title entry-title">{t}</h1>'
        f'<form class="variations_form cart" data-product_variations="{data}"></form></body></html>'
    )


class WooStoreFetcher:
    def __init__(self, fetcher, base_url: str):
        self._fetcher = fetcher
        self._base_url = base_url.rstrip("/")
        self._pages: dict[str, tuple[str, str | None, list[dict]]] | None = None
        self.api_pages_served = 0

    def __getattr__(self, name):  # delay_seconds, session, post …
        return getattr(self._fetcher, name)

    def _sweep(self) -> dict[str, tuple[str, str | None, list[dict]]]:
        pages: dict[str, tuple[str, str | None, list[dict]]] = {}
        page, total_pages, total = 1, 1, None
        try:
            while page <= total_pages:
                resp = self._fetcher.get(
                    f"{self._base_url}/wp-json/wc/store/v1/products",
                    params={"type": "variation", "per_page": 100, "page": page, "orderby": "id", "order": "asc",
                            "_fields": _FIELDS},
                )
                resp.raise_for_status()
                total_pages = int(resp.headers.get("X-WP-TotalPages") or 1)
                if total is None:
                    total = resp.headers.get("X-WP-Total")
                elif resp.headers.get("X-WP-Total") != total:
                    raise ValueError(f"catalog changed during the sweep ({total} -> {resp.headers.get('X-WP-Total')} variations)")
                for item in resp.json():
                    key = page_key(item.get("permalink", ""))
                    images = item.get("images") or []
                    title, image, variations = pages.setdefault(
                        key, (html.unescape(item.get("name", "")), images[0].get("src") if images else None, [])
                    )
                    variations.append(variation_record(item))
                page += 1
        except (requests.exceptions.RequestException, ValueError) as exc:
            print(f"store API sweep failed at page {page}, crawling product pages instead: {exc}", file=sys.stderr)
            return {}
        print(f"store API: {len(pages)} variable products from {total_pages} requests", file=sys.stderr)
        return pages

    def get(self, url: str, **kwargs) -> requests.Response:
        if self._pages is None:
            self._pages = self._sweep()
        found = None if kwargs else self._pages.get(page_key(url))
        if found is None:
            return self._fetcher.get(url, **kwargs)
        self.api_pages_served += 1
        resp = requests.Response()
        resp.status_code = 200
        resp.url = url
        resp.encoding = "utf-8"
        resp._content = product_page(*found).encode()
        return resp
