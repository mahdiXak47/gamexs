from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy


NO_RETRY = RetryPolicy(maximum_attempts=1)
DEFAULT_SELLER_PAIRS: tuple[tuple[str, ...], ...] = (
    ("pspro", "digikala"),
    ("gamario", "gameonestore"),
    ("gamecenter", "gameplayshop"),
    ("xgamesstore", "nakhlmarket"),
    ("parsconsole", "cdkeyshare"),
    ("persianconsole", "yungcenter"),
    ("technolife",),
)


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

    @workflow.run
    async def run(self, input: dict | None = None) -> dict:
        input = input or {}
        soft_failures: list[dict] = []
        results: dict[str, object] = {}

        for name, activity_name, payload, timeout in (
            ("igdb", "enrich_igdb_metadata", {"limit": input.get("igdb_limit"), "all": input.get("igdb_all")}, 4),
            (
                "psstore",
                "fetch_playstation_store_prices",
                {"limit": input.get("psstore_limit"), "workers": input.get("psstore_workers")},
                2,
            ),
            ("s3", "upload_igdb_images_to_s3", {}, 2),
            ("cleanup", "cleanup_stale_listings", {"stale_days": input.get("stale_days", 3)}, 1),
        ):
            try:
                results[name] = await workflow.execute_activity(
                    activity_name,
                    payload,
                    start_to_close_timeout=timedelta(hours=timeout),
                    retry_policy=NO_RETRY,
                )
            except Exception as exc:
                soft_failures.append({"stage": name, "error": str(exc)})

        return {
            "status": "completed_with_soft_failures" if soft_failures else "ok",
            "results": results,
            "soft_failures": soft_failures,
        }
