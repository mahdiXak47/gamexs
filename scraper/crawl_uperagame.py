"""Scrape Upera Game PS5 game and PlayStation Plus offers with Crawl4AI.

Game output is compatible with ``gamexs_scraper.export_csv.load_cached_offers``
and intentionally contains no image fields.  Game offers distinguish regular
capacity tiers, full-capacity/own-account offers, and physical discs.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit

from bs4 import BeautifulSoup

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
            "raw_title": title,
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


async def crawl_pages(category_url: str, category: str, category_is_ps5: bool, max_pages: int, concurrency: int) -> tuple[dict[str, tuple[str, bool]], list[Any], list[str]]:
    from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig, HTTPCrawlerConfig
    from crawl4ai.async_crawler_strategy import AsyncHTTPCrawlerStrategy
    from crawl4ai.async_dispatcher import SemaphoreDispatcher

    http_config = HTTPCrawlerConfig(
        headers={"User-Agent": "Mozilla/5.0 (compatible; GameXS Upera scraper)", "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8"},
        follow_redirects=True,
    )
    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=0,
        page_timeout=45000,
        mean_delay=0.5,
        max_range=0.5,
        semaphore_count=concurrency,
        verbose=False,
    )
    dispatcher = SemaphoreDispatcher(max_session_permit=concurrency)
    products: dict[str, tuple[str, bool]] = {}
    failures: list[str] = []
    async with AsyncWebCrawler(crawler_strategy=AsyncHTTPCrawlerStrategy(browser_config=http_config)) as crawler:
        for page in range(1, max_pages + 1):
            page_url = category_url if page == 1 else urljoin(category_url, f"page/{page}/")
            result = await crawler.arun(page_url, config=config)
            if not result.success:
                error = result.error_message or "crawl failed"
                if result.status_code == 404 or "HTTP 404" in error:
                    break
                failures.append(f"{page_url}: {error}")
                break
            urls = extract_product_links(result.html or "", page_url)
            before = len(products)
            for url in urls:
                products.setdefault(url, (category, category_is_ps5))
            if not urls or len(products) == before:
                break
        results: list[Any] = []
        urls = list(products)
        for start in range(0, len(urls), concurrency * 10):
            batch = urls[start : start + concurrency * 10]
            results.extend(await crawler.arun_many(batch, config=config, dispatcher=dispatcher))
    return products, results, failures


async def scrape(args: argparse.Namespace) -> dict[str, Any]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    product_context: dict[str, tuple[str, bool]] = {}
    all_results: dict[str, Any] = {}
    failures: list[str] = []
    category_pages: dict[str, int] = {}
    for category, url, ps5 in CATEGORIES:
        products, results, category_failures = await crawl_pages(url, category, ps5, args.max_pages, args.concurrency)
        category_pages[category] = len(products)
        failures.extend(category_failures)
        for product_url, context in products.items():
            product_context.setdefault(product_url, context)
        for result in results:
            all_results[canonical_url(result.url)] = result

    games: list[dict[str, Any]] = []
    plus: list[dict[str, Any]] = []
    rejections: list[str] = []
    for url, (category, category_is_ps5) in product_context.items():
        result = all_results.get(url)
        if result is None:
            failures.append(f"{url}: no Crawl4AI result returned")
            continue
        if not result.success:
            failures.append(f"{url}: {result.error_message or 'crawl failed'}")
            continue
        parsed, rejected = parse_product(result.html or "", url, category, category_is_ps5, scraped_at)
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
    try:
        print(json.dumps(asyncio.run(scrape(args)), ensure_ascii=False, indent=2))
    except ImportError as exc:
        raise SystemExit("Crawl4AI is required; install scraper/requirements-crawl4ai.txt") from exc


if __name__ == "__main__":
    main()
