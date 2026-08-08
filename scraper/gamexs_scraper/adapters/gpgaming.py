"""Adapter for gpgaming.ir (Persian gaming store — GTIK/Tisat-like theme).

Single category page with ~60 products, server-rendered HTML, no JS needed.
Each product page embeds variant + tier data in a <script> tag using JS
literals (!0/!1 for booleans, e3 for prices).
"""

import json
import re
import sys
from collections.abc import Iterator
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = "https://gpgaming.ir/playstation-legal-account"

NON_PRODUCT_KEYWORDS: set[str] = {
    "about", "accessor", "battery", "buy-", "camera", "capacity",
    "charg", "console", "contact", "dualsense", "dualshock", "faq",
    "gift-card", "headphone", "headset", "keyboard", "لوازم",
    "mag", "monitor", "mouse", "nintendo", "order", "playstation",
    "profile", "report-bug", "switch", "xbox", "شارژ",
    "محافظ", "کنترل",
}


def _is_non_product(href: str) -> bool:
    lower = href.lower()
    for kw in NON_PRODUCT_KEYWORDS:
        if kw in lower:
            return True
    return False

TIER_MAP: dict[str, AccessTier] = {
    "ظرفیت اول": AccessTier.CAPACITY_1,
    "ظرفیت کامل": AccessTier.CAPACITY_1,
    "ظرفیت یک": AccessTier.CAPACITY_1,
    "ظرفیت دو": AccessTier.CAPACITY_2,
    "ظرفیت سه": AccessTier.CAPACITY_3,
}

def _extract_variants(text: str) -> list[dict] | None:
    """Parse the variants array from a product page's embedded JS block.

    The format is: options=[...],variants=[{...},{...}],currentVariant={...}
    Nested brackets inside each variant (e.g. ``options: [{...}]``) make
    non-greedy regex unreliable, so we bracket-count the outer array.
    """
    idx = text.find("variants=[")
    if idx == -1:
        return None
    start = idx + len("variants=")
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "[":
            depth += 1
        elif text[i] == "]":
            depth -= 1
            if depth == 0:
                raw = text[start : i + 1]
                raw = raw.replace("!0", "true").replace("!1", "false")
                raw = re.sub(r'(\w+)\s*:', r'"\1":', raw)
                try:
                    return json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    return None
    return None


class GpGamingAdapter(SellerAdapter):
    seller = "gpgaming"

    def iter_listings(self) -> Iterator[RawOffer]:
        for product_url in self._iter_product_urls():
            try:
                yield from self._parse_product(product_url)
            except requests.exceptions.RequestException as exc:
                print(f"skipping {product_url}: {exc}", file=sys.stderr)
                continue

    def _iter_product_urls(self) -> Iterator[str]:
        response = self.fetcher.get(CATEGORY_URL)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")

        seen: set[str] = set()
        for a in soup.select("a[href]"):
            href = a.get("href", "").strip()
            if not href.startswith("/") or href == "/":
                continue
            if _is_non_product(href):
                continue
            if href not in seen:
                seen.add(href)
                yield urljoin(CATEGORY_URL, href)

    def _parse_product(self, url: str) -> Iterator[RawOffer]:
        response = self.fetcher.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")

        title_el = soup.select_one("h1")
        raw_title = title_el.get_text(strip=True) if title_el else url

        if "شارژ" in raw_title or "گیفت کارت" in raw_title:
            return

        image_el = (
            soup.select_one("img.product-image")
            or soup.select_one("img[src*='/attachments/']")
        )
        image_url = urljoin(url, image_el["src"]) if image_el else None

        variants = _extract_variants(response.text)
        if variants is None:
            return

        if not variants:
            return

        for variant in variants:
            if not variant.get("isAvailable", False):
                continue
            tier = self._tier_from_variant(variant)
            if tier is None:
                continue
            option_value = (
                variant.get("options", [{}])[0].get("value", "") if variant.get("options") else ""
            )
            if "PS5" not in raw_title and "PS5" not in option_value:
                continue

            price = variant.get("price") or variant.get("regularPrice", 0)
            if not isinstance(price, (int, float)):
                continue

            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=raw_title,
                product_type=ProductType.ACCOUNT_GAME,
                price_toman=int(price),
                tier=tier,
                in_stock=True,
                image_url=image_url,
            )

    @staticmethod
    def _tier_from_variant(variant: dict) -> AccessTier | None:
        options = variant.get("options")
        if not options:
            return None
        value = options[0].get("value", "")
        for key, tier in TIER_MAP.items():
            if key in value:
                return tier
        return None