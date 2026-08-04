from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


NO_RETRY = RetryPolicy(maximum_attempts=1)
PSSTORE_REGIONS: tuple[str, ...] = ("us", "tr")
DEFAULT_SELLER_PAIRS: tuple[tuple[str, ...], ...] = (
    ("pspro", "digikala"),
    ("gamario", "gameonestore"),
    ("gamecenter", "gameplayshop"),
    ("xgamesstore", "nakhlmarket"),
    ("parsconsole", "cdkeyshare"),
    ("persianconsole", "yungcenter"),
    ("technolife",),
)


def _activity_id_part(value: object, max_length: int = 60) -> str:
    text = str(value or "unknown").lower()
    cleaned = "".join(ch if ch.isalnum() else "-" for ch in text)
    cleaned = "-".join(part for part in cleaned.split("-") if part)
    return (cleaned or "unknown")[:max_length]


@workflow.defn
class SellerScrapeWorkflow:
    """Scrape seller websites and load seller listings into the GameXS DB."""

    @workflow.run
    async def run(self, input: dict | None = None) -> dict:
        input = input or {}
        workflow_id = workflow.info().workflow_id
        artifact_prefix = input.get("artifact_prefix", "scraper-runs")
        seller_pairs = input.get("seller_pairs") or DEFAULT_SELLER_PAIRS
        limit_products = input.get("limit_products")

        failed: list[dict] = []
        pairs: list[dict] = []

        for pair in seller_pairs:
            scrape_futures = [
                workflow.execute_activity(
                    "scrape_seller_to_s3",
                    {
                        "seller": seller,
                        "workflow_id": workflow_id,
                        "artifact_prefix": artifact_prefix,
                        "limit_products": limit_products,
                    },
                    start_to_close_timeout=timedelta(hours=5),
                    retry_policy=NO_RETRY,
                )
                for seller in pair
            ]

            scrape_results = []
            for seller, scrape_future in zip(pair, scrape_futures):
                try:
                    scrape_results.append(await scrape_future)
                except Exception as exc:
                    failure = {"seller": seller, "stage": "scrape", "error": str(exc)}
                    failed.append(failure)
                    scrape_results.append(failure)

            load_results = []
            for result in scrape_results:
                if "artifact_key" not in result:
                    continue
                seller = result["seller"]
                try:
                    load_result = await workflow.execute_activity(
                        "load_seller_from_s3",
                        result,
                        start_to_close_timeout=timedelta(hours=2),
                        retry_policy=NO_RETRY,
                    )
                    load_results.append(load_result)
                except Exception as exc:
                    failed.append({"seller": seller, "stage": "load", "error": str(exc)})

            pairs.append({"sellers": list(pair), "scrape": scrape_results, "load": load_results})

        summary = {"status": "failed" if failed else "ok", "pairs": pairs, "failed": failed}
        if failed:
            raise RuntimeError(f"seller scrape workflow completed with failures: {failed}")
        return summary


@workflow.defn
class MetadataRefreshWorkflow:
    """Refresh IGDB metadata, PS Store prices, S3 image URLs, and stale rows."""

    async def _refresh_playstation_store_prices(self, input: dict) -> dict:
        resolved = await workflow.execute_activity(
            "resolve_playstation_store_games",
            {
                "limit": input.get("psstore_limit"),
                "skip_recent_hours": input.get("psstore_skip_recent_hours", 12),
            },
            start_to_close_timeout=timedelta(hours=1),
            retry_policy=NO_RETRY,
            activity_id="psstore-resolve-games",
            summary="Resolve PS Store concepts",
        )

        games = resolved.get("games", [])
        batch_size = int(input.get("psstore_batch_size") or input.get("psstore_workers") or 4)
        batch_size = max(1, batch_size)
        game_results: list[dict] = []
        failures: list[dict] = []

        for batch_start in range(0, len(games), batch_size):
            batch = games[batch_start : batch_start + batch_size]
            fetches: list[tuple[dict, str, object]] = []
            for game in batch:
                concept_part = _activity_id_part(game["concept_id"], 80)
                for region in PSSTORE_REGIONS:
                    fetches.append(
                        (
                            game,
                            region,
                            workflow.execute_activity(
                                f"fetch_playstation_store_{region}_price",
                                game,
                                start_to_close_timeout=timedelta(minutes=5),
                                retry_policy=NO_RETRY,
                                activity_id=f"psstore-{concept_part}-{region}",
                                summary=f"PS Store {region.upper()}: {game['game_name']}",
                            ),
                        )
                    )

            prices_by_concept: dict[str, list[dict]] = {}
            games_by_concept: dict[str, dict] = {}
            for game, region, future in fetches:
                games_by_concept[game["concept_id"]] = game
                try:
                    price = await future
                    prices_by_concept.setdefault(game["concept_id"], []).append(price)
                except Exception as exc:
                    failures.append(
                        {
                            "stage": "psstore_fetch",
                            "game_name": game["game_name"],
                            "concept_id": game["concept_id"],
                            "region": region,
                            "error": str(exc),
                        }
                    )

            for concept_id, prices in prices_by_concept.items():
                game = games_by_concept[concept_id]
                concept_part = _activity_id_part(concept_id, 80)
                try:
                    game_results.append(
                        await workflow.execute_activity(
                            "upsert_playstation_store_game_price",
                            {"game": game, "prices": prices},
                            start_to_close_timeout=timedelta(minutes=2),
                            retry_policy=NO_RETRY,
                            activity_id=f"psstore-upsert-{concept_part}",
                            summary=f"Save PS Store prices: {game['game_name']}",
                        )
                    )
                except Exception as exc:
                    failures.append(
                        {
                            "stage": "psstore_upsert",
                            "game_name": game["game_name"],
                            "concept_id": concept_id,
                            "error": str(exc),
                        }
                    )

        return {
            **resolved,
            "updated_count": len(game_results),
            "games": game_results,
            "failures": failures,
        }

    @workflow.run
    async def run(self, input: dict | None = None) -> dict:
        input = input or {}
        soft_failures: list[dict] = []
        results: dict[str, object] = {}

        for name, activity_name, payload, timeout, activity_id, summary in (
            (
                "igdb",
                "enrich_igdb_metadata",
                {"limit": input.get("igdb_limit"), "all": input.get("igdb_all")},
                4,
                "igdb-enrich-metadata",
                "Enrich IGDB metadata",
            ),
        ):
            try:
                results[name] = await workflow.execute_activity(
                    activity_name,
                    payload,
                    start_to_close_timeout=timedelta(hours=timeout),
                    retry_policy=NO_RETRY,
                    activity_id=activity_id,
                    summary=summary,
                )
            except Exception as exc:
                soft_failures.append({"stage": name, "error": str(exc)})

        try:
            results["psstore"] = await self._refresh_playstation_store_prices(input)
            for failure in results["psstore"].get("failures", []):
                soft_failures.append(failure)
        except Exception as exc:
            soft_failures.append({"stage": "psstore", "error": str(exc)})

        for name, activity_name, payload, timeout, activity_id, summary in (
            ("s3", "upload_igdb_images_to_s3", {}, 2, "s3-upload-igdb-images", "Upload IGDB images to S3"),
            (
                "cleanup",
                "cleanup_stale_listings",
                {"stale_days": input.get("stale_days", 3)},
                1,
                "cleanup-stale-listings",
                "Cleanup stale listings",
            ),
        ):
            try:
                results[name] = await workflow.execute_activity(
                    activity_name,
                    payload,
                    start_to_close_timeout=timedelta(hours=timeout),
                    retry_policy=NO_RETRY,
                    activity_id=activity_id,
                    summary=summary,
                )
            except Exception as exc:
                soft_failures.append({"stage": name, "error": str(exc)})

        return {
            "status": "completed_with_soft_failures" if soft_failures else "ok",
            "results": results,
            "soft_failures": soft_failures,
        }
