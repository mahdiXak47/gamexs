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

deployment/gamexs-scraper -> database, S3, seller sites
                  -> service/custom-xray (:10809) for outbound proxying
```

Resources observed in `mahdixak-gamexs`:

| Resource | Current role |
|---|---|
| `deployment/gamexs` | Next.js frontend, port 3000 |
| `deployment/gamexs-backend` | Django API, port 8000 |
| `deployment/gamexs-db` | PostgreSQL 16 with `gamexs-db-data` PVC |
| `deployment/gamexs-scraper` | Long-running scraper process (`python runner.py`) |
| `deployment/gamexs-ops` | Admin/ops panel (`admin/`), port 3000, gamexs-ops.darkube.app |
| `deployment/custom-xray` | HTTPS proxy, service port 10809 |
| `service/gamexs-db` | PostgreSQL service, currently a LoadBalancer |
| `service/gamexs` | Frontend ClusterIP service |
| `service/gamexs-backend` | Backend ClusterIP service |

The namespace contains no CronJobs or Jobs. The Deployments are Helm/Darkube
managed, so production changes should be made through the Darkube/Helm source
configuration and image release process, not by treating the old
`k8s/scraper-cronjob.yaml` as the production controller.

## Non-Temporal scraper contract

The replacement scraper Deployment must run the long-lived non-Temporal
`scraper/runner.py`. The runner supplies the scheduling behavior that the
removed Temporal workflow previously provided and invokes the existing one-shot
pipeline (`scrape_all.sh`). It starts one complete scrape/load cycle every
configured interval, counted from the start of the previous cycle:

```text
SCRAPER_INTERVAL_SECONDS=86400
command: ["python", "runner.py"]
```

`k8s/scraper-deployment-reference.yaml` records the corresponding
secret-backed Deployment shape for review. It is intentionally a reference;
Darkube/Helm remains the production source of truth.

The interval is configurable for operational needs, but a plain one-shot
process in a Deployment is not sufficient because Kubernetes would restart it
continuously without a defined schedule. The runner stops its active pipeline
cleanly on SIGTERM so a Deployment rollout does not leave a scrape subprocess
behind.

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

## Cycle time

Measured 2026-10-29 by running every adapter once from a workstation (same
1 request/second per shop as production). Before: sellers ran one after
another, each product page waited 1 s *after* the previous response, and the
runner slept 24 h after the cycle ended; the 2026-10-27 cycle also spent 29 h
transcoding trailers. Seller phase alone: about 8 h.

What changed:

- **Sellers run 3 at a time** (`SCRAPER_PARALLEL`, `scrape_all.sh`), slowest
  first. Each seller is a different site, so no shop gets more traffic. DB loads
  stay one at a time (`seller_runner.load_lock`). Memory: ~60–120 MB per seller
  on the 500 MB pod.
- **WooCommerce Store API** (`gamexs_scraper/woo_store.py`): for shops whose
  public `/wp-json/wc/store/v1/products?type=variation` works, one sweep (100
  variations per request) replaces every product-page fetch. Enabled per
  adapter with `woo_store_url` after its offers matched the page crawl exactly:
  gamario 587/587, gamecenter 408/408, xgamesstore 614/614, parsconsole
  1127/1127, gameaccess 547/547, gamepulse 402/402. gameonestore (simple disc
  products) reads the category from the same API: 370/371 matched; the odd one
  is a product the shop redirects to another game's page.
  Not used: cdkeyshare (API blocked, 403); yungcenter (three FC Ultimate pages
  redirect to the Standard product, which the API cannot see); gameplayshop
  (the API lists disabled variations and products whose page has no buy form:
  6 of 474 offers differed); nakhlmarket (custom variation markup);
  pspro/persianconsole/fillgame (not WooCommerce). The sweep is ordered by id
  and abandoned if the variation count changes mid-sweep.
- **The 1 s gap runs start to start** (`PoliteFetcher`): still at most one
  request per second, but no longer 1 s on top of each response.
- **Slow shops load 2–3 pages at once** (`product_workers`; cdkeyshare 3,
  gameplayshop 3, nakhlmarket 2, yungcenter 2): their pages take 2–4 s to answer, so requests
  overlap while starts stay 1 s apart.
- **Trailers have a time budget** (`TRAILERS_MAX_MINUTES`, default 60 per
  pass, ffmpeg at `nice 19`, x264 `superfast`); the backlog carries over.
- **The runner interval counts from the start of a cycle**, so a long cycle no
  longer pushes every later cycle back.

| Seller | Before (s) | After (s) | How |
|---|---:|---:|---|
| pspro | 2602 | 1548 | start-to-start gap |
| cdkeyshare | 3686 | 685 | 3 pages at once |
| nakhlmarket | 2177 | 829 | 2 pages at once |
| gameonestore | 2409 | 24 | Store API |
| gamario | 2265 | 171 | Store API |
| gameplayshop | 7778 | 1501 | 3 pages at once |
| yungcenter | 1818 | 445 | 2 pages at once |
| gamecenter | 1423 | 81 | Store API |
| parsconsole | 1132 | 83 | Store API |
| xgamesstore | 1032 | 92 | Store API |
| persianconsole | 788 | 530 | start-to-start gap |
| fillgame | 783 | 649 | start-to-start gap |
| uperagame | 338 | 338 | own crawler, unchanged |
| gameaccess (new) | 1648 | 176 | Store API |
| gamepulse (new) | 952 | 25 | Store API |
| gamestore (new) | 199 | 156 | |
| clockstore1 (new) | 126 | 129 | |
| gpgaming (new) | 83 | 45 | |
| digikala, technolife, psnacctm | 338 | 261 | |

Sum before: ~8 h one seller after another (16 sellers). After: ~2 h 15 min of
seller time for 21 sellers, 3 at a time with pspro and gameplayshop (~25 min
each) as the longest, so the seller phase takes about 45–50 minutes. Not
scheduled: dragonshop (adapter finds nothing), doctorgame (site down), hajigame
(no PS5 games).

## Required production configuration

The scraper runner must receive these settings through the Deployment or its
secret references:

```text
SCRAPER_INTERVAL_SECONDS=86400
DATABASE_URL=postgresql://...@gamexs-db.mahdixak-gamexs.svc:5432/gamexs
HTTPS_PROXY=http://custom-xray.mahdixak-gamexs.svc:10809
NO_PROXY=gamexs-db.mahdixak-gamexs.svc,localhost,127.0.0.1,10.0.0.0/8
IGDB_CLIENT_ID / IGDB_CLIENT_SECRET
S3_ENDPOINT_URL / S3_BUCKET / S3_ACCESS_KEY / S3_SECRET_KEY
TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID  # optional until the bot is created
```

Do not copy database credentials or secret values into this document, Git, or
container arguments.

## Production rollout checklist

1. Apply `db/migrations/027_add_uperagame_support.sql`.
2. Apply `db/migrations/028_allow_unenriched_games.sql` where the legacy compatibility state exists.
3. Apply catalog corrections and URL-compatibility migrations `030` and `031`
   before deploying the frontend that queries slug aliases.
4. Apply `db/migrations/032_add_scrape_health.sql` before deploying the health-aware runner.
5. Build an image containing `runner.py`, the non-Temporal pipeline, Crawl4AI Upera scraper,
   loader, and existing seller pipeline.
6. Push to `main`: Darkube builds and deploys `gamexs-scraper` from `scraper/Dockerfile`
   (git app, auto deploy on push).
7. Confirm the scraper pod is Ready and its logs show completed scrape/load
   cycles, not worker connection retries.
8. Run the database verification queries below, including recent `scrape_runs`.
9. Confirm the frontend and backend deployments use the same `gamexs-db`
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
- Seller processing retries twice after the initial attempt with a fixed
  30-second delay. Zero-game or greater-than-50%-drop snapshots are not loaded.
- Do not enable Telegram delivery until both bot credentials are stored as
  deployment secrets; never place the bot token in Git or command arguments.
- A failed loader transaction is rolled back; fix the cause and retry the same
  snapshot.
- IGDB enrichment is separate from price loading. It requires outbound access
  through `custom-xray`; a failed enrichment must not prevent seller prices from
  being loaded.
- Deployment objects are Helm/Darkube managed. Direct `kubectl set image` or
  manual edits are temporary and can be overwritten by the next reconciliation.
