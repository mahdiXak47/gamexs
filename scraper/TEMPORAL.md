# GameXS Temporal Scraper Worker

This image now runs as a long-running Temporal worker application instead of a
nightly CronJob.

## Temporal namespaces

Use two Temporal namespaces:

- `gamexs-sellers` — seller website scraping and DB loading.
- `gamexs-metadata` — IGDB enrichment, PlayStation Store prices, S3 image URL
  updates, and stale listing cleanup.

Create them once:

```bash
temporal operator namespace create --namespace gamexs-sellers --retention 7d --address <temporal-host>:7233
temporal operator namespace create --namespace gamexs-metadata --retention 7d --address <temporal-host>:7233
```

## Worker deployment

Deploy the scraper image as a background service with no exposed ports.

```bash
python -m gamexs_scraper.temporal.worker
```

Required env vars:

```env
TEMPORAL_ADDRESS=<temporal-host>:7233
TEMPORAL_SELLERS_NAMESPACE=gamexs-sellers
TEMPORAL_METADATA_NAMESPACE=gamexs-metadata
TEMPORAL_SELLERS_TASK_QUEUE=gamexs-seller-scrapers
TEMPORAL_METADATA_TASK_QUEUE=gamexs-metadata

DATABASE_URL=postgresql://...
IGDB_CLIENT_ID=...
IGDB_CLIENT_SECRET=...
S3_ENDPOINT_URL=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=...
HTTPS_PROXY=...
NO_PROXY=...
```

Optional tuning:

```env
SCRAPER_RUN_ARTIFACT_PREFIX=scraper-runs
SCRAPER_MAX_ACTIVITY_WORKERS=8
PSSTORE_WORKERS=4
```

## Manual smoke runs

Start the worker first, then run:

```bash
python -m gamexs_scraper.temporal.run_workflow sellers --limit-products 1
python -m gamexs_scraper.temporal.run_workflow metadata --igdb-limit 1 --psstore-limit 1
```

## Schedules

Create schedules in the Temporal UI or with the Temporal CLI.

Seller scrape schedule, matching the old CronJob time:

```bash
temporal schedule create \
  --address <temporal-host>:7233 \
  --namespace gamexs-sellers \
  --schedule-id gamexs-daily-seller-scrape \
  --cron "30 21 * * *" \
  --workflow-id "gamexs-sellers-{{.ScheduleTime}}" \
  --workflow-type SellerScrapeWorkflow \
  --task-queue gamexs-seller-scrapers \
  --input '{"artifact_prefix":"scraper-runs"}'
```

Metadata schedule, separated into its own namespace and delayed after sellers:

```bash
temporal schedule create \
  --address <temporal-host>:7233 \
  --namespace gamexs-metadata \
  --schedule-id gamexs-daily-metadata-refresh \
  --cron "30 23 * * *" \
  --workflow-id "gamexs-metadata-{{.ScheduleTime}}" \
  --workflow-type MetadataRefreshWorkflow \
  --task-queue gamexs-metadata \
  --input '{}'
```

Keep the old Kubernetes CronJobs disabled only after both Temporal schedules
have completed successfully in production.
