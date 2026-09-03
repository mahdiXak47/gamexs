# GameXS Database Architecture and Operations

This is the internal reference for the GameXS PostgreSQL database in local
development and production. It describes the schema ownership, seller-price
data model, migration rules, connection topology, and verification procedures.

Last infrastructure verification: **2026-09-03**.

## System role

GameXS is a read-only price comparison service. Seller sites are the source of
offers; GameXS stores normalized catalog identities, seller listings, and
append-only price observations. The frontend reads the database to display
prices and links customers to the seller's `source_url`. GameXS does not
checkout or own seller inventory.

```text
seller sites / PS Store / IGDB
             |
             v
   scraper adapters and Crawl4AI
             |
             v
     PostgreSQL (GameXS DB)
       |                 |
       v                 v
  Next.js frontend   Django backend
```

## Local database

Local PostgreSQL is defined in the repository's root `docker-compose.yml`:

| Item | Configuration |
|---|---|
| Container | `gamexs-postgres` |
| Image | `postgres:16` |
| Database/user | `gamexs` / `gamexs` by default |
| Host port | `${POSTGRES_PORT}`, default `5432` |
| Data volume | `gamexs_pgdata` |
| Init directory | `db/init/` |

The root `.env` commonly overrides the port to `5434` when another local
PostgreSQL already owns `5432`. Connection URLs are kept in `.env` and should
not be committed:

```text
LOCAL_DATABASE_URL=postgresql://gamexs:<password>@localhost:<port>/gamexs
```

Start and inspect the local database:

```bash
docker compose up -d db
docker ps --filter name=gamexs-postgres
psql "$LOCAL_DATABASE_URL" -c "SELECT current_database(), current_user;"
```

`db/init/*.sql` runs only when the PostgreSQL data volume is initialized for
the first time. Changes to an existing local database must use a numbered
migration. Recreating the volume is acceptable only when local data can be
discarded:

```bash
docker compose down -v
docker compose up -d db
```

## Production database

The verified production namespace is `mahdixak-gamexs`. PostgreSQL currently
runs as a Helm/Darkube-managed Deployment:

| Item | Observed value |
|---|---|
| Deployment | `gamexs-db` |
| Image | `postgres:16` |
| Replicas | `1` |
| Persistent volume | `gamexs-db-data` |
| Volume size | `1Gi` |
| Access mode | `ReadWriteOnce` |
| Internal service | `gamexs-db.mahdixak-gamexs.svc:5432` |
| Service type | `LoadBalancer` |

Frontend, backend, and the scraper use the internal service name and database
`gamexs`. The database password is supplied through Kubernetes Secret
references. Never put secret values in this document, Git, image arguments, or
logs.

Production resources are Darkube/Helm managed. The current namespace contains
Deployments rather than the old CronJob design. Database migrations should be
run from a trusted host with production DB connectivity or by the authorized
database operator; do not mutate the database through ad-hoc application
requests.

## Logical schema

### Catalog and seller offers

| Table | Purpose | Main identity/relationship |
|---|---|---|
| `platforms` | Platform lookup | `slug`, currently PS5 |
| `sellers` | Seller registry | unique `slug`; includes `uperagame` |
| `ps5_games` | Canonical/display catalog rows | unique `(platform_id, slug)`; nullable unique `igdb_id` |
| `ps5_game_aliases` | Explicit seller/IGDB name aliases | unique `(platform_id, normalized_name)` |
| `listings` | Stable seller offer identity | `(seller_id, source_url, product_type, tier)` |
| `price_history` | Price and stock observations | append-only `(listing_id, scraped_at)` |

`listings` is not the current price table. To obtain the current price, select
the newest `price_history` row for each listing. A price change creates a new
history row and does not change the listing identity.

### Product taxonomy

Database enums use uppercase values:

```text
product_type: ACCOUNT_GAME | OWN_ACCOUNT_GAME | DISC
access_tier:  CAPACITY_1 | CAPACITY_2 | CAPACITY_3
```

The `tier` check constraint requires a tier only for `ACCOUNT_GAME`:

| Product | Database type | Tier |
|---|---|---|
| Account capacity 1/2/3 | `ACCOUNT_GAME` | `CAPACITY_1/2/3` |
| Full-capacity account | `OWN_ACCOUNT_GAME` | `NULL` |
| Physical disc | `DISC` | `NULL` |

Scraper Python enums use lowercase names and the loader converts them to the
database enum values. Do not insert scraper lowercase values directly with
SQL.

### PlayStation Plus

PS Plus is intentionally separate from game listings:

| Table | Purpose |
|---|---|
| `ps_plus` | Subscription identity: tier, seller, capacity, term, URL |
| `ps_plus_price_history` | Append-only subscription price/stock history |

The PS Plus identity is unique on `(tier, seller_id, capacity, term)`. Terms
such as `3months` and `1year` must remain distinct.

### Official store and application data

The schema also includes:

- `ps5_game_tr_info` and `ps5_game_us_info` for regional PS Store data;
- editorial fields on `ps5_games`;
- page-view tables: `game_page_view_stats`, `game_page_view_daily`, and
  `game_page_view_uniques`;
- `web_vitals` and `site_page_views` for observability/analytics.

The Django `catalog` app maps the catalog tables with `managed = False`.
Django must not create or migrate `ps5_games`, `sellers`, or `listings`.

## Data ownership and write paths

| Data | Writer | Reader |
|---|---|---|
| `platforms`, `sellers` | seed/migrations | scraper, frontend, backend |
| `ps5_games` | scraper loader, IGDB enrichment, editorial tools | frontend/backend |
| `ps5_game_aliases` | catalog/import tooling | scraper loader |
| `listings` | seller loaders | frontend/backend |
| `price_history` | seller loaders | frontend charts/current-price queries |
| `ps_plus*` | PS Plus seller loaders | frontend |
| application tables | Django backend | backend/frontend as applicable |

Never update `price_history` in place and never use an all-time historical
minimum as the current price. Current-price queries must select the newest
observation per listing.

## Migration policy

There are two schema layers and they must stay aligned:

1. `db/init/01_schema.sql` and `db/init/02_seed.sql` define fresh databases.
2. `db/migrations/001_...` onward update existing databases.

For every schema change:

- update the fresh-install schema when applicable;
- add one numbered migration for existing local and production databases;
- make SQL migrations safe to run again where practical;
- apply and verify the migration locally before production;
- record the migration in the deployment change notes.

Relevant seller/Upera migrations:

| Migration | Change |
|---|---|
| `002_extract_ps_plus.sql` | Creates/migrates dedicated PS Plus tables |
| `027_add_uperagame_support.sql` | Registers Upera and supports type/tier and term identities |
| `028_allow_unenriched_games.sql` | Allows new games before IGDB enrichment |

Migration 028 is required because the scraper may create a new `ps5_games`
row before `enrich_metadata` resolves its `igdb_id`.

## Applying a seller snapshot

For local or production, the safe order is:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/027_add_uperagame_support.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f db/migrations/028_allow_unenriched_games.sql

DATABASE_URL="$DATABASE_URL" PYTHONPATH=scraper \
  scraper/.venv/bin/python scraper/load_uperagame_to_postgres.py \
  --games-cache scraper/output/uperagame_offers.jsonl \
  --plus-cache scraper/output/uperagame_ps_plus.jsonl
```

The loader uses one database transaction for Upera game and PS Plus data. A
failure rolls the load back, so fix the cause and retry the same snapshot.

For a fresh database, initialize `db/init/` first and then apply the numbered
migrations required by the current application, including 002, 027, and 028.

## Verification queries

Seller registration:

```sql
SELECT id, slug, name, is_active
FROM sellers
WHERE slug = 'uperagame';
```

Upera listing distribution:

```sql
SELECT l.product_type, l.tier, COUNT(*) AS listings
FROM listings l
JOIN sellers s ON s.id = l.seller_id
WHERE s.slug = 'uperagame' AND l.is_active
GROUP BY l.product_type, l.tier
ORDER BY l.product_type, l.tier;
```

Latest Upera prices:

```sql
WITH latest AS (
    SELECT DISTINCT ON (ph.listing_id)
        ph.listing_id, ph.price_toman, ph.in_stock, ph.scraped_at
    FROM price_history ph
    ORDER BY ph.listing_id, ph.scraped_at DESC
)
SELECT g.title, l.product_type, l.tier, latest.price_toman,
       latest.in_stock, latest.scraped_at, l.source_url
FROM latest
JOIN listings l ON l.id = latest.listing_id
JOIN sellers s ON s.id = l.seller_id
JOIN ps5_games g ON g.id = l.game_id
WHERE s.slug = 'uperagame' AND l.is_active
ORDER BY g.title, l.product_type, l.tier;
```

Data freshness and integrity:

```sql
SELECT
    COUNT(DISTINCT l.game_id) AS games,
    COUNT(DISTINCT l.id) AS listings,
    COUNT(ph.id) AS price_points,
    MAX(ph.scraped_at) AS newest_price_at
FROM listings l
JOIN sellers s ON s.id = l.seller_id
LEFT JOIN price_history ph ON ph.listing_id = l.id
WHERE s.slug = 'uperagame' AND l.is_active;
```

## Backup and safety

Before production schema changes, take a logical backup from a trusted host:

```bash
pg_dump "$PRODUCTION_DATABASE_URL" \
  --format=custom \
  --file=/private/tmp/gamexs-production-$(date +%Y%m%d-%H%M%S).dump
```

Migrations are forward changes. Do not use `DROP`, `TRUNCATE`, volume deletion,
or `docker compose down -v` against production. If a migration fails, PostgreSQL
transactional migrations should be corrected and rerun; do not manually delete
partial rows unless a recovery plan exists.

Global stale-listing maintenance can deactivate listings across every seller
and remove orphan catalog rows. Run it only after a successful complete scrape
and load, never after a failed seller run.

## Keeping this document current

After a database or deployment change, update this document with:

1. migration number and purpose;
2. local connection/init impact;
3. production Deployment, Service, PVC, or secret-reference changes;
4. loader/data-contract changes;
5. verification results and the verification date.

The database DDL remains authoritative for exact column definitions:
`db/init/01_schema.sql` plus the numbered migrations. This document is the
operational context and should link to those files instead of duplicating every
DDL statement.
