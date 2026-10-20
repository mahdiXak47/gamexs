"""Adapter for fill-game.ir — "فیل گیم" (custom Laravel + Livewire shop).

Verified 2026-10-20:
- Product URLs come from /sitemap-products.xml (~360, incl. PS Plus products,
  which carry no capacity and are skipped).
- A product page only server-renders the platform buttons
  (wire:click="selectValue(<attr>, <value>)", label "PS5"). The capacity
  options and their prices appear after selecting PS5, which is one Livewire
  call: POST /livewire/update with the page's `catalog.product-show` snapshot,
  the page's data-csrf token and the session cookie. The returned HTML lists
  every option with its price: «ظرفیت 2 اختصاصی ۱۲,۷۹۹,۰۰۰ ت». So a product
  costs two requests.
- Capacities: «ظرفیت N اختصاصی» (dedicated) maps to GameXS CAPACITY_N.
  «اشتراکی» (shared, offline only) and «اجاره‌ای» (30-day rental) have no
  GameXS tier and are skipped.
- Stock: the Product JSON-LD offers.availability; an option whose label says
  «ناموجود» is out of stock. Pre-orders are purchasable, so they count as in stock.
"""

from __future__ import annotations

import html
import json
import re
import sys
from collections.abc import Iterator

import requests

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

BASE_URL = "https://fill-game.ir"
SITEMAP_URL = f"{BASE_URL}/sitemap-products.xml"
LIVEWIRE_URL = f"{BASE_URL}/livewire/update"

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
_BUTTON_RE = re.compile(r'<button[^>]*selectValue\((\d+),\s*(\d+)\)[^>]*>(.*?)</button>', re.S)
_SNAPSHOT_RE = re.compile(r'wire:snapshot="([^"]*)"')
_OPTION_RE = re.compile(r"ظرفیت\s*([123])\s*(\S+)?\s+([\d,٬]+)\s*ت")
_TIERS = {"1": AccessTier.CAPACITY_1, "2": AccessTier.CAPACITY_2, "3": AccessTier.CAPACITY_3}


def _text(fragment: str) -> str:
    return " ".join(re.sub(r"<[^>]+>", " ", html.unescape(fragment)).split()).translate(_DIGITS)


def buttons(page_html: str) -> list[tuple[int, int, str]]:
    """(attribute id, value id, label) of every selectValue button."""
    return [(int(a), int(v), _text(label)) for a, v, label in _BUTTON_RE.findall(page_html)]


def product_info(page_html: str) -> tuple[str, bool, str | None] | None:
    """(name, in_stock, image) from the Product JSON-LD, or None if there is none."""
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', page_html, re.S):
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "Product":
            offers = data.get("offers") or {}
            image = data.get("image")
            image = image[0] if isinstance(image, list) and image else image
            in_stock = "OutOfStock" not in str(offers.get("availability", ""))
            return data.get("name") or "", in_stock, image if isinstance(image, str) else None
    return None


def capacity_offers(options_html: str, url: str, title: str, in_stock: bool, image_url: str | None) -> list[RawOffer]:
    """Offers from the capacity buttons rendered after PS5 is selected; pure so it is unit-tested."""
    offers: list[RawOffer] = []
    for _, _, label in buttons(options_html):
        match = _OPTION_RE.search(label)
        if not match:
            continue
        number, kind, price = match.groups()
        if kind and kind != "اختصاصی":
            continue  # shared (اشتراکی) / rental (اجاره‌ای): no GameXS tier
        offers.append(
            RawOffer(
                seller="fillgame",
                source_url=url,
                raw_title=title,
                product_type=ProductType.ACCOUNT_GAME,
                price_toman=int(price.replace(",", "").replace("٬", "")),
                tier=_TIERS[number],
                in_stock=in_stock and "ناموجود" not in label,
                image_url=image_url,
            )
        )
    return offers


class FillGameAdapter(SellerAdapter):
    seller = "fillgame"

    def iter_listings(self) -> Iterator[RawOffer]:
        try:
            sitemap = self.fetcher.get(SITEMAP_URL)
            sitemap.raise_for_status()
        except requests.exceptions.RequestException as exc:
            print(f"sitemap failed: {exc}", file=sys.stderr)
            return
        for url in re.findall(r"<loc>([^<]+)</loc>", sitemap.text):
            try:
                yield from self._product(html.unescape(url).strip())
            except (requests.exceptions.RequestException, ValueError, KeyError) as exc:
                print(f"skipping {url}: {exc}", file=sys.stderr)

    def _product(self, url: str) -> Iterator[RawOffer]:
        page = self.fetcher.get(url)
        page.raise_for_status()
        info = product_info(page.text)
        ps5 = next(((a, v) for a, v, label in buttons(page.text) if label.upper() == "PS5"), None)
        csrf = re.search(r'data-csrf="([^"]+)"', page.text)
        snapshot = next(
            (html.unescape(s) for s in _SNAPSHOT_RE.findall(page.text) if "catalog.product-show" in html.unescape(s)),
            None,
        )
        if not info or not ps5 or not csrf or not snapshot:
            return  # PS Plus / non-PS5 product
        response = self.fetcher.post(
            LIVEWIRE_URL,
            json={
                "_token": csrf.group(1),
                "components": [{"snapshot": snapshot, "updates": {}, "calls": [{"path": "", "method": "selectValue", "params": list(ps5)}]}],
            },
            headers={"X-Livewire": "true", "Referer": url},
        )
        response.raise_for_status()
        options_html = response.json()["components"][0]["effects"].get("html", "")
        title, in_stock, image_url = info
        yield from capacity_offers(options_html, url, title, in_stock, image_url)
