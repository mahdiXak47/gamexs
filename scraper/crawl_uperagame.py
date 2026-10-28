"""Scrape Upera Game PS5 game and PlayStation Plus offers over plain HTTP.

Game output is compatible with ``gamexs_scraper.export_csv.load_cached_offers``
and intentionally contains no image fields.  Game offers distinguish regular
capacity tiers, full-capacity/own-account offers, and physical discs.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

from gamexs_scraper.base import title_with_edition

BASE_URL = "https://uperagame.com/"
SELLER = "uperagame"
CATEGORIES = (
    ("games", urljoin(BASE_URL, "legal-game-accounts/"), True),
    ("plus", urljoin(BASE_URL, "legal-plus/"), True),
    # The all-products catalog catches future disc products that are not placed
    # in the legal-account category. Product URLs are deduplicated globally.
    ("all", urljoin(BASE_URL, "shop/"), False),
)

_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_CAPACITY_RE = re.compile(r"(?:capacity|ظرفیت)\s*[-_ ]*([123])", re.IGNORECASE)
_FULL_RE = re.compile(r"(?:full|کامل)", re.IGNORECASE)
_DISC_RE = re.compile(r"(?:disc|disk|دیسک|فیزیکی|بلوری)", re.IGNORECASE)
_TERM_RE = re.compile(r"(?P<number>\d+)\s*(?P<unit>month|months|ماه|year|years|سال)", re.IGNORECASE)


def canonical_url(url: str) -> str:
    parts = urlsplit(urljoin(BASE_URL, url))
    path = parts.path or "/"
    if path != "/" and not path.endswith("/"):
        path += "/"
    return urlunsplit((parts.scheme, parts.netloc.lower(), path, "", ""))


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").translate(_DIGITS).split())


def normalized(value: Any) -> str:
    return re.sub(r"[\s\-_]+", "", unquote(clean_text(value))).lower()


def parse_toman(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        value = int(round(value))
    else:
        value = re.sub(r"[^0-9]", "", clean_text(value).replace(",", "").replace("٬", "").replace(".", ""))
        if not value:
            return None
        value = int(value)
    return value if value > 0 else None


def capacity_from_value(value: Any) -> str | None:
    match = _CAPACITY_RE.search(normalized(value))
    return f"capacity_{match.group(1)}" if match else None


def is_full_capacity(value: Any) -> bool:
    return bool(_FULL_RE.search(normalized(value)))


def is_disc(value: Any) -> bool:
    return bool(_DISC_RE.search(normalized(value)))


def classify_game(attrs: dict[str, str], title: str) -> tuple[str, str | None] | None:
    if any(is_disc(value) for value in (title, *attrs.values())):
        return "disc", None
    capacity_value = attrs.get("attribute_pa_capacity-type", "")
    if is_full_capacity(capacity_value) or is_full_capacity(title):
        return "own_account_game", None
    capacity = capacity_from_value(capacity_value)
    return ("account_game", capacity) if capacity else None


def platform_is_ps5(value: Any, category_is_ps5: bool) -> bool:
    value = normalized(value)
    if not value:
        return category_is_ps5
    if "ps4" in value and "ps5" not in value:
        return False
    return "ps5" in value or "پلیاستیشن5" in value


def plus_tier(title: str, url: str) -> str | None:
    text = f"{title} {url}".lower()
    for name, values in (
        ("essential", ("essential", "اسنشیال", "اسنشال")),
        ("extra", ("extra", "اکسترا")),
        ("premium", ("premium", "پرمیوم", "deluxe", "دلوکس")),
    ):
        if any(value in text for value in values):
            return name
    return None


def plus_term(value: Any) -> str:
    raw = unquote(clean_text(value)).lower()
    match = _TERM_RE.search(raw)
    return f"{match.group('number')}{match.group('unit')}" if match else raw or "unspecified"


def extract_product_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    urls: set[str] = set()
    for card in soup.select(".wd-product"):
        link = card.select_one("h3 a[href], .wd-product-img-link[href]")
        if not link:
            continue
        url = canonical_url(urljoin(base_url, link["href"]))
        parts = urlsplit(url)
        if parts.netloc == "uperagame.com" and parts.path not in {"/", "/shop/"}:
            urls.add(url)
    return sorted(urls)


def parse_product(html: str, url: str, category: str, category_is_ps5: bool, scraped_at: str) -> tuple[list[dict[str, Any]], list[str]]:
    soup = BeautifulSoup(html, "lxml")
    title_node = soup.select_one("h1.product_title, h1")
    title = clean_text(title_node.get_text(" ", strip=True) if title_node else url)
    page_is_ps5 = category_is_ps5 or bool(re.search(r"ps\s*5|پلی\s*استیشن\s*5", title, re.IGNORECASE))
    form = soup.select_one("form.variations_form[data-product_variations]")
    if not form:
        return [], [f"{url}: no variation JSON"]
    try:
        variations = json.loads(form.get("data-product_variations") or "[]")
    except (TypeError, json.JSONDecodeError):
        return [], [f"{url}: invalid variation JSON"]
    if not isinstance(variations, list):
        return [], [f"{url}: variation JSON is not an array"]

    tier = plus_tier(title, url) if category in {"plus", "all"} else None
    if category == "plus" and not tier:
        return [], [f"{url}: not a PlayStation Plus product"]
    offers: list[dict[str, Any]] = []
    rejected: list[str] = []
    for variation in variations:
        if not isinstance(variation, dict):
            rejected.append(f"{url}: non-object variation")
            continue
        attrs = {unquote(str(k)): unquote(str(v)) for k, v in (variation.get("attributes") or {}).items()}
        if not platform_is_ps5(attrs.get("attribute_pa_platform", ""), page_is_ps5):
            continue
        price = parse_toman(variation.get("display_price"))
        if price is None:
            rejected.append(f"{url}: variation {variation.get('variation_id')} has no positive price")
            continue
        stock = bool(variation.get("is_in_stock")) and bool(variation.get("is_purchasable", True))
        common = {
            "seller": SELLER,
            "source_url": url,
            # "pa_version-type": standard / ultimate on one GTA VI page.
            "raw_title": title_with_edition(title, attrs),
            "price_toman": price,
            "in_stock": stock,
            "scraped_at": scraped_at,
        }
        if tier:
            capacity_value = attrs.get("attribute_pa_capacity-type", "")
            capacity = "capacity_1" if is_full_capacity(capacity_value) else capacity_from_value(capacity_value)
            if not capacity:
                rejected.append(f"{url}: variation {variation.get('variation_id')} has no PS Plus capacity")
                continue
            offers.append({
                **common,
                "variation_id": variation.get("variation_id"),
                "platform": attrs.get("attribute_pa_platform", ""),
                "offer_kind": "ps_plus",
                "plus_tier": tier,
                "capacity": capacity,
                "term": plus_term(attrs.get("attribute_pa_plus-time", "")),
            })
            continue
        classification = classify_game(attrs, title)
        if classification is None:
            rejected.append(f"{url}: variation {variation.get('variation_id')} has no recognized game type")
            continue
        product_type, access_tier = classification
        offers.append({**common, "product_type": product_type, "tier": access_tier})
    return offers, rejected


HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; GameXS Upera scraper)", "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8"}
REQUEST_DELAY_SECONDS = 0.5  # per worker, matches the old Crawl4AI mean_delay
_local = threading.local()


def _session() -> requests.Session:
    # One session per worker thread; Upera is reachable directly (no env proxy).
    if not hasattr(_local, "session"):
        _local.session = requests.Session()
        _local.session.trust_env = False
        _local.session.headers.update(HEADERS)
    return _local.session


def fetch(url: str, attempts: int = 3) -> tuple[int | None, str | None, str | None]:
    """(status, html, error) — html is set only for a 200."""
    error = "not fetched"
    for attempt in range(attempts):
        time.sleep(REQUEST_DELAY_SECONDS * (attempt + 1))
        try:
            response = _session().get(url, timeout=45)
        except requests.RequestException as exc:
            error = f"{type(exc).__name__}: {exc}"
            continue
        if response.status_code == 200:
            return 200, response.content.decode("utf-8", "replace"), None
        error = f"HTTP {response.status_code}"
        if response.status_code < 500:
            return response.status_code, None, error
    return None, None, error


def discover(category_url: str, max_pages: int) -> tuple[list[str], list[str]]:
    """Product URLs of one category, following page/N/ until it stops growing."""
    urls: dict[str, None] = {}
    for page in range(1, max_pages + 1):
        page_url = category_url if page == 1 else urljoin(category_url, f"page/{page}/")
        status, html, error = fetch(page_url)
        if status == 404:
            break
        if html is None:
            return list(urls), [f"{page_url}: {error}"]
        before = len(urls)
        urls.update(dict.fromkeys(extract_product_links(html, page_url)))
        if len(urls) == before:
            break
    return list(urls), []


def scrape(args: argparse.Namespace) -> dict[str, Any]:
    # Plain HTTP + a small thread pool: each page is parsed as soon as it
    # arrives and only the offers are kept, so memory stays flat (the old
    # Crawl4AI version held every page's HTML + markdown and OOM-killed the
    # 500 MB scraper pod). Each product is fetched once even when it appears
    # in several categories.
    scraped_at = datetime.now(timezone.utc).isoformat()
    product_context: dict[str, tuple[str, bool]] = {}
    failures: list[str] = []
    category_pages: dict[str, int] = {}
    for category, url, ps5 in CATEGORIES:
        urls, category_failures = discover(url, args.max_pages)
        category_pages[category] = len(urls)
        failures.extend(category_failures)
        for product_url in urls:
            product_context.setdefault(product_url, (category, ps5))

    def crawl_one(item: tuple[str, tuple[str, bool]]) -> tuple[list[dict[str, Any]], list[str], str | None]:
        url, (category, category_is_ps5) = item
        _, html, error = fetch(url)
        if html is None:
            return [], [], f"{url}: {error}"
        parsed, rejected = parse_product(html, url, category, category_is_ps5, scraped_at)
        return parsed, rejected, None

    games: list[dict[str, Any]] = []
    plus: list[dict[str, Any]] = []
    rejections: list[str] = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        for parsed, rejected, failure in pool.map(crawl_one, product_context.items()):
            if failure:
                failures.append(failure)
            rejections.extend(rejected)
            for offer in parsed:
                (plus if offer.get("offer_kind") == "ps_plus" else games).append(offer)

    def dedupe(items: list[dict[str, Any]], keys: tuple[str, ...]) -> list[dict[str, Any]]:
        seen: set[tuple[Any, ...]] = set()
        result: list[dict[str, Any]] = []
        for item in items:
            key = tuple(item.get(field) for field in keys)
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result

    games = dedupe(games, ("source_url", "product_type", "tier", "price_toman", "in_stock"))
    plus = dedupe(plus, ("source_url", "plus_tier", "capacity", "term", "price_toman", "in_stock"))
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(output_dir / "uperagame_offers.jsonl", games)
    write_jsonl(output_dir / "uperagame_ps_plus.jsonl", plus)
    report = {
        "seller": SELLER,
        "scraped_at": scraped_at,
        "game": {"categories": category_pages, "products_discovered": len(product_context), "offers": len(games)},
        "ps_plus": {"offers": len(plus)},
        "fetch_failures": failures[:100],
        "rejections": rejections[:100],
        "fetch_failure_count": len(failures),
        "rejection_count": len(rejections),
        "output_files": {name: str((output_dir / name).resolve()) for name in (
            "uperagame_offers.jsonl", "uperagame_ps_plus.jsonl", "uperagame_report.json"
        )},
    }
    (output_dir / "uperagame_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.write_text("".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default="scraper/output")
    parser.add_argument("--max-pages", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    if args.max_pages < 1 or args.concurrency < 1:
        parser.error("--max-pages and --concurrency must be positive")
    print(json.dumps(scrape(args), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
