"""Adapter for pspro.ir (OpenCart storefront).

Verified against the live site on 2026-07-05:
- Plain HTTP GET returns fully server-rendered HTML; no JS execution needed.
- Category pages paginate via `?page=N`, linking to `/product/{slug}` pages.
- Each product page has a base price in `#button-cart`, and an OpenCart
  "option" <select> (name="option[<id>]") whose option labels carry the
  capacity tier name plus an optional price delta, e.g.:
    "ظرفیت دوم (+2,700,000 تومان)"  -> capacity 2, price = base + 2,700,000
    "ظرفیت سوم"                     -> capacity 3, price = base (no delta)
  Products with no such select are not account-tiered, and are treated as
  physical discs. Verified against a 500-game independent reference sample:
  Iranian buyers can't purchase digital codes on their own PSN account
  through official channels, so "own account" digital purchases aren't a
  real product for this seller — every non-tiered PS5 listing is a disc.
  (`warehouse_id` looked like it might disambiguate disc vs. digital by
  listing physical branch names, but it doesn't reliably — some genuine
  discs ship from a single "آنلاین"/online warehouse with no named branch.)
"""

import re
import sys
from collections.abc import Iterator
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = "https://pspro.ir/category/%D8%AE%D8%B1%DB%8C%D8%AF-%D8%A8%D8%A7%D8%B2%DB%8C-PS5"

# Sitewide "request a custom purchase" CTA that pspro embeds on every category
# page — not a real game listing, so it's excluded from the crawl.
NON_PRODUCT_SLUGS = {"/product/خرید-کالا-خدمات"}

PRICE_RE = re.compile(r"([\d,]{4,})\s*تومان")
TIER_WORDS = {
    "کامل": AccessTier.CAPACITY_1,
    "اول": AccessTier.CAPACITY_1,
    "دوم": AccessTier.CAPACITY_2,
    "سوم": AccessTier.CAPACITY_3,
}


def _parse_toman(text: str) -> int | None:
    match = PRICE_RE.search(text)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))


def _tier_from_label(label: str) -> AccessTier | None:
    for word, tier in TIER_WORDS.items():
        if word in label:
            return tier
    return None


class PsProAdapter(SellerAdapter):
    seller = "pspro"

    def iter_listings(self) -> Iterator[RawOffer]:
        for product_url in self._iter_product_urls():
            try:
                offers = list(self._parse_product(product_url))
            except requests.exceptions.RequestException as exc:
                print(f"skipping {product_url}: {exc}", file=sys.stderr)
                continue
            yield from offers

    def _iter_product_urls(self) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        last_page = 1
        while page <= last_page:
            url = CATEGORY_URL if page == 1 else f"{CATEGORY_URL}?page={page}"
            response = self.fetcher.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "lxml")

            if page == 1:
                last_page = self._detect_last_page(soup)

            found_this_page = False
            for a in soup.select('a[href*="/product/"]'):
                href = a.get("href", "")
                if "index.php" in href or "/product/" not in href:
                    continue
                if any(slug in href for slug in NON_PRODUCT_SLUGS):
                    continue
                if href not in seen:
                    seen.add(href)
                    found_this_page = True
                    yield href

            if not found_this_page and page > 1:
                break
            page += 1

    @staticmethod
    def _detect_last_page(soup: BeautifulSoup) -> int:
        page_numbers = [1]
        for a in soup.select("ul.pagination a[href*='page=']"):
            match = re.search(r"page=(\d+)", a.get("href", ""))
            if match:
                page_numbers.append(int(match.group(1)))
        return max(page_numbers)

    def _parse_product(self, url: str) -> Iterator[RawOffer]:
        response = self.fetcher.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")

        title_el = soup.select_one("h1")
        raw_title = title_el.get_text(strip=True) if title_el else url

        image_el = soup.select_one("img[src*='/image/cache/catalog/']")
        image_url = urljoin(url, image_el["src"]) if image_el else None

        cart_button = soup.select_one("#button-cart")
        base_price = _parse_toman(cart_button.get_text()) if cart_button else None
        in_stock = cart_button is not None

        tier_select = self._find_tier_select(soup)

        if tier_select is None or base_price is None:
            if base_price is None:
                return
            # Verified against a 500-game independent reference sample: pspro's
            # tier-less "بازی PS5" listings are, without exception, physical
            # discs. "warehouse_id" being "آنلاین"-only is NOT a reliable
            # digital signal — it can also mean "shipped by mail from the
            # central warehouse" rather than "delivered digitally", so it was
            # dropped as a discriminator. Own-account digital purchases aren't
            # a real product on this seller (Iran has no official PSN store),
            # so there's currently no path that yields OWN_ACCOUNT_GAME here.
            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=raw_title,
                product_type=ProductType.DISC,
                price_toman=base_price,
                tier=None,
                in_stock=in_stock,
                image_url=image_url,
            )
            return

        for option in tier_select.select("option"):
            if not option.get("value"):
                continue
            label = option.get_text(separator=" ", strip=True)
            tier = _tier_from_label(label)
            if tier is None:
                continue
            delta_match = re.search(r"([+-])\s*([\d,]+)\s*تومان", label)
            delta = int(delta_match.group(2).replace(",", "")) if delta_match else 0
            if delta_match and delta_match.group(1) == "-":
                delta = -delta

            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=raw_title,
                product_type=ProductType.ACCOUNT_GAME,
                price_toman=base_price + delta,
                tier=tier,
                in_stock=in_stock,
                image_url=image_url,
            )

    @staticmethod
    def _find_tier_select(soup: BeautifulSoup):
        for select in soup.select('select[name^="option["]'):
            if any(word in select.get_text() for word in TIER_WORDS):
                return select
        return None
