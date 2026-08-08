from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone

from temporalio.client import Client

from gamexs_scraper.temporal.config import settings_from_env
from gamexs_scraper.temporal.workflows import MetadataRefreshWorkflow, SellerPriceLogWorkflow, SellerScrapeWorkflow


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Start a GameXS Temporal workflow")
    parser.add_argument("workflow", choices=["sellers", "metadata", "log-prices"])
    parser.add_argument("--id", default=None, help="Workflow id. Defaults to gamexs-<workflow>-<timestamp>.")
    parser.add_argument("--limit-products", type=int, default=None, help="Seller workflow product limit for smoke tests")
    parser.add_argument("--igdb-limit", type=int, default=None)
    parser.add_argument("--psstore-limit", type=int, default=None)
    args = parser.parse_args()

    settings = settings_from_env()
    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    if args.workflow == "sellers":
        client = await Client.connect(settings.address, namespace=settings.sellers_namespace)
        workflow_id = args.id or f"gamexs-sellers-{now}"
        result = await client.execute_workflow(
            SellerScrapeWorkflow.run,
            {"artifact_prefix": settings.artifact_prefix, "limit_products": args.limit_products},
            id=workflow_id,
            task_queue=settings.sellers_task_queue,
        )
    elif args.workflow == "log-prices":
        client = await Client.connect(settings.address, namespace=settings.sellers_namespace)
        workflow_id = args.id or f"gamexs-log-prices-{now}"
        result = await client.execute_workflow(
            SellerPriceLogWorkflow.run,
            {"seller": "gpgaming"},
            id=workflow_id,
            task_queue=settings.sellers_task_queue,
        )
    else:
        client = await Client.connect(settings.address, namespace=settings.metadata_namespace)
        workflow_id = args.id or f"gamexs-metadata-{now}"
        result = await client.execute_workflow(
            MetadataRefreshWorkflow.run,
            {"igdb_limit": args.igdb_limit, "psstore_limit": args.psstore_limit},
            id=workflow_id,
            task_queue=settings.metadata_task_queue,
        )

    print(result)


if __name__ == "__main__":
    asyncio.run(_main())
