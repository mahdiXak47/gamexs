"""Adapter for hajigame.ir (WooCommerce, server-rendered, simple products).

Verified 2026-07-30:
- Account games only — disc/bundle products are skipped via tier detection.
- Category: /product-category/digitalgames/game-legal-account/legal-account-ps5/
  with /page/N/ pagination, ~14 pages ~400 products.
- No WooCommerce variations — each product is a simple product; tier is encoded
  in the Persian title with multiple spelling variants:
    "ظرفیت اول" / "ظرفیت یک"  -> CAPACITY_1
    "ظرفیت دوم" / "ظرفیت دو"  -> CAPACITY_2
    "ظرفیت سوم" / "ظرفیت سه"  -> CAPACITY_3
  Products with no recognised tier, or with multiple tiers in the title
  (e.g. "ظرفیت دو / ظرفیت سه اشتراکی"), are skipped.
- Price: <div class="price single_price"><ins><bdi> for sale price;
  first <bdi> not inside <del> for non-sale products.
- Stock: button.single_add_to_cart_button present and not disabled.
- Image: og:image meta tag.
"""

import re
import sys
from collections.abc import Iterator

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter
from ..models import AccessTier, ProductType, RawOffer

CATEGORY_URL = (
    "https://hajigame.ir/product-category/"
    "digitalgames/game-legal-account/legal-account-ps5/"
)

_PRODUCT_HREF_RE = re.compile(r"^https://hajigame\.ir/product/")

# Handle both ی (U+06CC) and ي (U+064A) throughout
_RE_CAP1 = re.compile(r"ظرف[یي]ت\s+(اول|یک|[Yy]ek|1)")
_RE_CAP2 = re.compile(r"ظرف[یي]ت\s+(دوم?|دو|2)")
_RE_CAP3 = re.compile(r"ظرف[یي]ت\s+(سوم?|سه|3)")


def _detect_tier(title: str) -> AccessTier | None:
    has1 = bool(_RE_CAP1.search(title))
    has2 = bool(_RE_CAP2.search(title))
    has3 = bool(_RE_CAP3.search(title))
    if sum([has1, has2, has3]) != 1:
        return None
    if has1:
        return AccessTier.CAPACITY_1
    if has2:
        return AccessTier.CAPACITY_2
    return AccessTier.CAPACITY_3


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


def _is_in_stock(soup: BeautifulSoup) -> bool:
    btn = soup.select_one("button.single_add_to_cart_button")
    if btn is None:
        return False
    return "disabled" not in (btn.get("class") or [])


class HajiGameAdapter(SellerAdapter):
    seller = "hajigame"

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

        if not _is_in_stock(soup):
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
