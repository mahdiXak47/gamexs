"""Run one seller scrape with retries, validation, and durable health records."""

from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

import psycopg

from .seller_health import (
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_RETRY_DELAY_SECONDS,
    GameCountResult,
    build_failure_alert,
    evaluate_game_count,
    retry_delays,
)
from .telegram import send_telegram_alert


SCRAPER_ROOT = Path(__file__).resolve().parents[1]


def count_csv_games(path: str | Path) -> int:
    """Count exported game rows, excluding the CSV header."""
    with Path(path).open(newline="", encoding="utf-8-sig") as source:
        return sum(1 for _ in csv.DictReader(source))


def count_jsonl_records(path: str | Path) -> int:
    """Count non-empty JSONL records without parsing the full snapshot."""
    with Path(path).open(encoding="utf-8") as source:
        return sum(1 for line in source if line.strip())


class ScrapeRunStore:
    """Small persistence boundary for seller runs and per-attempt outcomes."""

    def __init__(self, database_url: str):
        self.connection = psycopg.connect(database_url)

    def close(self) -> None:
        self.connection.close()

    def seller_baseline(self, seller: str) -> tuple[int, int, str | None]:
        with self.connection.cursor() as cur:
            cur.execute(
                """
                SELECT s.id,
                       COUNT(DISTINCT l.game_id) FILTER (WHERE l.is_active),
                       (
                           SELECT completed_at::text
                           FROM scrape_runs
                           WHERE seller_id = s.id AND status = 'succeeded'
                           ORDER BY completed_at DESC
                           LIMIT 1
                       )
                FROM sellers s
                LEFT JOIN listings l ON l.seller_id = s.id
                WHERE s.slug = %s
                GROUP BY s.id
                """,
                (seller,),
            )
            row = cur.fetchone()
        if not row:
            raise ValueError(f"unknown seller {seller!r}")
        return int(row[0]), int(row[1] or 0), row[2]

    def start_run(self, seller_id: int) -> int:
        with self.connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scrape_runs (seller_id, status, attempts)
                VALUES (%s, 'running', 0)
                RETURNING id
                """,
                (seller_id,),
            )
            run_id = cur.fetchone()[0]
        self.connection.commit()
        return run_id

    def start_attempt(self, run_id: int, attempt_no: int) -> int:
        with self.connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO scrape_run_attempts (run_id, attempt_no, status)
                VALUES (%s, %s, 'running')
                RETURNING id
                """,
                (run_id, attempt_no),
            )
            attempt_id = cur.fetchone()[0]
        self.connection.commit()
        return attempt_id

    def finish_attempt(
        self,
        attempt_id: int,
        status: str,
        observed_games: int | None = None,
        loaded_games: int | None = None,
        loaded_listings: int | None = None,
        error: str | None = None,
    ) -> None:
        with self.connection.cursor() as cur:
            cur.execute(
                """
                UPDATE scrape_run_attempts
                SET status = %s,
                    observed_games = %s,
                    loaded_games = %s,
                    loaded_listings = %s,
                    error = %s,
                    completed_at = now()
                WHERE id = %s
                """,
                (status, observed_games, loaded_games, loaded_listings, error, attempt_id),
            )
        self.connection.commit()

    def updated_counts(self, seller_id: int, since: datetime) -> tuple[int, int]:
        with self.connection.cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT l.game_id), COUNT(DISTINCT l.id)
                FROM listings l
                WHERE l.seller_id = %s AND l.last_seen_at >= %s
                """,
                (seller_id, since),
            )
            row = cur.fetchone()
        return int(row[0] or 0), int(row[1] or 0)

    def finish_run(
        self,
        run_id: int,
        attempts: int,
        status: str,
        observed_games: int | None = None,
        loaded_games: int | None = None,
        loaded_listings: int | None = None,
        failure_reason: str | None = None,
    ) -> None:
        with self.connection.cursor() as cur:
            cur.execute(
                """
                UPDATE scrape_runs
                SET attempts = %s,
                    status = %s,
                    observed_games = %s,
                    loaded_games = %s,
                    loaded_listings = %s,
                    failure_reason = %s,
                    completed_at = now()
                WHERE id = %s
                """,
                (
                    attempts,
                    status,
                    observed_games,
                    loaded_games,
                    loaded_listings,
                    failure_reason,
                    run_id,
                ),
            )
        self.connection.commit()


def _max_attempts(environ: dict[str, str] | None = None) -> int:
    values = os.environ if environ is None else environ
    raw_value = values.get("SCRAPER_MAX_ATTEMPTS", str(DEFAULT_MAX_ATTEMPTS))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError("SCRAPER_MAX_ATTEMPTS must be a positive integer") from exc
    if value < 1:
        raise ValueError("SCRAPER_MAX_ATTEMPTS must be a positive integer")
    return value


def run_seller(
    seller: str,
    database_url: str,
    output_dir: str | Path = "/tmp",
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    retry_delay_seconds: int = DEFAULT_RETRY_DELAY_SECONDS,
    sleep_fn=time.sleep,
) -> int:
    """Return zero only after a validated snapshot was loaded successfully."""
    if seller == "uperagame":
        return _run_uperagame(
            database_url=database_url,
            output_dir=output_dir,
            max_attempts=max_attempts,
            retry_delay_seconds=retry_delay_seconds,
            sleep_fn=sleep_fn,
        )
    store = ScrapeRunStore(database_url)
    try:
        seller_id, previous_games, previous_success = store.seller_baseline(seller)
        run_id = store.start_run(seller_id)
        last_reason = "unknown scrape failure"
        observed_games: int | None = None
        loaded_games: int | None = None
        loaded_listings: int | None = None

        delays = [0, *retry_delays(max_attempts, retry_delay_seconds)]
        for attempt_no, delay in zip(range(1, max_attempts + 1), delays):
            if delay:
                print(f"[{seller}] retrying in {delay} seconds", flush=True)
                sleep_fn(delay)
            attempt_id = store.start_attempt(run_id, attempt_no)
            attempt_started = datetime.now(timezone.utc)
            try:
                with tempfile.TemporaryDirectory(prefix=f"gamexs-{seller}-", dir=str(output_dir)) as directory:
                    cache_path = Path(directory) / f"{seller}.jsonl"
                    csv_path = Path(directory) / f"{seller}.csv"
                    export_result = subprocess.run(
                        [
                            sys.executable,
                            "-m",
                            "gamexs_scraper.export_csv",
                            seller,
                            "-o",
                            str(csv_path),
                            "--cache",
                            str(cache_path),
                        ],
                        cwd=SCRAPER_ROOT,
                        check=False,
                    )
                    if export_result.returncode != 0:
                        raise RuntimeError(f"scrape command exited with code {export_result.returncode}")

                    observed_games = count_csv_games(csv_path)
                    quality = evaluate_game_count(observed_games, previous_games or None)
                    if not quality.healthy:
                        last_reason = quality.reason
                        store.finish_attempt(attempt_id, "suspicious", observed_games, error=last_reason)
                        continue

                    load_result = subprocess.run(
                        [
                            sys.executable,
                            "-m",
                            "gamexs_scraper.load_to_postgres",
                            seller,
                            "--cache",
                            str(cache_path),
                        ],
                        cwd=SCRAPER_ROOT,
                        env={**os.environ, "DATABASE_URL": database_url},
                        check=False,
                    )
                    if load_result.returncode != 0:
                        raise RuntimeError(f"load command exited with code {load_result.returncode}")

                    loaded_games, loaded_listings = store.updated_counts(seller_id, attempt_started)
                    if loaded_games == 0 or loaded_listings == 0:
                        raise RuntimeError(
                            f"load completed but updated no listings ({loaded_games} games, {loaded_listings} listings)"
                        )

                    store.finish_attempt(
                        attempt_id,
                        "succeeded",
                        observed_games,
                        loaded_games,
                        loaded_listings,
                    )
                    store.finish_run(
                        run_id,
                        attempt_no,
                        "succeeded",
                        observed_games,
                        loaded_games,
                        loaded_listings,
                    )
                    print(
                        f"[{seller}] healthy scrape: {observed_games} games, "
                        f"{loaded_listings} listings updated",
                        flush=True,
                    )
                    return 0
            except Exception as exc:  # retry all fetch/load failures at this boundary
                last_reason = str(exc)
                store.finish_attempt(attempt_id, "failed", observed_games, error=last_reason)
                print(f"[{seller}] attempt {attempt_no} failed: {last_reason}", flush=True)

        store.finish_run(
            run_id,
            max_attempts,
            "failed",
            observed_games,
            loaded_games,
            loaded_listings,
            last_reason,
        )
        alert = build_failure_alert(
            seller,
            max_attempts,
            last_reason,
            previous_success,
            observed_games,
        )
        send_telegram_alert(alert)
        print(alert, file=sys.stderr, flush=True)
        return 1
    finally:
        store.close()


def _run_uperagame(
    database_url: str,
    output_dir: str | Path,
    max_attempts: int,
    retry_delay_seconds: int,
    sleep_fn=time.sleep,
) -> int:
    """Run Upera's Crawl4AI pipeline through the same health contract."""
    seller = "uperagame"
    store = ScrapeRunStore(database_url)
    seller_id, previous_games, previous_success = store.seller_baseline(seller)
    run_id = store.start_run(seller_id)
    last_reason = "unknown scrape failure"
    observed_games: int | None = None
    loaded_games: int | None = None
    loaded_listings: int | None = None

    try:
        delays = [0, *retry_delays(max_attempts, retry_delay_seconds)]
        for attempt_no, delay in zip(range(1, max_attempts + 1), delays):
            if delay:
                print(f"[{seller}] retrying in {delay} seconds", flush=True)
                sleep_fn(delay)
            attempt_id = store.start_attempt(run_id, attempt_no)
            attempt_started = datetime.now(timezone.utc)
            try:
                with tempfile.TemporaryDirectory(prefix=f"gamexs-{seller}-", dir=str(output_dir)) as directory:
                    output_path = Path(directory)
                    games_cache = output_path / "uperagame_offers.jsonl"
                    plus_cache = output_path / "uperagame_ps_plus.jsonl"
                    report_path = output_path / "uperagame_report.json"
                    crawl_result = subprocess.run(
                        [
                            sys.executable,
                            str(SCRAPER_ROOT / "crawl_uperagame.py"),
                            "--output-dir",
                            str(output_path),
                            "--concurrency",
                            "4",
                        ],
                        cwd=SCRAPER_ROOT,
                        check=False,
                    )
                    if crawl_result.returncode != 0:
                        raise RuntimeError(f"crawl command exited with code {crawl_result.returncode}")

                    report = json.loads(report_path.read_text(encoding="utf-8"))
                    observed_games = int(report.get("game", {}).get("offers", count_jsonl_records(games_cache)))
                    fetch_failures = int(report.get("fetch_failure_count", 0))
                    quality = evaluate_game_count(observed_games, previous_games or None)
                    if fetch_failures:
                        quality = GameCountResult(False, f"crawl reported {fetch_failures} fetch failures")
                    if not quality.healthy:
                        last_reason = quality.reason
                        store.finish_attempt(attempt_id, "suspicious", observed_games, error=last_reason)
                        continue

                    load_result = subprocess.run(
                        [
                            sys.executable,
                            str(SCRAPER_ROOT / "load_uperagame_to_postgres.py"),
                            "--games-cache",
                            str(games_cache),
                            "--plus-cache",
                            str(plus_cache),
                        ],
                        cwd=SCRAPER_ROOT,
                        env={**os.environ, "DATABASE_URL": database_url},
                        check=False,
                    )
                    if load_result.returncode != 0:
                        raise RuntimeError(f"load command exited with code {load_result.returncode}")

                    loaded_games, loaded_listings = store.updated_counts(seller_id, attempt_started)
                    if loaded_games == 0 or loaded_listings == 0:
                        raise RuntimeError(
                            f"load completed but updated no listings ({loaded_games} games, {loaded_listings} listings)"
                        )

                    store.finish_attempt(
                        attempt_id,
                        "succeeded",
                        observed_games,
                        loaded_games,
                        loaded_listings,
                    )
                    store.finish_run(
                        run_id,
                        attempt_no,
                        "succeeded",
                        observed_games,
                        loaded_games,
                        loaded_listings,
                    )
                    print(
                        f"[{seller}] healthy scrape: {observed_games} games, "
                        f"{loaded_listings} listings updated",
                        flush=True,
                    )
                    return 0
            except Exception as exc:
                last_reason = str(exc)
                store.finish_attempt(attempt_id, "failed", observed_games, error=last_reason)
                print(f"[{seller}] attempt {attempt_no} failed: {last_reason}", flush=True)

        store.finish_run(
            run_id,
            max_attempts,
            "failed",
            observed_games,
            loaded_games,
            loaded_listings,
            last_reason,
        )
        alert = build_failure_alert(
            seller,
            max_attempts,
            last_reason,
            previous_success,
            observed_games,
        )
        send_telegram_alert(alert)
        print(alert, file=sys.stderr, flush=True)
        return 1
    finally:
        store.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Retry and health-check one GameXS seller scrape")
    parser.add_argument("seller")
    parser.add_argument("--db-url", default=None)
    parser.add_argument("--output-dir", default="/tmp")
    parser.add_argument("--max-attempts", type=int, default=None)
    args = parser.parse_args()

    database_url = args.db_url or os.environ.get("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 2
    try:
        max_attempts = args.max_attempts or _max_attempts()
        if max_attempts < 1:
            raise ValueError("max attempts must be positive")
        return run_seller(seller=args.seller, database_url=database_url, output_dir=args.output_dir, max_attempts=max_attempts)
    except (OSError, ValueError, psycopg.Error) as exc:
        reason = f"runner configuration/database error: {exc}"
        send_telegram_alert(
            build_failure_alert(
                args.seller,
                args.max_attempts or DEFAULT_MAX_ATTEMPTS,
                reason,
                None,
                None,
            )
        )
        print(reason, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
