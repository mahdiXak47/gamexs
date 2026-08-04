from __future__ import annotations

import dataclasses
import json
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
