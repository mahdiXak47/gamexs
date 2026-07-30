"""Adapter for game-store.org (custom Next.js App Router store).

Verified 2026-07-30:
- PS5 account games: /category/account-ps5, all 140 products on one page.
- Category RSC block contains product listing: slug, platforms, image.
- Individual product pages have an "options" array with per-capacity pricing:
    capacity 1 -> CAPACITY_1, 2 -> CAPACITY_2, 3 -> CAPACITY_3
    capacity 0 / 4 ("ظرفیت کامل") are skipped (not in standard taxonomy).
- console field: "PS5" = PS5-specific; "PS4" = skip; null = cross-platform.
- Cross-platform options (console: null) are included when product has PS5.
- Stock: option["available"] boolean.
- Price: option["final"] (post-discount price).
- Image: product["image"] from category listing.
"""

import json
import re
import sys
from collections.abc import Iterator

import requests

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

_BASE = "https://game-store.org"
_CATEGORY_URL = f"{_BASE}/category/account-ps5"

_RSC_RE = re.compile(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)')

_TIER_MAP: dict[int, AccessTier] = {
    1: AccessTier.CAPACITY_1,
    2: AccessTier.CAPACITY_2,
    3: AccessTier.CAPACITY_3,
}


def _decode_rsc_blocks(html: str) -> list[str]:
    blocks: list[str] = []
    for raw in _RSC_RE.findall(html):
        try:
            blocks.append(json.loads('"' + raw + '"'))
        except Exception:
            pass
    return blocks


def _extract_json_array(block: str, key: str) -> list:
    """Extract a top-level JSON array by key name using a bracket counter."""
    marker = f'"{key}":['
    idx = block.find(marker)
    if idx == -1:
        return []
    start = block.index("[", idx)
    depth = 0
    for i, ch in enumerate(block[start:], start):
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(block[start : i + 1])
                except json.JSONDecodeError:
                    return []
    return []


class GameStoreAdapter(SellerAdapter):
    seller = "gamestore"

    def iter_listings(self) -> Iterator[RawOffer]:
        for slug, platforms, image_url, raw_title in self._iter_products():
            try:
                yield from self._parse_product(slug, platforms, image_url, raw_title)
            except requests.exceptions.RequestException as exc:
                print(f"skipping {slug}: {exc}", file=sys.stderr)

    def _iter_products(self) -> Iterator[tuple[str, list[str], str | None, str]]:
        try:
            resp = self.fetcher.get(_CATEGORY_URL)
        except requests.exceptions.RequestException as exc:
            print(f"failed to fetch category: {exc}", file=sys.stderr)
            return
        resp.raise_for_status()

        html = resp.content.decode(errors="replace")
        for block in _decode_rsc_blocks(html):
            if '"products":[' not in block:
                continue
            products = _extract_json_array(block, "products")
            for p in products:
                if "PS5" not in p.get("platforms", []):
                    continue
                yield (
                    p["slug"],
                    p.get("platforms", []),
                    p.get("image"),
                    p.get("title", p["slug"]),
                )
            return

    def _parse_product(
        self,
        slug: str,
        platforms: list[str],
        image_url: str | None,
        raw_title: str,
    ) -> Iterator[RawOffer]:
        url = f"{_BASE}/{slug}"
        resp = self.fetcher.get(url)
        resp.raise_for_status()

        html = resp.content.decode(errors="replace")
        for block in _decode_rsc_blocks(html):
            if '"options":[' not in block:
                continue
            options = _extract_json_array(block, "options")
            if not options:
                continue

            for opt in options:
                tier = _TIER_MAP.get(opt.get("capacity"))
                if tier is None:
                    continue

                console = opt.get("console")
                if console == "PS4":
                    continue
                if console is None and "PS5" not in platforms:
                    continue

                if not opt.get("available"):
                    continue

                price: int = opt.get("final") or 0
                if price <= 0:
                    continue

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
            return
