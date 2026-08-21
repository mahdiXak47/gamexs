"""Fetch official PS Store prices for US and Turkey regions.

Discovers games by reading igdb_id values from the production ps5_games table,
then resolves each igdb_id to a PS Store URL via a single batched IGDB query,
and finally fetches each concept or product page for en-us and tr-tr pricing.

Usage:
    python fetch_psstore_prices.py -o psstore_prices.csv
    python fetch_psstore_prices.py -o psstore_prices.csv --limit 50
    python fetch_psstore_prices.py -o psstore_prices.csv --workers 8
    python fetch_psstore_prices.py -o psstore_prices.csv --db-url postgresql://...

DATABASE_URL env var is used when --db-url is not passed.

Output CSV columns:
    game_name, concept_id, product_id,
    us_price, us_original_price, us_discount_pct,
    tr_price, tr_original_price, tr_discount_pct,
    extra_plus_included, deluxe_plus_included, essential_plus_included
"""

import argparse
import csv
import gzip as gzip_module
import json
import logging
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, Future
from dataclasses import dataclass, fields

import psycopg

log = logging.getLogger("psstore")


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

IGDB_CLIENT_ID = "2qsedq5y7o8w7wq1o0ivmhuhabwg8u"
IGDB_CLIENT_SECRET = "5086gwpyz569ou34iz5exipusskx4h"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"

PS_STORE_BASE = "https://store.playstation.com"
LOCALES = {"us": "en-us", "tr": "tr-tr"}

IGDB_DELAY = 0.3  # seconds between IGDB batch requests

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",  # 8x smaller responses
}

# CTA sub-type constants
_CTA_BUY = "add_to_cart"
_CTA_EXTRA = "upsell_ps_plus_game_catalog"
_CTA_DELUXE = "upsell_ps_plus_classics_catalog"


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

@dataclass
class PriceInfo:
    price: str = ""
    original_price: str = ""
    discount_pct: str = ""
    extra_plus: bool = False
    deluxe_plus: bool = False


@dataclass
class GameRow:
    game_name: str
    concept_id: str
    product_id: str = ""
    ps_store_url: str = ""
    edition_name: str = ""
    store_display_classification: str = ""
    price_source: str = "concept"
    us_price: str = ""
    us_original_price: str = ""
    us_discount_pct: str = ""
    tr_price: str = ""
    tr_original_price: str = ""
    tr_discount_pct: str = ""
    extra_plus_included: bool = False
    deluxe_plus_included: bool = False
    essential_plus_included: bool = False  # no reliable per-page signal; always False


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def _http_get(url: str, timeout: int = 15) -> bytes:
    """GET with automatic gzip decompression."""
    req = urllib.request.Request(url, headers=HEADERS)
    resp = urllib.request.urlopen(req, timeout=timeout)
    raw = resp.read()
    if resp.headers.get("Content-Encoding") == "gzip":
        return gzip_module.decompress(raw)
    return raw


# ---------------------------------------------------------------------------
# IGDB helpers
# ---------------------------------------------------------------------------

def get_igdb_token() -> str:
    url = (
        f"{TWITCH_TOKEN_URL}"
        f"?client_id={IGDB_CLIENT_ID}"
        f"&client_secret={IGDB_CLIENT_SECRET}"
        f"&grant_type=client_credentials"
    )
    req = urllib.request.Request(url, method="POST", headers={"Content-Length": "0"})
    resp = urllib.request.urlopen(req, timeout=10)
    return json.loads(resp.read())["access_token"]


_IGDB_RETRIES = 3
_IGDB_TIMEOUT = 30


def _igdb_request(headers: dict, query: bytes) -> list:
    for attempt in range(_IGDB_RETRIES):
        try:
            req = urllib.request.Request(IGDB_GAMES_URL, data=query, headers=headers)
            resp = urllib.request.urlopen(req, timeout=_IGDB_TIMEOUT)
            return json.loads(resp.read())
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt < _IGDB_RETRIES - 1:
                wait = 2 ** attempt * 2
                log.warning("IGDB timeout, retrying in %ds... (%s)", wait, exc)
                time.sleep(wait)
            else:
                raise
    return []


def load_db_igdb_ids(database_url: str) -> list[tuple[str, int, int]]:
    """Return (title, igdb_id, game_id) for every ps5_games row that has an igdb_id."""
    with psycopg.connect(database_url, connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT title, igdb_id, id FROM ps5_games WHERE igdb_id IS NOT NULL ORDER BY title"
            )
            return [(row[0], row[1], row[2]) for row in cur.fetchall()]


def igdb_concept_ids_for_ids(
    token: str, db_games: list[tuple[str, int, int]]
) -> list[tuple[str, str, int]]:
    """Resolve (title, igdb_id, game_id) to (title, ps_store_concept_id, game_id).

    Batches up to 500 IGDB IDs per request. Games with no PS Store URL are dropped.

    Multiple ps5_games rows can share one igdb_id — IGDB tracks "the game" as a
    single creative work, not each retail edition (Standard/Ultimate/Deluxe...)
    separately, and its external_games list normally links only ONE PS Store
    "concept" page (which itself usually only sells the Standard/base product;
    verified against the live Cyberpunk 2077 concept page, which lists no
    Ultimate Edition SKU at all). Writing that one resolved price against every
    edition sharing the igdb_id would silently show the wrong price on all but
    one of them — instead, only the row judged most likely to be the actual
    base/default edition is used; the others are logged and left unpriced
    rather than guessed at. The DB can represent edition product IDs, but
    concept-only IGDB rows are still assigned only to the most likely
    base/default edition to avoid showing one edition's price on another
    edition.
    """
    igdb_headers = {
        "Client-ID": IGDB_CLIENT_ID,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    }

    id_to_rows: dict[int, list[tuple[str, int]]] = {}
    for title, igdb_id, game_id in db_games:
        id_to_rows.setdefault(igdb_id, []).append((title, game_id))
    all_ids = list(id_to_rows.keys())

    results: list[tuple[str, str, int]] = []
    batch = 500

    for i in range(0, len(all_ids), batch):
        chunk = all_ids[i : i + batch]
        id_list = ",".join(str(x) for x in chunk)
        query = (
            f"fields id, name, external_games.uid, external_games.url; "
            f"where id = ({id_list}); "
            f"limit {batch};"
        ).encode()

        games = _igdb_request(igdb_headers, query)
        matched = 0

        for g in games:
            igdb_id = g["id"]
            rows = id_to_rows.get(igdb_id) or [(g["name"], None)]
            for ext in g.get("external_games", []):
                if "store.playstation.com/en-us/concept" in ext.get("url", "") and ext.get("uid"):
                    # Shortest title = most likely the plain/base edition — editions
                    # almost always ADD words ("... Ultimate Edition") rather than
                    # omit them, so this is a decent proxy with no language-specific
                    # edition-keyword list to maintain.
                    title, game_id = min(rows, key=lambda r: len(r[0]))
                    results.append((title, ext["uid"], game_id))
                    matched += 1
                    if len(rows) > 1:
                        skipped = [t for t, gid in rows if gid != game_id]
                        log.info(
                            "igdb_id %d: %d editions share this game, only %r priced — "
                            "skipped (no distinct PS Store concept known): %s",
                            igdb_id, len(rows), title, ", ".join(skipped),
                        )
                    break

        log.info(
            "IGDB batch %d-%d: %d/%d games had a PS Store concept URL",
            i, i + len(chunk), matched, len(chunk),
        )

        if i + batch < len(all_ids):
            time.sleep(IGDB_DELAY)

    seen: set[str] = set()
    deduped = []
    for title, cid, game_id in results:
        if cid not in seen:
            seen.add(cid)
            deduped.append((title, cid, game_id))
    return deduped


# ---------------------------------------------------------------------------
# DB write
# ---------------------------------------------------------------------------

def _region_url(product_id: str, concept_id: str, locale: str) -> str:
    """Build the region-specific PS Store URL for a product or concept."""
    if product_id:
        return f"https://store.playstation.com/{locale}/product/{product_id}"
    return f"https://store.playstation.com/{locale}/concept/{concept_id}"


def _upsert_region(
    conn: psycopg.Connection,
    table: str,
    conflict_target: str,
    game_id: int | None,
    product_id: str | None,
    url: str,
    price: str | None,
    original_price: str | None,
    discount_pct: str | None,
    plus: tuple[bool, bool, bool] | None,
) -> None:
    """Upsert one region row into ps5_game_tr_info or ps5_game_us_info."""
    if plus is not None:
        conn.execute(
            f"""
            INSERT INTO {table} (
                game_id, product_id, ps_store_url,
                price, original_price, discount_pct,
                essential_plus_included, extra_plus_included, deluxe_plus_included,
                fetched_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT {conflict_target} DO UPDATE SET
                ps_store_url    = EXCLUDED.ps_store_url,
                price           = EXCLUDED.price,
                original_price  = EXCLUDED.original_price,
                discount_pct    = EXCLUDED.discount_pct,
                essential_plus_included = EXCLUDED.essential_plus_included,
                extra_plus_included     = EXCLUDED.extra_plus_included,
                deluxe_plus_included    = EXCLUDED.deluxe_plus_included,
                fetched_at      = NOW()
            """,
            (
                game_id, product_id, url, price, original_price, discount_pct,
                plus[0], plus[1], plus[2],
            ),
        )
    else:
        conn.execute(
            f"""
            INSERT INTO {table} (
                game_id, product_id, ps_store_url,
                price, original_price, discount_pct, fetched_at
            ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT {conflict_target} DO UPDATE SET
                ps_store_url    = EXCLUDED.ps_store_url,
                price           = EXCLUDED.price,
                original_price  = EXCLUDED.original_price,
                discount_pct    = EXCLUDED.discount_pct,
                fetched_at      = NOW()
            """,
            (game_id, product_id, url, price, original_price, discount_pct),
        )


def db_upsert_row(conn: psycopg.Connection, row: "GameRow", game_id: int | None) -> None:
    """Upsert one PS Store price result into the per-region tables.

    Writes region-agnostic metadata to ps5_games (concept_id, edition_name,
    store_display_classification, price_source) and per-region price + URL to
    ps5_game_tr_info (Turkey) and ps5_game_us_info (US). Commits immediately.
    """
    if game_id is not None:
        conn.execute(
            """
            UPDATE ps5_games
            SET concept_id = COALESCE(%s, concept_id),
                edition_name = COALESCE(%s, edition_name),
                store_display_classification = COALESCE(%s, store_display_classification),
                price_source = COALESCE(%s, price_source)
            WHERE id = %s
            """,
            (
                row.concept_id or None,
                row.edition_name or None,
                row.store_display_classification or None,
                row.price_source,
                game_id,
            ),
        )

    product_id = row.product_id or None
    if product_id:
        tr_conflict = "(product_id) WHERE product_id IS NOT NULL"
        us_conflict = "(product_id) WHERE product_id IS NOT NULL"
    else:
        tr_conflict = "(game_id) WHERE product_id IS NULL"
        us_conflict = "(game_id) WHERE product_id IS NULL"

    _upsert_region(
        conn, "ps5_game_tr_info", tr_conflict, game_id, product_id,
        row.ps_store_url or _region_url(product_id or "", row.concept_id, "tr-tr"),
        row.tr_price or None, row.tr_original_price or None, row.tr_discount_pct or None,
        None,
    )
    _upsert_region(
        conn, "ps5_game_us_info", us_conflict, game_id, product_id,
        row.ps_store_url or _region_url(product_id or "", row.concept_id, "en-us"),
        row.us_price or None, row.us_original_price or None, row.us_discount_pct or None,
        (row.essential_plus_included, row.extra_plus_included, row.deluxe_plus_included),
    )

    conn.commit()


# ---------------------------------------------------------------------------
# PS Store price extraction
# ---------------------------------------------------------------------------

_NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)
_ENV_JSON_RE = re.compile(r'<script[^>]+type="application/json">(.*?)</script>', re.S)


def _extract_cache(html: str) -> dict:
    nd_match = _NEXT_DATA_RE.search(html)
    if not nd_match:
        return {}
    try:
        page_data = json.loads(nd_match.group(1))
    except json.JSONDecodeError:
        return {}

    cta_text = (
        page_data.get("props", {})
        .get("pageProps", {})
        .get("batarangs", {})
        .get("cta", {})
        .get("text", "")
    )
    if not cta_text:
        return {}

    env_match = _ENV_JSON_RE.search(cta_text)
    if not env_match:
        return {}
    try:
        return json.loads(env_match.group(1)).get("cache", {})
    except json.JSONDecodeError:
        return {}


def fetch_ps_price_from_url(url: str) -> PriceInfo:
    """Fetch one PS Store page and extract price + PS Plus tier flags."""
    try:
        raw = _http_get(url)
        html = raw.decode(errors="replace")
    except urllib.error.HTTPError as e:
        if e.code in (404, 400):
            return PriceInfo()
        raise
    except urllib.error.URLError:
        return PriceInfo()

    cache = _extract_cache(html)
    if not cache:
        return PriceInfo()

    info = PriceInfo()

    for key, val in cache.items():
        if not key.startswith("GameCTA:") or not isinstance(val, dict):
            continue
        local = val.get("local", {})
        subtype = local.get("telemetryMeta", {}).get("ctaSubType", "")

        if subtype == _CTA_BUY:
            info.price = local.get("priceOrText", "")
            info.original_price = local.get("originalPrice", "")
            info.discount_pct = local.get("discountBadgeText", "")
        elif subtype == _CTA_EXTRA:
            info.extra_plus = True
        elif subtype == _CTA_DELUXE:
            info.deluxe_plus = True

    # Fallback for free-to-play: no ADD_TO_CART, take first non-UPSELL price
    if not info.price:
        for key, val in cache.items():
            if not key.startswith("GameCTA:") or not isinstance(val, dict):
                continue
            if "UPSELL" in key:
                continue
            local = val.get("local", {})
            pot = local.get("priceOrText", "")
            if pot:
                info.price = pot
                info.original_price = local.get("originalPrice", "")
                info.discount_pct = local.get("discountBadgeText", "")
                break

    return info


def fetch_ps_price(concept_id: str, locale: str) -> PriceInfo:
    """Fetch one concept page and extract price + PS Plus tier flags."""
    return fetch_ps_price_from_url(f"{PS_STORE_BASE}/{locale}/concept/{concept_id}")


def fetch_ps_product_price(product_id: str, locale: str) -> PriceInfo:
    """Fetch one product/SKU page and extract edition-specific price."""
    return fetch_ps_price_from_url(f"{PS_STORE_BASE}/{locale}/product/{product_id}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch PS Store prices for US and Turkey.")
    parser.add_argument("-o", "--output", default=None, help="Optional CSV output path")
    parser.add_argument("--limit", type=int, default=None, help="Max number of games to fetch")
    parser.add_argument("--workers", type=int, default=4, help="Concurrent PS Store fetches (default: 4)")
    parser.add_argument("--log-file", default=None, help="Also write logs to this file")
    parser.add_argument("--db-url", default=None, help="Postgres connection string (fallback: DATABASE_URL env var)")
    args = parser.parse_args()

    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stderr)]
    if args.log_file:
        handlers.append(logging.FileHandler(args.log_file, encoding="utf-8"))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
    )

    database_url = args.db_url or os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit("ERROR: provide --db-url or set DATABASE_URL env var")

    log.info("Loading igdb_ids from ps5_games table...")
    db_games = load_db_igdb_ids(database_url)
    log.info("Found %d games with igdb_id in the database.", len(db_games))

    if not db_games:
        sys.exit("No games with igdb_id found. Run enrich_metadata.py first.")

    log.info("Getting IGDB OAuth token...")
    token = get_igdb_token()

    log.info("Resolving PS Store concept IDs via IGDB...")
    games = igdb_concept_ids_for_ids(token, db_games)
    log.info("%d of %d DB games resolved to a PS Store concept URL.", len(games), len(db_games))

    if args.limit:
        games = games[: args.limit]
        log.info("Limiting to %d games.", len(games))

    csv_fields = [f.name for f in fields(GameRow)]

    # Resume: skip concept_ids already in the CSV (local runs) or in the DB (production)
    already_done: set[str] = set()
    if args.output and os.path.exists(args.output):
        with open(args.output, newline="", encoding="utf-8") as existing:
            for csv_row in csv.DictReader(existing):
                if csv_row.get("concept_id"):
                    already_done.add(csv_row["concept_id"])
        if already_done:
            log.info("Resuming from CSV — skipping %d already-fetched games.", len(already_done))
    else:
        # In production (no CSV), resume by checking what's already in the DB from today
        with psycopg.connect(database_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT g.concept_id FROM ps5_games g
                    WHERE g.concept_id IS NOT NULL
                      AND EXISTS (
                        SELECT 1 FROM ps5_game_us_info u WHERE u.game_id = g.id
                        UNION ALL
                        SELECT 1 FROM ps5_game_tr_info t WHERE t.game_id = g.id
                      )
                      AND (
                        (SELECT MAX(fetched_at) FROM ps5_game_us_info u WHERE u.game_id = g.id) >= NOW() - INTERVAL '12 hours'
                        OR (SELECT MAX(fetched_at) FROM ps5_game_tr_info t WHERE t.game_id = g.id) >= NOW() - INTERVAL '12 hours'
                      )
                    """
                )
                already_done = {row[0] for row in cur.fetchall()}
        if already_done:
            log.info("Resuming from DB — skipping %d games fetched in the last 12 hours.", len(already_done))

    remaining = [(name, cid, gid) for name, cid, gid in games if cid not in already_done]
    total = len(remaining)

    if total == 0:
        log.info("All games already fetched. Nothing to do.")
        return

    log.info("Starting price fetch: %d games remaining, %d workers...", total, args.workers)

    done_offset = len(already_done)
    grand_total = done_offset + total

    # Open DB connection for writes; open CSV in append mode if requested
    db_conn = psycopg.connect(database_url, connect_timeout=10, autocommit=False)

    csv_file = None
    csv_writer = None
    if args.output:
        file_mode = "a" if already_done else "w"
        csv_file = open(args.output, file_mode, newline="", encoding="utf-8")
        csv_writer = csv.DictWriter(csv_file, fieldnames=csv_fields)
        if not already_done:
            csv_writer.writeheader()

    try:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            game_futures: list[tuple[str, str, int | None, Future, Future]] = [
                (name, cid, gid,
                 pool.submit(fetch_ps_price, cid, LOCALES["us"]),
                 pool.submit(fetch_ps_price, cid, LOCALES["tr"]))
                for name, cid, gid in remaining
            ]

            for idx, (game_name, concept_id, game_id, f_us, f_tr) in enumerate(game_futures, 1):
                try:
                    us: PriceInfo = f_us.result()
                    tr: PriceInfo = f_tr.result()
                except Exception as exc:
                    log.warning("[%d/%d] %s: fetch failed: %s", done_offset + idx, grand_total, game_name, exc)
                    us = tr = PriceInfo()

                row = GameRow(
                    game_name=game_name,
                    concept_id=concept_id,
                    us_price=us.price,
                    us_original_price=us.original_price,
                    us_discount_pct=us.discount_pct,
                    tr_price=tr.price,
                    tr_original_price=tr.original_price,
                    tr_discount_pct=tr.discount_pct,
                    extra_plus_included=us.extra_plus,
                    deluxe_plus_included=us.deluxe_plus,
                    essential_plus_included=False,
                )

                db_upsert_row(db_conn, row, game_id)

                if csv_writer and csv_file:
                    csv_writer.writerow({f.name: getattr(row, f.name) for f in fields(row)})
                    csv_file.flush()

                plus_tag = " [Extra]" if us.extra_plus else (" [Deluxe]" if us.deluxe_plus else "")
                log.info(
                    "[%d/%d] %s (concept %s) | US: %s | TR: %s%s",
                    done_offset + idx, grand_total, game_name, concept_id,
                    us.price or "N/A", tr.price or "N/A", plus_tag,
                )
    finally:
        db_conn.close()
        if csv_file:
            csv_file.close()


if __name__ == "__main__":
    main()
