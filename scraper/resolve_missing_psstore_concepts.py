"""Resolve missing PS Store concept IDs from cached IGDB website URLs.

The regular PS Store price job only trusts IGDB `external_games` concept URLs.
Some IGDB detail caches contain equivalent PlayStation Store product URLs
instead. This repair script resolves those product pages to concept IDs, checks
uniqueness, and can upsert PS Store price rows for the resolved games.

Examples:
    DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs \
      .venv/bin/python resolve_missing_psstore_concepts.py --output output/resolved_psstore.csv

    DATABASE_URL=postgresql://gamexs:gamexs@localhost:5436/gamexs \
      .venv/bin/python resolve_missing_psstore_concepts.py --apply --workers 4
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import psycopg
import requests

import fetch_psstore_prices as psstore

log = logging.getLogger("resolve-psstore")

REPO_ROOT = Path(__file__).resolve().parents[1]
DETAILS_DIR = REPO_ROOT / "scraper" / "output" / "game_details"
CONCEPT_RE = re.compile(r"/concept/(\d+)")
PRODUCT_RE = re.compile(r"/product/([A-Z0-9][A-Z0-9_-]+)", re.I)
PRODUCT_CONCEPT_RE = re.compile(r'"Product:[^"]+".{0,200}?"concept":\{"__ref":"Concept:(\d+)"\}', re.S)
CONCEPT_ID_RE = re.compile(r"conceptId(?:&quot;|\\u0026quot;|\"|')?\s*:\s*(?:&quot;|\\u0026quot;|\"|')?(\d+)")


@dataclass(frozen=True)
class MissingGame:
    id: int
    title: str
    slug: str
    igdb_id: int


@dataclass(frozen=True)
class Candidate:
    game: MissingGame
    concept_id: str
    source_url: str
    source_kind: str


def load_missing_games(conn: psycopg.Connection) -> list[MissingGame]:
    rows = conn.execute(
        """
        SELECT g.id, g.title, g.slug, g.igdb_id
        FROM ps5_games g
        LEFT JOIN ps5_store_info s ON s.game_id = g.id
        WHERE s.concept_id IS NULL
        ORDER BY g.title
        """
    ).fetchall()
    return [MissingGame(int(r[0]), r[1], r[2], int(r[3])) for r in rows]


def load_existing_concepts(conn: psycopg.Connection) -> set[str]:
    rows = conn.execute("SELECT concept_id FROM ps5_store_info WHERE concept_id IS NOT NULL").fetchall()
    return {str(r[0]) for r in rows}


def load_psstore_urls_by_igdb_id(details_dir: Path) -> dict[int, list[str]]:
    urls_by_igdb: dict[int, list[str]] = {}
    for path in details_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        igdb_id = data.get("igdb_id")
        if not isinstance(igdb_id, int):
            continue
        urls: list[str] = []
        for item in data.get("websites") or []:
            url = item.get("url") if isinstance(item, dict) else None
            if isinstance(url, str) and "store.playstation.com/" in url:
                urls.append(url)
        if urls:
            urls_by_igdb.setdefault(igdb_id, [])
            for url in urls:
                if url not in urls_by_igdb[igdb_id]:
                    urls_by_igdb[igdb_id].append(url)
    return urls_by_igdb


def locale_from_url(url: str) -> str:
    parts = [p for p in urlparse(url).path.split("/") if p]
    if parts and re.fullmatch(r"[a-z]{2}-[a-z]{2}", parts[0], re.I):
        return parts[0].lower()
    return "en-us"


def concept_from_product_url(url: str, session: requests.Session, timeout: int) -> str | None:
    try:
        resp = session.get(url, timeout=timeout)
        if resp.status_code in {400, 404}:
            return None
        resp.raise_for_status()
    except requests.RequestException as exc:
        log.debug("product fetch failed %s: %s", url, exc)
        return None

    text = html.unescape(resp.text)
    match = PRODUCT_CONCEPT_RE.search(text)
    if match:
        return match.group(1)
    match = CONCEPT_ID_RE.search(text)
    if match:
        return match.group(1)
    return None


def resolve_game(
    game: MissingGame,
    urls_by_igdb: dict[int, list[str]],
    session: requests.Session,
    timeout: int,
) -> Candidate | None:
    urls = urls_by_igdb.get(game.igdb_id, [])
    for url in urls:
        concept_match = CONCEPT_RE.search(url)
        if concept_match:
            return Candidate(game, concept_match.group(1), url, "cached_concept_url")

    for url in urls:
        product_match = PRODUCT_RE.search(url)
        if not product_match:
            continue
        concept_id = concept_from_product_url(url, session, timeout)
        if concept_id:
            return Candidate(game, concept_id, url, f"resolved_product_url:{locale_from_url(url)}")

    return None


def validate_candidates(candidates: list[Candidate], existing: set[str]) -> tuple[list[Candidate], list[Candidate]]:
    counts: dict[str, int] = {}
    for candidate in candidates:
        counts[candidate.concept_id] = counts.get(candidate.concept_id, 0) + 1

    accepted: list[Candidate] = []
    rejected: list[Candidate] = []
    for candidate in candidates:
        if candidate.concept_id in existing or counts[candidate.concept_id] > 1:
            rejected.append(candidate)
        else:
            accepted.append(candidate)
    return accepted, rejected


def upsert_candidate(conn: psycopg.Connection, candidate: Candidate) -> tuple[str, str]:
    us = psstore.fetch_ps_price(candidate.concept_id, psstore.LOCALES["us"])
    tr = psstore.fetch_ps_price(candidate.concept_id, psstore.LOCALES["tr"])
    row = psstore.GameRow(
        game_name=candidate.game.title,
        concept_id=candidate.concept_id,
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
    psstore.db_upsert_row(conn, row, candidate.game.id)
    return us.price, tr.price


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Resolve missing PS Store concept IDs from cached PS Store URLs.")
    parser.add_argument("--db-url", default=os.environ.get("DATABASE_URL"))
    parser.add_argument("--details-dir", type=Path, default=DETAILS_DIR)
    parser.add_argument("--output", type=Path, default=Path("/private/tmp/resolved_missing_psstore_concepts.csv"))
    parser.add_argument("--rejected-output", type=Path, default=Path("/private/tmp/rejected_missing_psstore_concepts.csv"))
    parser.add_argument("--apply", action="store_true", help="Upsert accepted rows into ps5_store_info.")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--timeout", type=int, default=20)
    parser.add_argument("--delay", type=float, default=0.15)
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    if not args.db_url:
        sys.exit("ERROR: pass --db-url or set DATABASE_URL")

    session = requests.Session()
    session.headers.update({
        "User-Agent": psstore.HEADERS["User-Agent"],
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    })

    with psycopg.connect(args.db_url, connect_timeout=10, autocommit=False) as conn:
        missing = load_missing_games(conn)
        existing = load_existing_concepts(conn)
        if args.limit:
            missing = missing[: args.limit]
        urls_by_igdb = load_psstore_urls_by_igdb_id(args.details_dir)

        log.info("Missing concept IDs: %d", len(missing))
        log.info("IGDB detail entries with PS Store URLs: %d", len(urls_by_igdb))

        candidates: list[Candidate] = []
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            futures = [pool.submit(resolve_game, game, urls_by_igdb, session, args.timeout) for game in missing]
            for idx, future in enumerate(as_completed(futures), 1):
                candidate = future.result()
                if candidate:
                    candidates.append(candidate)
                if args.delay:
                    time.sleep(args.delay)
                if idx % 25 == 0:
                    log.info("Scanned %d/%d; candidates=%d", idx, len(missing), len(candidates))

        accepted, rejected = validate_candidates(candidates, existing)
        log.info("Resolved candidates: %d accepted, %d rejected", len(accepted), len(rejected))

        output_rows: list[dict[str, object]] = []
        for candidate in sorted(accepted, key=lambda c: c.game.title):
            us_price = ""
            tr_price = ""
            if args.apply:
                us_price, tr_price = upsert_candidate(conn, candidate)
                log.info(
                    "upserted %s -> concept %s | US=%s | TR=%s",
                    candidate.game.title,
                    candidate.concept_id,
                    us_price or "N/A",
                    tr_price or "N/A",
                )
            output_rows.append({
                "game_id": candidate.game.id,
                "title": candidate.game.title,
                "slug": candidate.game.slug,
                "igdb_id": candidate.game.igdb_id,
                "concept_id": candidate.concept_id,
                "source_kind": candidate.source_kind,
                "source_url": candidate.source_url,
                "us_store_url": f"https://store.playstation.com/en-us/concept/{candidate.concept_id}",
                "tr_store_url": f"https://store.playstation.com/tr-tr/concept/{candidate.concept_id}",
                "us_price": us_price,
                "tr_price": tr_price,
            })

        rejected_rows = [{
            "game_id": candidate.game.id,
            "title": candidate.game.title,
            "slug": candidate.game.slug,
            "igdb_id": candidate.game.igdb_id,
            "concept_id": candidate.concept_id,
            "source_kind": candidate.source_kind,
            "source_url": candidate.source_url,
            "reason": "concept_id already exists or appears multiple times in this run",
        } for candidate in sorted(rejected, key=lambda c: c.game.title)]

        write_csv(args.output, output_rows)
        write_csv(args.rejected_output, rejected_rows)
        log.info("Wrote %s", args.output)
        log.info("Wrote %s", args.rejected_output)


if __name__ == "__main__":
    main()
