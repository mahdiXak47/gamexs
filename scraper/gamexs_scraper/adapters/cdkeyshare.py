"""Adapter for cdkeyshare.ir (custom WooCommerce theme, server-rendered).

Verified 2026-07-09:
- Must use www.cdkeyshare.ir — non-www may not resolve through the proxy.
- Product URLs use /shop/console/<slug>/ (not /product/).
- Account games: /product-category/console/playstation/ (~37 pages, ~629 products).
  Tier from WooCommerce variations_form; attribute key انتخاب-ظرفیت;
  values contain "ظرفیت 1/2/3" as substring. May also have an edition attribute.
  Re-verified 2026-10-20: account pages also carry انتخاب-کنسول (PS4/PS5)
  and 10-day rental variants (اجاره); both are skipped.
- Disc games: /product-category/console/playstation/diskpsn/ (~2 pages, ~34 products).
  Simple products — price and stock are in the listing page row itself (no product-page
  visit needed): price in div.cost-brn-product .woocommerce-Price-amount bdi,
  stock via absence of span.out-stock.
"""

import json
import re
import sys
from collections.abc import Iterator
from urllib.parse import unquote

import requests
from bs4 import BeautifulSoup

from ..base import SellerAdapter, title_with_edition, FULL_CAPACITY, account_offer_type
from ..models import AccessTier, ProductType, RawOffer

BASE_URL = "https://www.cdkeyshare.ir"
ACCOUNT_CATEGORY_URL = f"{BASE_URL}/product-category/console/playstation/"
DISC_CATEGORY_URL = f"{BASE_URL}/product-category/console/playstation/diskpsn/"

_PRODUCT_HREF_RE = re.compile(r"^https://(?:www\.)?cdkeyshare\.ir/shop/console/")

_TIER_SUBSTRINGS = [
    ("ظرفیت کامل", FULL_CAPACITY),  # «ظرفیت کامل»: its own purchase type (base.FULL_CAPACITY)
    ("ظرفیت 1", AccessTier.CAPACITY_1),
    ("ظرفیت 2", AccessTier.CAPACITY_2),
    ("ظرفیت 3", AccessTier.CAPACITY_3),
]


def _tier_from_value(value: str) -> AccessTier | None:
    for keyword, tier in _TIER_SUBSTRINGS:
        if keyword in value:
            return tier
    return None


def _parse_toman(text: str) -> int | None:
    """Strip commas, the 'T' currency symbol, and whitespace; return int."""
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


class CdkeyShareAdapter(SellerAdapter):
    seller = "cdkeyshare"
    product_workers = 3  # pages take 2–4 s to answer (measured 2026-10-29)

    def iter_listings(self) -> Iterator[RawOffer]:
        # Disc: parse entirely from listing rows — no product-page visits needed.
        yield from self._iter_disc_from_listing()

        # Account: visit each product page to extract per-tier variation prices.
        yield from self.crawl(self._iter_account_urls(), self._parse_account)

    def _iter_disc_from_listing(self) -> Iterator[RawOffer]:
        page = 1
        while True:
            url = DISC_CATEGORY_URL if page == 1 else f"{DISC_CATEGORY_URL}page/{page}/"
            try:
                resp = self.fetcher.get(url)
            except requests.exceptions.RequestException as exc:
                print(f"disc: stopping at page {page}: {exc}", file=sys.stderr)
                break

            if resp.status_code == 404:
                break
            resp.raise_for_status()

            soup = BeautifulSoup(resp.content, "lxml")
            found_any = False
            for row in soup.select("div.package-product-row"):
                a = row.select_one("a.cover[href]")
                if not a:
                    continue
                source_url = a["href"].rstrip("/") + "/"
                if not _PRODUCT_HREF_RE.match(source_url):
                    continue

                price_el = row.select_one("div.cost-brn-product .woocommerce-Price-amount bdi")
                if not price_el:
                    continue
                price_toman = _parse_toman(price_el.get_text(strip=True))
                if not price_toman:
                    continue

                in_stock = row.select_one("span.out-stock") is None

                title_el = row.select_one("h2.t-bold a span.title") or row.select_one("h2 a")
                raw_title = title_el.get_text(strip=True) if title_el else source_url

                img = row.select_one("img")
                image_url = img.get("src") if img else None

                # Skip PS4-only discs (PS5-exclusive or cross-gen are fine)
                title_lower = raw_title.lower()
                if "ps4" in title_lower and "ps5" not in title_lower:
                    continue

                found_any = True
                yield RawOffer(
                    seller=self.seller,
                    source_url=source_url,
                    raw_title=raw_title,
                    product_type=ProductType.DISC,
                    price_toman=price_toman,
                    tier=None,
                    in_stock=in_stock,
                    image_url=image_url,
                )

            if not found_any:
                break
            page += 1

    def _iter_account_urls(self) -> Iterator[str]:
        seen: set[str] = set()
        page = 1
        while True:
            url = ACCOUNT_CATEGORY_URL if page == 1 else f"{ACCOUNT_CATEGORY_URL}page/{page}/"
            try:
                resp = self.fetcher.get(url)
            except requests.exceptions.RequestException as exc:
                print(f"account: stopping at page {page}: {exc}", file=sys.stderr)
                break

            if resp.status_code == 404:
                break
            resp.raise_for_status()

            soup = BeautifulSoup(resp.content, "lxml")
            found_any = False
            for row in soup.select("div.package-product-row"):
                a = row.select_one("a.cover[href]")
                if not a:
                    continue
                href = a["href"].rstrip("/") + "/"
                if not _PRODUCT_HREF_RE.match(href):
                    continue
                if href not in seen:
                    seen.add(href)
                    found_any = True
                    yield href

            if not found_any:
                break
            page += 1

    def _parse_account(self, url: str) -> Iterator[RawOffer]:
        resp = self.fetcher.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "lxml")

        title_el = soup.find("h1")
        raw_title = title_el.get_text(strip=True) if title_el else url

        img_el = soup.select_one(".woocommerce-product-gallery__wrapper img[data-large_image]")
        image_url = img_el["data-large_image"] if img_el else None
        if not image_url:
            og = soup.find("meta", property="og:image")
            image_url = og["content"] if og else None

        form = soup.find("form", class_="variations_form")
        if not form:
            return

        try:
            variations = json.loads(form.get("data-product_variations", "[]"))
        except (json.JSONDecodeError, TypeError):
            return

        if not variations:
            return

        for v in variations:
            attrs = {unquote(k): unquote(val) for k, val in v.get("attributes", {}).items()}

            # Tier key contains ظرفیت; value contains "ظرفیت 1/2/3"
            tier_value = ""
            for key, val in attrs.items():
                if "ظرفیت" in key:
                    tier_value = val
                    break

            tier = _tier_from_value(tier_value)
            if not tier:
                continue
            # Pages sell PS4 and PS5 variants of each capacity side by side;
            # a PS4 price must not land on the PS5 listing.
            console = next((val for key, val in attrs.items() if "کنسول" in key), "")
            if console and "ps5" not in console.lower():
                continue
            # "ظرفیت 3 اجاره ایی (آنلاین 10 روزه)" is a 10-day rental, not an account.
            if "اجاره" in tier_value:
                continue

            if not v.get("is_in_stock"):
                continue
            price = v.get("display_price") or 0
            if price <= 0:
                continue

            product_type, tier = account_offer_type(tier)
            yield RawOffer(
                seller=self.seller,
                source_url=url,
                raw_title=title_with_edition(raw_title, attrs),
                product_type=product_type,
                price_toman=price,
                tier=tier,
                in_stock=True,
                image_url=image_url,
            )
