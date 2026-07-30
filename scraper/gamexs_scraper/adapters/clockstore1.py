"""Adapter for clockstore1.ir (custom Next.js App Router store).

Verified 2026-07-24:
- PS5 account games: /category/85/, 94 products, all on one page.
- Product data lives in Next.js RSC payload blocks (self.__next_f.push([1,"..."])).
- Category page: large RSC block contains product URLs as "url":"/product/ID/slug/" entries.
- Product page: large RSC block with "has_variants":true contains variant JSON objects.
- Variant name format: "Game Title - ظرفیت یک آفلاین PS5" (PS4 variants have PS4 suffix).
- Tiers:  "ظرفیت یک" -> CAPACITY_1, "ظرفیت دو" -> CAPACITY_2, "ظرفیت سه" -> CAPACITY_3.
- Stock: price > 0 and max_available is None or > 0.
- Image: twitter:image meta tag.
"""

import json
import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

_BASE = "https://clockstore1.ir"
_CATEGORY_URL = f"{_BASE}/category/85/"

_RSC_RE = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')
_PRODUCT_URL_RE = re.compile(r'"url":"(/product/[^"?]+)')
_VARIANT_START_RE = re.compile(r'\{"id":\d+,"name":')

_TIER_MAP: dict[str, AccessTier] = {
    "ظرفیت یک": AccessTier.CAPACITY_1,
    "ظرفیت دو": AccessTier.CAPACITY_2,
    "ظرفیت سه": AccessTier.CAPACITY_3,
}


def _decode_rsc_blocks(html: str) -> list[str]:
    """Decode all RSC payload blocks from a page's HTML."""
    blocks: list[str] = []
    for raw in _RSC_RE.findall(html):
        try:
            blocks.append(json.loads('"' + raw + '"'))
        except (json.JSONDecodeError, Exception):
            pass
    return blocks


def _extract_variant_objects(block: str) -> list[dict]:
    """Extract variant JSON objects from a decoded RSC block using a bracket counter."""
    results: list[dict] = []
    pos = 0
    while True:
        m = _VARIANT_START_RE.search(block, pos)
        if not m:
            break
        start = m.start()
        depth = 0
        end = start
        for i, ch in enumerate(block[start:], start):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end == start:
            break
        try:
            obj = json.loads(block[start:end])
            if isinstance(obj, dict) and "price" in obj:
                results.append(obj)
        except json.JSONDecodeError:
            pass
        pos = end
    return results


class ClockStore1Adapter(SellerAdapter):
    seller = "clockstore1"

    def iter_listings(self) -> Iterator[RawOffer]:
        for product_url in self._iter_product_urls():
            try:
                yield from self._parse_product(product_url)
            except requests.exceptions.RequestException as exc:
                print(f"skipping {product_url}: {exc}", file=sys.stderr)

    def _iter_product_urls(self) -> Iterator[str]:
        try:
            resp = self.fetcher.get(_CATEGORY_URL)
        except requests.exceptions.RequestException as exc:
            print(f"failed to fetch category: {exc}", file=sys.stderr)
            return
        resp.raise_for_status()

        html = resp.content.decode(errors="replace")
        blocks = _decode_rsc_blocks(html)
        seen: set[str] = set()
        for block in blocks:
            for path in _PRODUCT_URL_RE.findall(block):
                clean = path.rstrip("/") + "/"
                full_url = _BASE + clean
                if full_url not in seen:
                    seen.add(full_url)
                    yield full_url

    def _parse_product(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        html = resp.content.decode(errors="replace")
        soup = BeautifulSoup(html, "lxml")

        tw_img = soup.find("meta", attrs={"name": "twitter:image"})
        image_url = tw_img["content"] if tw_img else None

        og_title = soup.find("meta", property="og:title")
        raw_title = og_title["content"] if og_title else url

        blocks = _decode_rsc_blocks(html)

        # Prefer the block that explicitly declares has_variants
        variant_block: str | None = None
        for block in blocks:
            if '"has_variants":true' in block:
                variant_block = block
                break

        # Fallback: largest block
        if variant_block is None and blocks:
            variant_block = max(blocks, key=len)

        if not variant_block:
            return

        seen_tiers: set[AccessTier] = set()
        for variant in _extract_variant_objects(variant_block):
            name: str = variant.get("name", "")

            if "PS5" not in name:
                continue

            tier = self._detect_tier(name)
            if tier is None or tier in seen_tiers:
                continue

            price: int = variant.get("price") or 0
            if price <= 0:
                continue

            max_avail = variant.get("max_available")
            if max_avail is not None and max_avail <= 0:
                continue

            seen_tiers.add(tier)
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

    @staticmethod
    def _detect_tier(name: str) -> AccessTier | None:
        for keyword, tier in _TIER_MAP.items():
            if keyword in name:
                return tier
        return None
