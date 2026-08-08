from __future__ import annotations

import asyncio
import concurrent.futures
import logging

from temporalio.client import Client
from temporalio.worker import Worker

from gamexs_scraper.temporal.activities import (
    cleanup_stale_listings,
    enrich_igdb_metadata,
    fetch_playstation_store_prices,
    fetch_playstation_store_region_price,
    fetch_playstation_store_tr_price,
    fetch_playstation_store_us_price,
    load_seller_from_s3,
    log_seller_prices,
    resolve_playstation_store_games,
    scrape_seller_to_s3,
    upsert_playstation_store_game_price,
    upload_igdb_images_to_s3,
)
from gamexs_scraper.temporal.config import settings_from_env
from gamexs_scraper.temporal.workflows import MetadataRefreshWorkflow, SellerPriceLogWorkflow, SellerScrapeWorkflow


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    settings = settings_from_env()

    metadata_client = await Client.connect(settings.address, namespace=settings.metadata_namespace)

    with concurrent.futures.ThreadPoolExecutor(max_workers=settings.max_activity_workers) as activity_executor:
        metadata_worker = Worker(
            metadata_client,
            task_queue=settings.metadata_task_queue,
            workflows=[MetadataRefreshWorkflow, SellerPriceLogWorkflow],
            activities=[
                enrich_igdb_metadata,
                fetch_playstation_store_prices,
                resolve_playstation_store_games,
                fetch_playstation_store_region_price,
                fetch_playstation_store_us_price,
                fetch_playstation_store_tr_price,
                upsert_playstation_store_game_price,
                upload_igdb_images_to_s3,
                cleanup_stale_listings,
                log_seller_prices,
            ],
            activity_executor=activity_executor,
        )

        workers = [metadata_worker.run()]

        # The sellers namespace may not exist on this deployment — skip
        # gracefully rather than crashing the whole worker pod.
        try:
            sellers_client = await Client.connect(settings.address, namespace=settings.sellers_namespace)
            sellers_worker = Worker(
                sellers_client,
                task_queue=settings.sellers_task_queue,
                workflows=[SellerScrapeWorkflow, SellerPriceLogWorkflow],
                activities=[scrape_seller_to_s3, load_seller_from_s3, log_seller_prices],
                activity_executor=activity_executor,
            )
            workers.append(sellers_worker.run())
            logging.info(
                "Starting GameXS Temporal workers: metadata namespace=%s task_queue=%s, sellers namespace=%s task_queue=%s",
                settings.metadata_namespace,
                settings.metadata_task_queue,
                settings.sellers_namespace,
                settings.sellers_task_queue,
            )
        except Exception as exc:
            logging.warning(
                "Sellers namespace '%s' not available (skipping): %s",
                settings.sellers_namespace,
                exc,
            )
            logging.info(
                "Starting GameXS Temporal workers: metadata namespace=%s task_queue=%s (sellers skipped)",
                settings.metadata_namespace,
                settings.metadata_task_queue,
            )

        await asyncio.gather(*workers)


if __name__ == "__main__":
    asyncio.run(main())
