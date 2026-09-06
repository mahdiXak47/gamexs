"""Resolve a Upera Crawl4AI snapshot through IGDB, then load safe prices.

Seller pages are not allowed to create catalog identities. This command first
normalizes and resolves each distinct Upera game title to a verified PS5 IGDB
result, imports those canonical rows and aliases into both databases, and only
then appends the Upera listings and price observations. Offers without a
confident match are reported and skipped.

Usage:
    PYTHONPATH=scraper scraper/.venv/bin/python scraper/import_uperagame_catalog.py \
      --games-cache scraper/output/uperagame_offers.jsonl \
      --plus-cache scraper/output/uperagame_ps_plus.jsonl \
      --local-db-url "$LOCAL_DATABASE_URL" \
      --production-db-url "$PRODUCTION_DATABASE_URL"
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from collections import defaultdict

import psycopg
import requests
from dotenv import load_dotenv

from add_game import _ALIAS_SCHEMA_SQL, _metadata, _upsert_aliases, _upsert_game
from gamexs_scraper.enrich_metadata import (
    _MAIN_CATEGORIES,
    _english_title,
    _igdb_by_slug,
    _igdb_search,
    _has_ps5,
    _pick_best,
    _search_title,
    _search_title_direct,
    _score,
    _title_is_compatible,
    _edition_keywords,
    get_access_token,
)
from gamexs_scraper.export_csv import load_cached_offers
from gamexs_scraper.load_to_postgres import load_offers, url_slugify
from gamexs_scraper.models import RawOffer
from gamexs_scraper.normalize import clean_title, normalize_game_name
from load_uperagame_to_postgres import load_plus_cache, load_plus_offers


_PS4_RE = re.compile(r"(?:\bps4\b|پلی\s*استیشن\s*4)", re.IGNORECASE)
_PS5_RE = re.compile(r"(?:\bps5\b|پلی\s*استیشن\s*5)", re.IGNORECASE)
_PERSIAN_ARABIC_RE = re.compile(r"[؀-ۿ‌‍]")
_RATE_DELAY = 0.28


def _is_ps5_offer(offer: RawOffer) -> bool:
    """Keep PS5 and cross-generation offers; reject PS4-only offers."""
    has_ps4 = bool(_PS4_RE.search(offer.raw_title))
    has_ps5 = bool(_PS5_RE.search(offer.raw_title))
    return not has_ps4 or has_ps5


def _ps5_result(
    results: list[dict], query: str, compatibility_title: str | None = None
) -> dict | None:
    """Select a PS5 main-game result compatible with the seller title."""
    ps5_results = [
        result
        for result in results
        if _has_ps5(result)
        and (
            result.get("category") is None
            or result.get("category") in _MAIN_CATEGORIES
        )
    ]
    if compatibility_title:
        ps5_results = [
            result
            for result in ps5_results
            if _title_is_compatible(compatibility_title, result.get("name", ""))
        ]
    return _pick_best(ps5_results, query)


def _resolve_candidate(session: requests.Session, candidate: str) -> dict | None:
    """Resolve one normalized seller candidate to a complete IGDB game result."""
    query = _search_title(candidate)
    if not query:
        return None

    results = _igdb_search(session, query)
    time.sleep(_RATE_DELAY)
    best = _ps5_result(results, query, candidate)

    # A clean slug is more reliable than a search result dominated by DLC or
    # subtitle entries. Keep the same fallback used by metadata enrichment.
    if not best:
        slug = url_slugify(normalize_game_name(query.replace("'", "")))
        fallback = _igdb_by_slug(session, slug)
        time.sleep(_RATE_DELAY)
        if (
            fallback
            and _has_ps5(fallback)
            and (
                fallback.get("category") is None
                or fallback.get("category") in _MAIN_CATEGORIES
            )
            and _title_is_compatible(candidate, fallback.get("name", ""))
        ):
            if _score(fallback, query) >= 0.65:
                best = fallback

    # Sellers frequently include an edition. The base-game search intentionally
    # strips that suffix, so run a second full-title search to avoid attaching
    # Deluxe/Ultimate/Remastered prices to the base row.
    distinct_edition = _edition_keywords(candidate)
    if best and _search_title_direct(candidate).lower() != query.lower():
        direct_query = _search_title_direct(candidate)
        direct_results = _igdb_search(session, direct_query)
        time.sleep(_RATE_DELAY)
        direct_best = _ps5_result(direct_results, direct_query, candidate)
        if direct_best:
            direct_name = direct_best.get("name", "").lower()
            direct_keywords = {
                keyword for keyword in distinct_edition if keyword in direct_name
            }
            if distinct_edition and not direct_keywords:
                direct_best = None
        if direct_best:
            best = direct_best
        elif distinct_edition:
            # Never silently attach an edition price to the base-game row.
            return None

    if not best:
        # One retry handles seller suffixes that IGDB does not know.
        shorter = " ".join(query.split()[:-1])
        if shorter:
            shorter_results = _igdb_search(session, shorter)
            time.sleep(_RATE_DELAY)
            best = _ps5_result(shorter_results, shorter, candidate)

    if not best:
        return None
    if not _title_is_compatible(candidate, best.get("name", "")):
        return None
    if distinct_edition and not any(
        keyword in best.get("name", "").lower() for keyword in distinct_edition
    ):
        return None
    category = best.get("category")
    if category is not None and category not in _MAIN_CATEGORIES:
        return None
    canonical_title = _english_title(best.get("name", ""))
    if not canonical_title or _PERSIAN_ARABIC_RE.search(canonical_title):
        return None
    return best


def _catalog_preflight(cur: psycopg.Cursor) -> None:
    cur.execute(
        """
        SELECT COUNT(*)
        FROM ps5_games
        WHERE igdb_id IS NULL OR title ~ '[^[:ascii:]]'
        """
    )
    invalid_count = cur.fetchone()[0]
    if invalid_count:
        raise ValueError(
            f"catalog preflight failed: {invalid_count} existing ps5_games rows "
            "need IGDB/title repair before Upera import"
        )


def _import_database(
    database_url: str,
    results: dict[str, dict],
    offers: list[RawOffer],
    plus_records: list[dict],
) -> tuple[int, int, int, int]:
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        _catalog_preflight(cur)
        cur.execute(_ALIAS_SCHEMA_SQL)
        cur.execute(
            "CREATE INDEX IF NOT EXISTS ps5_game_aliases_game_id_idx "
            "ON ps5_game_aliases (game_id)"
        )
        cur.execute("SELECT id FROM platforms WHERE slug = 'ps5'")
        platform = cur.fetchone()
        cur.execute("SELECT id FROM sellers WHERE slug = 'uperagame'")
        seller = cur.fetchone()
        if not platform or not seller:
            raise ValueError("ps5 platform or uperagame seller is missing; apply migrations first")

        imported_ids: dict[str, int] = {}
        for candidate, result in results.items():
            metadata = _metadata(result)
            game_id = _upsert_game(cur, platform[0], metadata)
            _upsert_aliases(
                cur,
                platform[0],
                game_id,
                [candidate, result.get("name", ""), result.get("slug", "").replace("-", " ")],
            )
            imported_ids[candidate] = game_id

        games_count, listings_count = load_offers(
            cur, platform[0], seller[0], "uperagame", offers
        )
        plus_count = load_plus_offers(cur, seller[0], plus_records)
        conn.commit()
        return len(imported_ids), games_count, listings_count, plus_count


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--games-cache", required=True)
    parser.add_argument("--plus-cache", required=True)
    parser.add_argument("--local-db-url", default=None)
    parser.add_argument("--production-db-url", default=None)
    parser.add_argument(
        "--rejected-output",
        default="/tmp/uperagame_igdb_rejections.txt",
        help="write unresolved/invalid candidates here",
    )
    args = parser.parse_args()

    local_url = args.local_db_url or os.environ.get("LOCAL_DATABASE_URL")
    production_url = args.production_db_url or os.environ.get("PRODUCTION_DATABASE_URL")
    client_id = os.environ.get("IGDB_CLIENT_ID")
    client_secret = os.environ.get("IGDB_CLIENT_SECRET")
    if not local_url or not production_url:
        sys.exit("both local and production database URLs are required")
    if not client_id or not client_secret:
        sys.exit("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are required")

    offers = load_cached_offers(args.games_cache)
    plus_records = load_plus_cache(args.plus_cache)
    grouped: dict[str, list[RawOffer]] = defaultdict(list)
    rejected: list[str] = []
    for offer in offers:
        if not _is_ps5_offer(offer):
            rejected.append(f"PS4-only: {offer.raw_title}")
            continue
        candidate = clean_title(offer.raw_title)
        if not candidate or _PERSIAN_ARABIC_RE.search(candidate):
            rejected.append(f"invalid normalized title: {offer.raw_title} -> {candidate!r}")
            continue
        grouped[normalize_game_name(candidate)].append(offer)

    token = get_access_token(client_id, client_secret)
    session = requests.Session()
    session.headers.update({
        "Client-ID": client_id,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    })

    resolved: dict[str, dict] = {}
    loadable: list[RawOffer] = []
    for candidate, candidate_offers in sorted(grouped.items()):
        try:
            result = _resolve_candidate(session, candidate)
        except requests.RequestException as exc:
            result = None
            rejected.append(f"IGDB request error: {candidate}: {exc}")
        if not result:
            rejected.append(f"no confident PS5 IGDB match: {candidate}")
            continue
        resolved[candidate] = result
        loadable.extend(candidate_offers)
        print(f"{candidate} -> igdb:{result['id']} {result['name']}")

    with open(args.rejected_output, "w", encoding="utf-8") as report:
        report.write("\n".join(rejected))
        if rejected:
            report.write("\n")

    if not resolved:
        sys.exit("no safe Upera game offers resolved; nothing was written")

    for database_url in (local_url, production_url):
        counts = _import_database(database_url, resolved, loadable, plus_records)
        print(
            f"loaded {database_url.rsplit('@', 1)[-1]} — "
            f"{counts[0]} canonical games, {counts[1]} games seen, "
            f"{counts[2]} listings, {len(loadable)} game prices, "
            f"{counts[3]} PS Plus identities, {len(plus_records)} PS Plus prices"
        )

    print(f"rejected {len(rejected)} offers/candidates; report: {args.rejected_output}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, psycopg.Error, requests.RequestException) as exc:
        sys.exit(f"ERROR: {exc}")
