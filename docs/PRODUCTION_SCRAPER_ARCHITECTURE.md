# GameXS Production Scraper Architecture

This document records the production scraper architecture observed in the
`mahdixak-gamexs` namespace on 2026-09-03 and the operational contract for
loading seller prices into GameXS.

## Important status

Temporal is not part of the current architecture design. The production
`scraper` Deployment is still running an old Temporal-worker image:

```text
image:   registry.hamdocker.ir/mahdixak/gamexs-scraper-workflows:0.5.2
command: python -m gamexs_scraper.temporal.worker
```

Its logs show repeated DNS failures for `temporal-server.mahdixak-gamexs.svc`.
This is a stale deployment artifact, not a reason to restore Temporal. It must
be replaced by the non-Temporal scraper runner before production scraping can
be considered healthy.

## Observed namespace topology

```text
gamexs.ir / www.gamexs.ir
        |
        v
  Ingress -> service/gamexs -> deployment/gamexs (Next.js, :3000)
                                      |
api.gamexs.ir                              v
        |                           service/gamexs-db
        v                                  |
service/gamexs-backend -> deployment/   PostgreSQL 16
                          gamexs-backend  deployment/gamexs-db

deployment/scraper -> database, S3, seller sites
                  -> service/custom-xray (:10809) for outbound proxying
```

Resources observed in `mahdixak-gamexs`:

| Resource | Current role |
|---|---|
| `deployment/gamexs` | Next.js frontend, port 3000 |
| `deployment/gamexs-backend` | Django API, port 8000 |
| `deployment/gamexs-db` | PostgreSQL 16 with `gamexs-db-data` PVC |
| `deployment/scraper` | Long-running scraper process; currently stale Temporal command |
| `deployment/custom-xray` | HTTPS proxy, service port 10809 |
| `service/gamexs-db` | PostgreSQL service, currently a LoadBalancer |
| `service/gamexs` | Frontend ClusterIP service |
| `service/gamexs-backend` | Backend ClusterIP service |

The namespace contains no CronJobs or Jobs. The Deployments are Helm/Darkube
managed, so production changes should be made through the Darkube/Helm source
configuration and image release process, not by treating the old
`k8s/scraper-cronjob.yaml` as the production controller.

## Non-Temporal scraper contract

The replacement scraper Deployment must run a long-lived non-Temporal runner.
The runner needs to provide the scheduling behavior that the removed Temporal
workflow previously provided. The current repository still has one-shot
building blocks (`scrape_all.sh`, `crawl_uperagame.py`, and the loaders), so the
runner must either:

1. execute one complete scrape/load cycle and sleep for the configured interval;
2. expose an internal authenticated trigger and remain idle between runs; or
3. be started by an external scheduler outside this namespace.

The production source of truth must choose one of these explicitly. A plain
one-shot process in a Deployment is not sufficient because Kubernetes will
restart it continuously without a defined schedule.

## Seller price data flow

```text
seller website
    -> seller adapter or Crawl4AI extractor
    -> normalized RawOffer / Upera JSONL
    -> transactional PostgreSQL loader
    -> listings + append-only price_history
    -> frontend repository queries latest price per listing
```

For Upera, the Crawl4AI extractor writes:

- `scraper/output/uperagame_offers.jsonl`
- `scraper/output/uperagame_ps_plus.jsonl`
- `scraper/output/uperagame_report.json`

The game contract has no `image_url`. It maps regular capacities to
`account_game` plus `capacity_1`, `capacity_2`, or `capacity_3`; full capacity
to `own_account_game`; and physical products to `disc`. PlayStation Plus rows
are stored in `ps_plus` and `ps_plus_price_history`.

The Upera loader is:

```text
scraper/load_uperagame_to_postgres.py
```

It requires migrations 027 and 028. Migration 027 registers the seller and
supports multiple product types/capacities per source URL. Migration 028
allows new games to exist before IGDB enrichment fills `igdb_id`.

## Required production configuration

The scraper runner must receive these settings through the Deployment or its
secret references:

```text
DATABASE_URL=postgresql://...@gamexs-db.mahdixak-gamexs.svc:5432/gamexs
HTTPS_PROXY=http://custom-xray.mahdixak-gamexs.svc:10809
NO_PROXY=gamexs-db.mahdixak-gamexs.svc,localhost,127.0.0.1,10.0.0.0/8
IGDB_CLIENT_ID / IGDB_CLIENT_SECRET
S3_ENDPOINT_URL / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY
```

Do not copy database credentials or secret values into this document, Git, or
container arguments.

## Production rollout checklist

1. Apply `db/migrations/027_add_uperagame_support.sql`.
2. Apply `db/migrations/028_allow_unenriched_games.sql`.
3. Build an image containing the non-Temporal runner, Crawl4AI Upera scraper,
   loader, and existing seller pipeline.
4. Configure the `scraper` Deployment through Darkube/Helm with the new image
   and the selected scheduling mechanism.
5. Confirm the scraper pod is Ready and its logs show completed scrape/load
   cycles, not worker connection retries.
6. Run the database verification queries below.
7. Confirm the frontend and backend deployments use the same `gamexs-db`
   service and deploy frontend code that renders `OWN_ACCOUNT_GAME` and `DISC`.

## Read-only health checks

```bash
kubectl -n mahdixak-gamexs get deployments,pods,services
kubectl -n mahdixak-gamexs logs deployment/scraper --since=30m --tail=200
kubectl -n mahdixak-gamexs get endpoints gamexs-db
```

Database checks, from a trusted host with production database access:

```sql
SELECT id, slug, name
FROM sellers
WHERE slug = 'uperagame';

SELECT
    l.product_type,
    l.tier,
    COUNT(*) AS listings
FROM listings l
JOIN sellers s ON s.id = l.seller_id
WHERE s.slug = 'uperagame'
  AND l.is_active = true
GROUP BY l.product_type, l.tier
ORDER BY l.product_type, l.tier;

SELECT
    COUNT(DISTINCT l.game_id) AS games,
    COUNT(DISTINCT l.id) AS listings,
    COUNT(ph.id) AS price_points
FROM listings l
JOIN sellers s ON s.id = l.seller_id
LEFT JOIN price_history ph ON ph.listing_id = l.id
WHERE s.slug = 'uperagame'
  AND l.is_active = true;
```

## Operational cautions

- Do not run the old CronJob manifest; no CronJob exists in the current
  production design.
- Do not run global stale-listing maintenance after a failed scrape/load.
- A failed loader transaction is rolled back; fix the cause and retry the same
  snapshot.
- IGDB enrichment is separate from price loading. It requires outbound access
  through `custom-xray`; a failed enrichment must not prevent seller prices from
  being loaded.
- Deployment objects are Helm/Darkube managed. Direct `kubectl set image` or
  manual edits are temporary and can be overwritten by the next reconciliation.
