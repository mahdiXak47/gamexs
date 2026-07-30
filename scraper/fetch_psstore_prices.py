"""Fetch official PS Store prices for US and Turkey regions.

Discovers PS5 games via IGDB (external_games with store.playstation.com URLs),
then fetches each game's product page for both locales and extracts pricing
from the SSR __NEXT_DATA__ payload.

Usage:
    python fetch_psstore_prices.py -o psstore_prices.csv
    python fetch_psstore_prices.py -o psstore_prices.csv --limit 50  # first 50 games only

Output CSV columns:
    game_name, concept_id,
    us_price, us_original_price, us_discount_pct,
    tr_price, tr_original_price, tr_discount_pct
"""

import argparse
import csv
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, fields


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

IGDB_CLIENT_ID = "2qsedq5y7o8w7wq1o0ivmhuhabwg8u"
IGDB_CLIENT_SECRET = "5086gwpyz569ou34iz5exipusskx4h"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"
IGDB_GAMES_URL = "https://api.igdb.com/v4/games"

PS_STORE_BASE = "https://store.playstation.com"
LOCALES = {"us": "en-us", "tr": "tr-tr"}

IGDB_DELAY = 0.3   # seconds between IGDB requests
PS_DELAY = 0.6     # seconds between each PS Store fetch

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------

@dataclass
class PriceInfo:
    price: str = ""
    original_price: str = ""
    discount_pct: str = ""

@dataclass
class GameRow:
    game_name: str
    concept_id: str
    us_price: str = ""
    us_original_price: str = ""
    us_discount_pct: str = ""
    tr_price: str = ""
    tr_original_price: str = ""
    tr_discount_pct: str = ""


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
    """POST to IGDB with retries on timeout."""
    for attempt in range(_IGDB_RETRIES):
        try:
            req = urllib.request.Request(IGDB_GAMES_URL, data=query, headers=headers)
            resp = urllib.request.urlopen(req, timeout=_IGDB_TIMEOUT)
            return json.loads(resp.read())
        except (TimeoutError, urllib.error.URLError) as exc:
            if attempt < _IGDB_RETRIES - 1:
                wait = 2 ** attempt * 2
                print(f"  IGDB timeout, retrying in {wait}s... ({exc})", file=sys.stderr)
                time.sleep(wait)
            else:
                raise
    return []


def igdb_ps5_concept_ids(token: str, limit: int | None = None) -> list[tuple[str, str]]:
    """Return list of (game_name, concept_id) for PS5 games with PS Store entries."""
    igdb_headers = {
        "Client-ID": IGDB_CLIENT_ID,
        "Authorization": f"Bearer {token}",
        "Content-Type": "text/plain",
    }

    results: list[tuple[str, str]] = []
    offset = 0
    batch = 500

    while True:
        query = (
            f"fields id, name, external_games.uid, external_games.url; "
            f'where platforms = (167) & external_games.url = *"store.playstation.com/en-us/concept"*; '
            f"limit {batch}; offset {offset};"
        ).encode()

        games = _igdb_request(igdb_headers, query)

        if not games:
            break

        for g in games:
            name = g["name"]
            for ext in g.get("external_games", []):
                url = ext.get("url", "")
                uid = ext.get("uid", "")
                if "store.playstation.com/en-us/concept" in url and uid:
                    results.append((name, uid))
                    break

        print(f"  IGDB offset {offset}: fetched {len(games)} games, total so far: {len(results)}", file=sys.stderr)

        if len(games) < batch:
            break
        offset += batch
        time.sleep(IGDB_DELAY)

        if limit and len(results) >= limit:
            break

    if limit:
        results = results[:limit]

    # Deduplicate by concept_id (keep first occurrence)
    seen: set[str] = set()
    deduped = []
    for name, cid in results:
        if cid not in seen:
            seen.add(cid)
            deduped.append((name, cid))
    return deduped


# ---------------------------------------------------------------------------
# PS Store price extraction
# ---------------------------------------------------------------------------

_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S
)
_ENV_JSON_RE = re.compile(
    r'<script[^>]+type="application/json">(.*?)</script>', re.S
)


def fetch_ps_price(concept_id: str, locale: str) -> PriceInfo:
    """Fetch a single concept page and extract current + original price."""
    url = f"{PS_STORE_BASE}/{locale}/concept/{concept_id}"
    req = urllib.request.Request(url, headers=HEADERS)

    try:
        resp = urllib.request.urlopen(req, timeout=15)
        html = resp.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        if e.code in (404, 400):
            return PriceInfo()
        raise
    except urllib.error.URLError:
        return PriceInfo()

    nd_match = _NEXT_DATA_RE.search(html)
    if not nd_match:
        return PriceInfo()

    try:
        page_data = json.loads(nd_match.group(1))
    except json.JSONDecodeError:
        return PriceInfo()

    cta_text = (
        page_data.get("props", {})
        .get("pageProps", {})
        .get("batarangs", {})
        .get("cta", {})
        .get("text", "")
    )
    if not cta_text:
        return PriceInfo()

    # The CTA batarang embeds its Apollo cache as a JSON script tag
    env_match = _ENV_JSON_RE.search(cta_text)
    if env_match:
        try:
            env = json.loads(env_match.group(1))
            cache = env.get("cache", {})
            for key, val in cache.items():
                if key.startswith("GameCTA:") and isinstance(val, dict):
                    local = val.get("local", {})
                    if local.get("priceOrText"):
                        return PriceInfo(
                            price=local.get("priceOrText", ""),
                            original_price=local.get("originalPrice", ""),
                            discount_pct=local.get("discountBadgeText", ""),
                        )
        except (json.JSONDecodeError, KeyError):
            pass

    # Fallback: regex directly on the CTA text
    price_m = re.search(r'"priceOrText":"([^"]*)"', cta_text)
    orig_m = re.search(r'"originalPrice":"([^"]*)"', cta_text)
    disc_m = re.search(r'"discountBadgeText":"([^"]*)"', cta_text)

    return PriceInfo(
        price=price_m.group(1) if price_m else "",
        original_price=orig_m.group(1) if orig_m else "",
        discount_pct=disc_m.group(1) if disc_m else "",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch PS Store prices for US and Turkey.")
    parser.add_argument("-o", "--output", default="psstore_prices.csv", help="Output CSV path")
    parser.add_argument("--limit", type=int, default=None, help="Max number of games to fetch")
    args = parser.parse_args()

    print("Getting IGDB OAuth token...", file=sys.stderr)
    token = get_igdb_token()

    print("Fetching PS5 game list from IGDB...", file=sys.stderr)
    games = igdb_ps5_concept_ids(token, limit=args.limit)
    print(f"Found {len(games)} games with PS Store concept IDs.", file=sys.stderr)

    csv_fields = [f.name for f in fields(GameRow)]

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()

        for idx, (game_name, concept_id) in enumerate(games, 1):
            row = GameRow(game_name=game_name, concept_id=concept_id)

            us = fetch_ps_price(concept_id, LOCALES["us"])
            time.sleep(PS_DELAY)
            tr = fetch_ps_price(concept_id, LOCALES["tr"])
            time.sleep(PS_DELAY)

            row.us_price = us.price
            row.us_original_price = us.original_price
            row.us_discount_pct = us.discount_pct
            row.tr_price = tr.price
            row.tr_original_price = tr.original_price
            row.tr_discount_pct = tr.discount_pct

            writer.writerow(
                {f.name: getattr(row, f.name) for f in fields(row)}
            )
            f.flush()

            status = us.price if us.price else "N/A"
            tr_status = tr.price if tr.price else "N/A"
            print(
                f"[{idx}/{len(games)}] {game_name} (concept {concept_id})"
                f" | US: {status} | TR: {tr_status}",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()
