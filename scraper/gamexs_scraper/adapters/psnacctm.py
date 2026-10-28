"""Adapter for psnacctm.com — "پی اس ان اکانت" (Sazito-hosted shop).

Verified 2026-10-20:
- Sazito exposes the whole catalog as JSON: GET /api/v1/products?page_number=N&page_size=100
  → result.products[] (+ result.total_count, ~2,800 products), each with name, url,
  images and product_variants[] (price in Toman, raw_price = pre-discount,
  stock_number, is_stock_managed, product_attributes). ~29 requests per crawl
  instead of ~2,800 product pages (~370 KB each). `page` is ignored; it is
  `page_number`. The server may gzip regardless of Accept-Encoding (requests copes).
- Variant attributes (names carry emoji, values too):
    "🕹️ پلتفرم" → "PS5 ⚪️" / "PS4 ⚫️"   — only PS5 variants are kept.
    "⚙️ظرفیت"   → "🟢 دوم ( آنلاین و آفلاین )", "سوم ( نیاز به اینترنت )", "اول" …
    "نوع دیسک"  → "🟢 آکبند (نو و پلمپ)" (new, sealed) / "🟠 کارکرده" (used).
    "⭐ نسخه بازی" → "Standard 🔵" / "Ultimate 🟣" (GTA VI sells both on one product).
- Account products have a capacity attribute. Disc products are titled
  "دیسک بازی …"; only sealed (آکبند) PS5-compatible discs are kept — GameXS
  compares new prices. Rentals (اجاره), gift cards and PSN services are skipped:
  they carry neither a capacity nor a disc title.
- product_type is "service" for everything, so it is not used.
"""

from __future__ import annotations

import sys
from collections.abc import Iterator

import requests

from ..base import SellerAdapter, title_with_edition
from ..models import AccessTier, ProductType, RawOffer

BASE_URL = "https://psnacctm.com"
API_URL = f"{BASE_URL}/api/v1/products"
PAGE_SIZE = 100

_TIERS = (("اول", AccessTier.CAPACITY_1), ("دوم", AccessTier.CAPACITY_2), ("سوم", AccessTier.CAPACITY_3))


def _attributes(variant: dict) -> dict[str, str]:
    """{'پلتفرم': 'PS5 ⚪️', 'ظرفیت': '🟢 دوم (…)'} — keys stripped of emoji/spaces."""
    out: dict[str, str] = {}
    for attribute in variant.get("product_attributes") or []:
        value = attribute.get("value")
        text = value.get("value") if isinstance(value, dict) else value
        name = attribute.get("name") or ""
        for key in ("پلتفرم", "ظرفیت", "نوع دیسک", "نسخه"):
            if key in name:
                out[key] = str(text or "").strip()
    return out


def _tier(capacity: str) -> AccessTier | None:
    for word, tier in _TIERS:
        if word in capacity:
            return tier
    return None


def offers_from_product(product: dict) -> list[RawOffer]:
    """All PS5 offers of one API product; pure so it is unit-tested."""
    name = " ".join((product.get("name") or "").split())
    url = product.get("url") or ""
    if not name or not url or not product.get("enabled", True) or "اجاره" in name:
        return []
    is_disc = name.startswith("دیسک")
    images = product.get("images") or []
    image_url = images[0].get("url") if images and isinstance(images[0], dict) else None

    offers: list[RawOffer] = []
    for variant in product.get("product_variants") or []:
        price = variant.get("price") or 0
        if not variant.get("enabled", True) or price <= 0:
            continue
        attrs = _attributes(variant)
        platform = attrs.get("پلتفرم", "")
        if platform and "PS5" not in platform.upper():
            continue
        if "ظرفیت" in attrs:
            tier = _tier(attrs["ظرفیت"])
            if tier is None or "اجاره" in attrs["ظرفیت"]:
                continue
            product_type = ProductType.ACCOUNT_GAME
        elif is_disc:
            if "کارکرده" in attrs.get("نوع دیسک", "") or "ps5" not in name.lower():
                continue
            product_type, tier = ProductType.DISC, None
        else:
            continue
        managed = variant.get("is_stock_managed", False)
        offers.append(
            RawOffer(
                seller="psnacctm",
                source_url=f"{BASE_URL}{url}",
                raw_title=title_with_edition(name, attrs),  # "⭐ نسخه بازی": Standard / Ultimate
                product_type=product_type,
                price_toman=int(price),
                tier=tier,
                in_stock=(not managed) or (variant.get("stock_number") or 0) > 0,
                image_url=image_url,
            )
        )
    return offers


class PsnAcctmAdapter(SellerAdapter):
    seller = "psnacctm"

    def iter_listings(self) -> Iterator[RawOffer]:
        page = 1
        seen = 0
        while True:
            try:
                response = self.fetcher.get(API_URL, params={"page_number": page, "page_size": PAGE_SIZE})
                response.raise_for_status()
                result = response.json()["result"]
            except (requests.exceptions.RequestException, ValueError, KeyError) as exc:
                print(f"stopping at page {page}: {exc}", file=sys.stderr)
                break
            products = result.get("products") or []
            if not products:
                break
            for product in products:
                yield from offers_from_product(product)
            seen += len(products)
            if seen >= int(result.get("total_count") or 0):
                break
            page += 1
