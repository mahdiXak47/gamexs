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

    sellers_client = await Client.connect(settings.address, namespace=settings.sellers_namespace)
    metadata_client = await Client.connect(settings.address, namespace=settings.metadata_namespace)

    with concurrent.futures.ThreadPoolExecutor(max_workers=settings.max_activity_workers) as activity_executor:
        sellers_worker = Worker(
            sellers_client,
            task_queue=settings.sellers_task_queue,
            workflows=[SellerScrapeWorkflow, SellerPriceLogWorkflow],
            activities=[scrape_seller_to_s3, load_seller_from_s3, log_seller_prices],
            activity_executor=activity_executor,
        )
        metadata_worker = Worker(
            metadata_client,
            task_queue=settings.metadata_task_queue,
            workflows=[MetadataRefreshWorkflow],
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
            ],
            activity_executor=activity_executor,
        )

        logging.info(
            "Starting GameXS Temporal workers: sellers namespace=%s task_queue=%s, metadata namespace=%s task_queue=%s",
            settings.sellers_namespace,
            settings.sellers_task_queue,
            settings.metadata_namespace,
            settings.metadata_task_queue,
        )
        await asyncio.gather(sellers_worker.run(), metadata_worker.run())


if __name__ == "__main__":
    asyncio.run(main())
