"""Adapter for dragon-shop.ir (WooCommerce, server-rendered).

Verified 2026-07-30:
- Account games only — no disc products.
- Category: /main/game-account/ps-account/ps5-acct/ with /page/N/ pagination, ~42 pages.
- Tier is encoded in the product title, not WooCommerce variation attributes — each
  tier is a separate simple product rather than a variation:
    "اختصاصی"       -> CAPACITY_1  (exclusive offline account)
    "ظرفیت دوم"    -> CAPACITY_2
    "ظرفیت سوم"    -> CAPACITY_3
  Products with no recognisable tier keyword are skipped.
- Price: WooCommerce standard — <ins><bdi> for the current sale price;
  first <bdi> not inside <del> for non-sale products.
- Image: og:image meta tag.
"""

import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = "https://dragon-shop.ir/main/game-account/ps-account/ps5-acct/"

_PRODUCT_HREF_RE = re.compile(r"^https://dragon-shop\.ir/product/")


def _detect_tier(title: str) -> AccessTier | None:
    if "اختصاصی" in title:
        return AccessTier.CAPACITY_1
    # handle both ی (U+06CC) and ي (U+064A) variants
    if re.search(r"ظرف[یي]ت\s+دوم", title):
        return AccessTier.CAPACITY_2
    if re.search(r"ظرف[یي]ت\s+سوم", title):
        return AccessTier.CAPACITY_3
    return None


def _parse_price(soup: BeautifulSoup) -> int | None:
    bdi = soup.select_one(".price ins bdi")
    if not bdi:
        for el in soup.select(".price span.woocommerce-Price-amount bdi"):
            if not el.find_parent("del"):
                bdi = el
                break
    if not bdi:
        return None
    digits = re.sub(r"[^\d]", "", bdi.get_text())
    return int(digits) if digits else None


class DragonShopAdapter(SellerAdapter):
    seller = "dragonshop"

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

        title_el = soup.find("h1")
        raw_title = title_el.get_text(strip=True) if title_el else url

        tier = _detect_tier(raw_title)
        if not tier:
            return

        price = _parse_price(soup)
        if not price or price <= 0:
            return

        og = soup.find("meta", property="og:image")
        image_url = og["content"] if og else None

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
