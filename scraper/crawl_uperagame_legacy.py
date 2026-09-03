"""Scrape Upera Game's PS5 games and PlayStation Plus catalog with Crawl4AI.

The site is WooCommerce/WoodMart. Crawl4AI fetches category and product pages;
the parsing below deliberately stays deterministic because prices, stock, and
capacity are financial/catalog data.

Usage (from the repository root):
    PYTHONPATH=crawl4ai /tmp/gamexs-crawl4ai-bench/bin/python \
        scraper/crawl_uperagame.py --output-dir scraper/output

Outputs:
    uperagame_offers.jsonl   Game offers, one record per capacity variation.
    uperagame_ps_plus.jsonl  PS Plus offers, one record per term/capacity.
    uperagame_report.json    Counts and bounded fetch/rejection diagnostics.
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
GAME_CATEGORY_URL = urljoin(BASE_URL, "legal-game-accounts/")
PLUS_CATEGORY_URL = urljoin(BASE_URL, "legal-plus/")
SELLER = "uperagame"

_DIGIT_TRANSLATION = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
_CAPACITY_RE = re.compile(r"(?:capacity|ظرفیت)\s*[-_ ]*([123])", re.IGNORECASE)
_FULL_CAPACITY_RE = re.compile(r"(?:full|کامل)", re.IGNORECASE)
_PLUS_TERM_RE = re.compile(r"(?P<number>\d+)\s*(?P<unit>month|months|ماه|year|years|سال)", re.IGNORECASE)


def canonical_url(url: str) -> str:
    """Remove fragments and tracking/query state from a product URL."""
    parts = urlsplit(urljoin(BASE_URL, url))
    path = parts.path or "/"
    if path != "/" and not path.endswith("/"):
        path += "/"
    return urlunsplit((parts.scheme, parts.netloc.lower(), path, "", ""))


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").translate(_DIGIT_TRANSLATION).split())


def _normalized_attr(value: Any) -> str:
    return re.sub(r"[\s\-_]+", "", unquote(_clean_text(value))).lower()


def _decode_attributes(attributes: dict[str, Any]) -> dict[str, str]:
    return {unquote(str(key)): unquote(str(value)) for key, value in attributes.items()}


def parse_toman(value: Any) -> int | None:
    """Parse a WooCommerce numeric price or a formatted Toman string."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        price = int(round(value))
        return price if price > 0 else None

    text = _clean_text(value).replace("٬", "").replace(",", "").replace(".", "")
    digits = re.sub(r"[^0-9]", "", text)
    if not digits:
        return None
    price = int(digits)
    return price if price > 0 else None


def capacity_from_value(value: Any) -> str | None:
    normalized = _normalized_attr(value)
    if _FULL_CAPACITY_RE.search(normalized):
        return "capacity_1"
    match = _CAPACITY_RE.search(normalized)
    return f"capacity_{match.group(1)}" if match else None


def platform_is_ps5(value: Any, *, category_is_ps5: bool) -> bool:
    """Keep explicit PS5/cross-generation values and verified empty values."""
    normalized = _normalized_attr(value)
    if not normalized:
        return category_is_ps5
    if "ps4" in normalized and "ps5" not in normalized:
        return False
    if any(token in normalized for token in ("ps5", "پلیاستیشن5")):
        return True
    return False


def plus_tier_from_title(title: str, url: str) -> str | None:
    text = f"{title} {url}".lower()
    if "essential" in text or "اسنشیال" in text or "اسنشال" in text:
        return "essential"
    if "premium" in text or "پرمیوم" in text:
        return "premium"
    if "extra" in text or "اکسترا" in text:
        return "extra"
    # Some Iranian sellers call the current premium tier Deluxe.
    if "deluxe" in text or "دلوکس" in text:
        return "premium"
    return None


def plus_term_from_value(value: Any) -> str:
    raw = unquote(_clean_text(value)).lower()
    match = _PLUS_TERM_RE.search(raw)
    if match:
        return f"{match.group('number')}{match.group('unit')}"
    return raw or "unknown"


def extract_product_links(html: str, base_url: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "lxml")
    found: dict[str, dict[str, str]] = {}
    for card in soup.select(".wd-product"):
        link = card.select_one("h3 a[href], .wd-product-img-link[href]")
        if not link:
            continue
        url = canonical_url(urljoin(base_url, link.get("href", "")))
        parts = urlsplit(url)
        if parts.netloc != "uperagame.com" or parts.path in {"/", "/shop/"}:
            continue
        title = _clean_text(link.get_text(" ", strip=True))
        image = card.select_one("img[src]")
        found[url] = {
            "url": url,
            "title": title,
            "image_url": urljoin(base_url, image.get("src")) if image else "",
        }
    return list(found.values())


def parse_product_page(html: str, url: str, kind: str, scraped_at: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse one Upera product page into game or PS Plus offer objects."""
    soup = BeautifulSoup(html, "lxml")
    title_element = soup.select_one("h1.product_title, h1")
    raw_title = _clean_text(title_element.get_text(" ", strip=True) if title_element else url)
    image_element = soup.select_one(".woocommerce-product-gallery img[src], .product img[src]")
    image_url = urljoin(url, image_element.get("src")) if image_element else None
    form = soup.select_one("form.variations_form[data-product_variations]")
    if not form:
        return [], [f"{url}: no variation JSON"]

    try:
        variations = json.loads(form.get("data-product_variations") or "[]")
    except (TypeError, json.JSONDecodeError):
        return [], [f"{url}: invalid variation JSON"]

    if not isinstance(variations, list):
        return [], [f"{url}: variation JSON is not an array"]

    offers: list[dict[str, Any]] = []
    rejections: list[str] = []
    plus_tier = plus_tier_from_title(raw_title, url)
    if kind == "plus" and not plus_tier:
        return [], [f"{url}: not a PlayStation Plus product"]
    for variation in variations:
        if not isinstance(variation, dict):
            rejections.append(f"{url}: non-object variation")
            continue
        attrs = _decode_attributes(variation.get("attributes") or {})
        platform = attrs.get("attribute_pa_platform", "")
        if not platform_is_ps5(platform, category_is_ps5=True):
            continue

        price = parse_toman(variation.get("display_price"))
        if price is None:
            rejections.append(f"{url}: variation {variation.get('variation_id')} has no positive Toman price")
            continue

        capacity = capacity_from_value(attrs.get("attribute_pa_capacity-type", ""))
        if not capacity:
            rejections.append(f"{url}: variation {variation.get('variation_id')} has no recognized capacity")
            continue

        in_stock = bool(variation.get("is_in_stock")) and bool(variation.get("is_purchasable", True))
        variation_image = variation.get("image") or {}
        offer_image = variation_image.get("src") if isinstance(variation_image, dict) else None
        common = {
            "seller": SELLER,
            "source_url": url,
            "raw_title": raw_title,
            "price_toman": price,
            "in_stock": in_stock,
            "image_url": urljoin(url, offer_image) if offer_image else image_url,
            "variation_id": variation.get("variation_id"),
            "platform": unquote(platform),
            "scraped_at": scraped_at,
        }
        if kind == "games":
            offers.append({
                **{key: common[key] for key in (
                    "seller", "source_url", "raw_title", "price_toman",
                    "in_stock", "image_url", "scraped_at",
                )},
                "product_type": "account_game",
                "tier": capacity,
            })
        elif kind == "plus":
            if not plus_tier:
                rejections.append(f"{url}: could not identify PS Plus tier")
                continue
            offers.append({
                **common,
                "offer_kind": "ps_plus",
                "plus_tier": plus_tier,
                "capacity": capacity,
                "term": plus_term_from_value(attrs.get("attribute_pa_plus-time", "")),
            })
    return offers, rejections


def _result_html(result: Any) -> str:
    return result.html or ""


async def crawl_catalog(category_url: str, kind: str, *, max_pages: int, concurrency: int) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """Discover all product URLs in a seller category using Crawl4AI."""
    from crawl4ai import AsyncWebCrawler, CacheMode, CrawlerRunConfig, HTTPCrawlerConfig
    from crawl4ai.async_crawler_strategy import AsyncHTTPCrawlerStrategy
    from crawl4ai.async_dispatcher import SemaphoreDispatcher

    http_config = HTTPCrawlerConfig(
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; GameXS Upera research)",
            "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        },
        follow_redirects=True,
    )
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        word_count_threshold=0,
        mean_delay=0.5,
        max_range=0.5,
        semaphore_count=concurrency,
        verbose=False,
    )
    dispatcher = SemaphoreDispatcher(max_session_permit=concurrency)
    products: dict[str, dict[str, str]] = {}
    failures: list[str] = []
    pages_crawled = 0

    async with AsyncWebCrawler(
        crawler_strategy=AsyncHTTPCrawlerStrategy(browser_config=http_config)
    ) as crawler:
        for page in range(1, max_pages + 1):
            page_url = category_url if page == 1 else urljoin(category_url, f"page/{page}/")
            result = await crawler.arun(page_url, config=run_config)
            pages_crawled += 1
            if not result.success:
                error = result.error_message or "crawl failed"
                # Crawl4AI surfaces a normal WooCommerce pagination boundary
                # as an HTTP error rather than an empty page.
                if result.status_code == 404 or "HTTP 404" in error:
                    break
                failures.append(f"{page_url}: {error}")
                break
            page_products = extract_product_links(_result_html(result), page_url)
            before = len(products)
            products.update({item["url"]: item for item in page_products})
            if not page_products or len(products) == before:
                break

        product_urls = list(products)
        # Fetching product pages in batches keeps the crawl bounded while still
        # using Crawl4AI's dispatcher for concurrency and per-request spacing.
        product_results: dict[str, Any] = {}
        for start in range(0, len(product_urls), concurrency * 10):
            batch = product_urls[start : start + concurrency * 10]
            results = await crawler.arun_many(batch, config=run_config, dispatcher=dispatcher)
            product_results.update({canonical_url(result.url): result for result in results})

    return list(products.values()), {
        "category_url": category_url,
        "kind": kind,
        "pages_crawled": pages_crawled,
        "products_discovered": len(products),
        "product_results": product_results,
        "failures": failures,
    }


async def scrape(args: argparse.Namespace) -> dict[str, Any]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    game_products, game_meta = await crawl_catalog(
        GAME_CATEGORY_URL, "games", max_pages=args.max_pages, concurrency=args.concurrency
    )
    plus_products, plus_meta = await crawl_catalog(
        PLUS_CATEGORY_URL, "plus", max_pages=args.max_pages, concurrency=args.concurrency
    )

    game_offers: list[dict[str, Any]] = []
    plus_offers: list[dict[str, Any]] = []
    rejections: list[str] = []
    fetch_failures: list[str] = []
    for meta, products in ((game_meta, game_products), (plus_meta, plus_products)):
        fetch_failures.extend(meta["failures"])
        product_urls = [item["url"] for item in products]
        results = meta["product_results"]
        for url in product_urls:
            result = results.get(url)
            if result is None:
                fetch_failures.append(f"{url}: no Crawl4AI result returned")
                continue
            if not result.success:
                fetch_failures.append(f"{url}: {result.error_message or 'crawl failed'}")
                continue
            offers, rejected = parse_product_page(
                _result_html(result), url, meta["kind"], scraped_at
            )
            rejections.extend(rejected)
            if meta["kind"] == "games":
                game_offers.extend(offers)
            else:
                plus_offers.extend(offers)

    # Keep one record per source URL + variation + offer type. This protects
    # against repeated cards or duplicated WooCommerce variation entries.
    def dedupe(items: list[dict[str, Any]], keys: tuple[str, ...]) -> list[dict[str, Any]]:
        seen: set[tuple[Any, ...]] = set()
        result: list[dict[str, Any]] = []
        for item in items:
            key = tuple(item.get(field) for field in keys)
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result

    game_offers = dedupe(game_offers, ("source_url", "variation_id", "product_type", "tier"))
    plus_offers = dedupe(plus_offers, ("source_url", "variation_id", "plus_tier", "term", "capacity"))

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    write_jsonl(output_dir / "uperagame_offers.jsonl", game_offers)
    write_jsonl(output_dir / "uperagame_ps_plus.jsonl", plus_offers)
    report = {
        "seller": SELLER,
        "scraped_at": scraped_at,
        "output_files": {
            "games": str((output_dir / "uperagame_offers.jsonl").resolve()),
            "ps_plus": str((output_dir / "uperagame_ps_plus.jsonl").resolve()),
            "report": str((output_dir / "uperagame_report.json").resolve()),
        },
        "game": {
            "pages_crawled": game_meta["pages_crawled"],
            "products_discovered": len(game_products),
            "offers": len(game_offers),
        },
        "ps_plus": {
            "pages_crawled": plus_meta["pages_crawled"],
            "products_discovered": len(plus_products),
            "offers": len(plus_offers),
        },
        "fetch_failures": fetch_failures[:100],
        "rejections": rejections[:100],
        "fetch_failure_count": len(fetch_failures),
        "rejection_count": len(rejections),
    }
    (output_dir / "uperagame_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return report


def write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    path.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", default="scraper/output")
    parser.add_argument("--max-pages", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    if args.max_pages < 1 or args.concurrency < 1:
        parser.error("--max-pages and --concurrency must be positive")
    try:
        report = asyncio.run(scrape(args))
    except ImportError as exc:
        print(
            "Crawl4AI is required. Install scraper/requirements-crawl4ai.txt "
            "or set PYTHONPATH to the Crawl4AI checkout.",
            file=sys.stderr,
        )
        raise SystemExit(2) from exc
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
