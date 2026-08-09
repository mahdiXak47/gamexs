from __future__ import annotations

import dataclasses
import json
import logging
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

import psycopg
from temporalio import activity

from gamexs_scraper.adapters import ADAPTERS
from gamexs_scraper.load_to_postgres import load_offers
from gamexs_scraper.models import RawOffer
from gamexs_scraper.temporal.artifacts import download_artifact, upload_artifact


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value


def _tail(text: str, max_chars: int = 8000) -> str:
    if len(text) <= max_chars:
        return text
    return text[-max_chars:]


def _run_command(args: list[str], timeout_seconds: int) -> dict:
    proc = subprocess.run(
        args,
        cwd="/app" if Path("/app").exists() else None,
        text=True,
        capture_output=True,
        timeout=timeout_seconds,
        check=False,
    )
    result = {
        "command": args,
        "returncode": proc.returncode,
        "stdout_tail": _tail(proc.stdout),
        "stderr_tail": _tail(proc.stderr),
    }
    if proc.returncode != 0:
        raise RuntimeError(json.dumps(result, ensure_ascii=False))
    return result


def _write_offer_jsonl(path: Path, offer: RawOffer) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(dataclasses.asdict(offer), ensure_ascii=False, default=str) + "\n")


def _load_cached_offers(path: Path) -> list[RawOffer]:
    from gamexs_scraper.export_csv import load_cached_offers

    return load_cached_offers(str(path))


@activity.defn(name="scrape_seller_to_s3")
def scrape_seller_to_s3(input: dict) -> dict:
    seller = input["seller"]
    workflow_id = input["workflow_id"]
    artifact_prefix = input.get("artifact_prefix", "scraper-runs").strip("/")
    limit_products = input.get("limit_products")

    if seller not in ADAPTERS:
        raise RuntimeError(f"unknown seller {seller!r}")

    with tempfile.TemporaryDirectory(prefix=f"gamexs-{seller}-") as tmp:
        jsonl_path = Path(tmp) / f"{seller}.jsonl"
        adapter = ADAPTERS[seller]()
        seen_urls: set[str] = set()
        offers_count = 0

        for offer in adapter.iter_listings():
            if offer.source_url not in seen_urls:
                seen_urls.add(offer.source_url)
                if limit_products and len(seen_urls) > int(limit_products):
                    break
            _write_offer_jsonl(jsonl_path, offer)
            offers_count += 1

            if offers_count % 20 == 0:
                activity.heartbeat(
                    f"{seller} — {offers_count} offers scraped, {len(seen_urls)} products"
                )

        activity.logger.info(
            "%s scrape complete: %s offers across %s products",
            seller,
            offers_count,
            len(seen_urls),
        )

        if not jsonl_path.exists():
            jsonl_path.write_text("", encoding="utf-8")

        artifact_key = f"{artifact_prefix}/{workflow_id}/{seller}.jsonl"
        upload_artifact(jsonl_path, artifact_key)

    return {
        "seller": seller,
        "artifact_key": artifact_key,
        "products_count": len(seen_urls),
        "offers_count": offers_count,
    }


@activity.defn(name="load_seller_from_s3")
def load_seller_from_s3(input: dict) -> dict:
    seller = input["seller"]
    artifact_key = input["artifact_key"]
    database_url = _required_env("DATABASE_URL")
    platform = input.get("platform", "ps5")

    with tempfile.TemporaryDirectory(prefix=f"gamexs-load-{seller}-") as tmp:
        jsonl_path = download_artifact(artifact_key, Path(tmp) / f"{seller}.jsonl")
        offers = _load_cached_offers(jsonl_path)

        with psycopg.connect(database_url) as conn, conn.cursor() as cur:
            cur.execute("SELECT id FROM platforms WHERE slug = %s", (platform,))
            platform_row = cur.fetchone()
            if not platform_row:
                raise RuntimeError(f"unknown platform {platform!r}")

            cur.execute("SELECT id FROM sellers WHERE slug = %s", (seller,))
            seller_row = cur.fetchone()
            if not seller_row:
                raise RuntimeError(f"unknown seller {seller!r}")

            games_count, listings_count = load_offers(cur, platform_row[0], seller_row[0], seller, offers)
            conn.commit()

    return {
        "seller": seller,
        "games_count": games_count,
        "listings_count": listings_count,
        "offers_count": len(offers),
    }


@activity.defn(name="log_seller_prices")
def log_seller_prices(input: dict) -> dict:
    """Scrape gpgaming.ir and log each offer with game/platform/capacity/price information."""
    seller = input.get("seller", "gpgaming")

    from gamexs_scraper.adapters import ADAPTERS

    if seller not in ADAPTERS:
        raise RuntimeError(f"unknown seller {seller!r}")

    adapter = ADAPTERS[seller]()
    prices = []
    count = 0

    for offer in adapter.iter_listings():
        tier_label = offer.tier.value if offer.tier else "N/A"
        scraped_hour = offer.scraped_at.strftime("%H:%M")
        scraped_date = offer.scraped_at.strftime("%Y-%m-%d")

        record = {
            "game": offer.raw_title,
            "platform": "PS5",
            "capacity": tier_label,
            "price": offer.price_toman,
            "hour": scraped_hour,
            "date": scraped_date,
        }
        prices.append(record)
        count += 1

        activity.heartbeat(
            f"processed {count} — {offer.raw_title[:60]} | capacity={tier_label} | price={offer.price_toman}"
        )
        activity.logger.info(
            "gpgaming | game=%s | platform=PS5 | capacity=%s | price=%s | hour=%s | date=%s",
            offer.raw_title,
            tier_label,
            offer.price_toman,
            scraped_hour,
            scraped_date,
        )

    return {"seller": seller, "offers_logged": len(prices), "prices": prices}


@activity.defn(name="enrich_igdb_metadata")
def enrich_igdb_metadata(input: dict) -> dict:
    args = [sys.executable, "-m", "gamexs_scraper.enrich_metadata"]
    if input.get("limit"):
        args += ["--limit", str(input["limit"])]
    if input.get("all"):
        args.append("--all")
    return _run_command(args, timeout_seconds=int(input.get("timeout_seconds", 14400)))


@activity.defn(name="fetch_playstation_store_prices")
def fetch_playstation_store_prices(input: dict) -> dict:
    database_url = _required_env("DATABASE_URL")
    workers = str(input.get("workers") or os.environ.get("PSSTORE_WORKERS", "4"))
    args = [sys.executable, "fetch_psstore_prices.py", "--db-url", database_url, "--workers", workers]
    if input.get("limit"):
        args += ["--limit", str(input["limit"])]
    return _run_command(args, timeout_seconds=int(input.get("timeout_seconds", 7200)))


def _configure_psstore_module():
    import fetch_psstore_prices as psstore

    client_id = os.environ.get("IGDB_CLIENT_ID", "").strip()
    client_secret = os.environ.get("IGDB_CLIENT_SECRET", "").strip()
    if client_id:
        psstore.IGDB_CLIENT_ID = client_id
    if client_secret:
        psstore.IGDB_CLIENT_SECRET = client_secret
    return psstore


@activity.defn(name="resolve_playstation_store_games")
def resolve_playstation_store_games(input: dict) -> dict:
    psstore = _configure_psstore_module()
    database_url = _required_env("DATABASE_URL")
    limit = input.get("limit")
    skip_recent_hours = int(input.get("skip_recent_hours", 12))

    db_games = psstore.load_db_igdb_ids(database_url)
    if not db_games:
        return {"games": [], "db_games_count": 0, "resolved_count": 0, "skipped_recent_count": 0}

    token = psstore.get_igdb_token()
    resolved = psstore.igdb_concept_ids_for_ids(token, db_games)

    already_done: set[str] = set()
    if skip_recent_hours > 0:
        with psycopg.connect(database_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT concept_id FROM ps5_store_info
                    WHERE fetched_at >= NOW() - (%s::text || ' hours')::interval
                    """,
                    (skip_recent_hours,),
                )
                already_done = {row[0] for row in cur.fetchall()}

    games = [
        {"game_name": title, "concept_id": concept_id, "game_id": game_id}
        for title, concept_id, game_id in resolved
        if concept_id not in already_done
    ]
    if limit:
        games = games[: int(limit)]

    return {
        "games": games,
        "db_games_count": len(db_games),
        "resolved_count": len(resolved),
        "skipped_recent_count": len(already_done),
        "selected_count": len(games),
    }


def _fetch_playstation_store_region_price(input: dict) -> dict:
    psstore = _configure_psstore_module()
    region = input["region"]
    concept_id = input["concept_id"]
    locale = psstore.LOCALES[region]

    price = psstore.fetch_ps_price(concept_id, locale)
    return {
        "game_name": input["game_name"],
        "concept_id": concept_id,
        "game_id": input.get("game_id"),
        "region": region,
        "locale": locale,
        "price": price.price,
        "original_price": price.original_price,
        "discount_pct": price.discount_pct,
        "extra_plus": price.extra_plus,
        "deluxe_plus": price.deluxe_plus,
    }


@activity.defn(name="fetch_playstation_store_region_price")
def fetch_playstation_store_region_price(input: dict) -> dict:
    return _fetch_playstation_store_region_price(input)


@activity.defn(name="fetch_playstation_store_us_price")
def fetch_playstation_store_us_price(input: dict) -> dict:
    return _fetch_playstation_store_region_price({**input, "region": "us"})


@activity.defn(name="fetch_playstation_store_tr_price")
def fetch_playstation_store_tr_price(input: dict) -> dict:
    return _fetch_playstation_store_region_price({**input, "region": "tr"})


@activity.defn(name="upsert_playstation_store_game_price")
def upsert_playstation_store_game_price(input: dict) -> dict:
    psstore = _configure_psstore_module()
    database_url = _required_env("DATABASE_URL")
    game = input["game"]
    prices = {price["region"]: price for price in input["prices"]}
    us = prices.get("us", {})
    tr = prices.get("tr", {})

    row = psstore.GameRow(
        game_name=game["game_name"],
        concept_id=game["concept_id"],
        us_price=us.get("price", ""),
        us_original_price=us.get("original_price", ""),
        us_discount_pct=us.get("discount_pct", ""),
        tr_price=tr.get("price", ""),
        tr_original_price=tr.get("original_price", ""),
        tr_discount_pct=tr.get("discount_pct", ""),
        extra_plus_included=bool(us.get("extra_plus")),
        deluxe_plus_included=bool(us.get("deluxe_plus")),
        essential_plus_included=False,
    )

    with psycopg.connect(database_url, connect_timeout=10, autocommit=False) as conn:
        psstore.db_upsert_row(conn, row, game.get("game_id"))

    return {
        "game_name": game["game_name"],
        "concept_id": game["concept_id"],
        "game_id": game.get("game_id"),
        "us_price": row.us_price,
        "tr_price": row.tr_price,
        "extra_plus_included": row.extra_plus_included,
        "deluxe_plus_included": row.deluxe_plus_included,
    }


@activity.defn(name="upload_igdb_images_to_s3")
def upload_igdb_images_to_s3(input: dict) -> dict:
    database_url = _required_env("DATABASE_URL")
    return _run_command(
        [sys.executable, "upload_to_s3.py", "--db-url", database_url],
        timeout_seconds=int(input.get("timeout_seconds", 7200)),
    )


@activity.defn(name="cleanup_stale_listings")
def cleanup_stale_listings(input: dict) -> dict:
    database_url = _required_env("DATABASE_URL")
    stale_days = int(input.get("stale_days", 3))

    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE listings SET is_active = false
            WHERE is_active = true
              AND last_seen_at < NOW() - (%s::text || ' days')::interval
            """,
            (stale_days,),
        )
        stale = cur.rowcount
        cur.execute(
            """
            DELETE FROM ps5_games
            WHERE id NOT IN (SELECT DISTINCT game_id FROM listings WHERE is_active)
            """
        )
        orphans = cur.rowcount
        conn.commit()

    return {
        "stale_listings_marked_inactive": stale,
        "orphaned_games_removed": orphans,
        "cleaned_at": datetime.utcnow().isoformat() + "Z",
    }
