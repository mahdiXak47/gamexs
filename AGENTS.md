# AGENTS.md

Guidance for agent sessions (OpenCode / Codex) working in this repository.

## What this is

GameXS is a price-comparison service for Iranian PS5 game/account/subscription
retailers. Pure comparison, not a marketplace — every price row links out to the
seller's own site; no checkout here. Domain model / product taxonomy:
**`docs/PROJECT_CONTEXT.md`** (its "known gaps"/build-status sections are
historical — it predates the DB and frontend; use **`TODO.md`** for current
status).

Monorepo packages (plus shared infra):

- `scraper/` — Python, scrapes 21 Iranian seller sites, loads into Postgres, enriches via IGDB.
- `db/` — Postgres 16 schema (`ps5_games`, `sellers`, `listings`, `price_history`, plus migration-managed `ps_plus`, `ps5_store_info`).
- `frontend/` — Next.js 16 UI, reads directly from the Postgres DB (no mock data).
- `backend/` — Django 5.1 REST API, user accounts, auth, cart, orders, tickets.
- `xray-proxy/` — HTTPS proxy + proxy-finder used by the scraper to reach Iranian sites.
- `k8s/` — production manifests (scraper CronJob, PS-Store price CronJob, proxy).

The scraper writes to the DB, the frontend reads from it, the backend shares the
same DB while managing its own user-facing tables.

## Workflow expectation

- For every GameXS change, include a suggested commit message for each distinct
  fix or behavior change in the final response.

## The product taxonomy (needed to understand any of the three pieces)

A single game can be sold multiple ways simultaneously, each a different price:

- **Account capacity 1** — full account handover, buyer must play offline only.
- **Account capacity 2** — shared account, online *and* offline.
- **Account capacity 3** — shared account, online only (cheapest, most restrictive).
- **Own-account purchase** — digital code activated on the customer's own PSN account (in practice almost never offered — see pspro note below).
- **Physical disc** — no tier concept.

The taxonomy is broader in the scraper than what the DB/frontend can hold, with
**different casing conventions** per layer — a real gotcha on the scraper→DB path:

| Layer | Type / Tier | Values |
|---|---|---|
| `scraper/gamexs_scraper/models.py` (`ProductType`/`AccessTier`, Python `str` enums) | lowercase snake_case | `"account_game"`, `"capacity_1"` (also `"subscription"`, `"gift_card"`, `"full_capacity"`) |
| `db/init/01_schema.sql` (`product_type`/`access_tier`, Postgres enums) | UPPER_SNAKE | `'ACCOUNT_GAME'`, `'CAPACITY_1'` — **only** `ACCOUNT_GAME`/`OWN_ACCOUNT_GAME`/`DISC` and `CAPACITY_1..3` |
| `frontend/src/lib/types.ts` (TS unions) | UPPER_SNAKE | same three as DB |
| `backend/apps/orders/models.py` (CharField) | UPPER_SNAKE | values passed through, not re-validated |

Gap worth knowing: the scraper enum defines `SUBSCRIPTION` and `GIFT_CARD`, but the
DB `product_type` enum and the frontend `ProductType` union do **not** include them.
Subscription offers are stored separately in the `ps_plus` tables (migration 002);
gift cards have no DB/home anywhere — a `GIFT_CARD` offer from an adapter cannot be
loaded into `listings` today.

The DB enforces via a `CHECK` constraint that `tier` is set iff
`product_type = 'ACCOUNT_GAME'`.

## `scraper/` (Python)

```bash
cd scraper
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first-time setup
.venv/bin/python -m gamexs_scraper.cli pspro --limit 5               # print raw offers as JSON (no file output)
.venv/bin/python -m gamexs_scraper.cli gpgaming --limit 5            # test the gpgaming adapter
.venv/bin/python -m gamexs_scraper.export_csv <seller> -o output/<seller>.csv --cache output/<seller>_offers.jsonl
.venv/bin/python -m gamexs_scraper.download_images <seller> --cache output/<seller>_offers.jsonl
.venv/bin/python -m gamexs_scraper.load_to_postgres <seller> --cache output/<seller>_offers.jsonl
.venv/bin/python -m gamexs_scraper.compare output/pspro.csv some_reference.csv
```

- **Adapter pattern**: one `SellerAdapter` subclass per seller (21 registered)
  in `gamexs_scraper/adapters/`, all in `adapters/__init__.py`'s `ADAPTERS`
  dict. `iter_listings()` yields `RawOffer` records (`models.py`). **When
  adding a new seller you must register the import AND the `ADAPTERS` entry,
  seed the seller row in `db/init/02_seed.sql`, AND add a numbered migration
  (see `db/migrations/016_add_gpgaming_seller.sql`)** — the loader fails with
  "unknown seller ... seed it in db/init/02_seed.sql first", and an existing
  DB only picks up the new seller via a migration.
- Adapters use `PoliteFetcher` (`http.py`) — a `requests.Session` with retry +
  a minimum delay between requests. Plain HTTP GET has sufficed so far
  (server-rendered HTML, no headless browser). The daily `scrape_all.sh` runs
  through the proxy in `xray-proxy/`. Verify the proxy/no-proxy assumption
  before assuming it holds for a new seller.
- **`--cache <file>.jsonl`** on `export_csv`/`download_images`: if the file
  already exists, rebuilds from it with zero network calls (essential after
  tweaking classification logic — don't re-scrape to test a parsing fix). If it
  doesn't exist, the run scrapes live and writes the cache as it goes.
- Wrap any new adapter's per-product parsing in try/except around
  `requests.exceptions.RequestException` — a single connection reset must not
  kill a multi-hundred-product crawl (see `pspro.py` for the pattern).
- **Non-obvious pspro finding, worth knowing before "fixing" similar logic in a
  new adapter**: a product page with no capacity-tier `<select>` is treated
  unconditionally as `DISC`, never `OWN_ACCOUNT_GAME` — verified against an
  independent 500-game reference dataset. Iran has no official PSN store/payment
  method, so "digital code on your own account" isn't a real purchase path for
  most buyers; don't reintroduce a warehouse/stock field as a disc-vs-digital
  signal, it was tried and proven unreliable.
- `normalize.py`'s `normalize_game_name()` strips Persian/English scraper
  boilerplate and lowercases — a **same-seller-only** heuristic for merging
  regional listings (R1/R2/R3) of one title, not cross-seller matching.
  Cross-seller canonical matching is unbuilt (planned: merge on IGDB `igdb_id`).
- `scraper/output/` (CSVs, JSONL caches, downloaded images) is gitignored —
  regenerable from a live or cached scrape, never commit it as source of truth.

### Docker build & deploy (scraper workflows image)

```bash
docker buildx build \
  --builder desktop-linux \
  --platform linux/amd64 \
  --pull \
  --no-cache \
  --provenance=false \
  --progress=plain \
  -t registry.hamdocker.ir/mahdixak/gamexs-scraper-workflows:0.5.2 \
  --push \
  .
```

### Temporal workflows

**`scraper/TEMPORAL.md` is the authoritative reference** (namespaces, worker
deploy, schedules). Summarized: the scraper image runs as a long-lived
Temporal worker across two namespaces — `sellers-prices` (default) with
`SellerScrapeWorkflow`/`SellerPriceLogWorkflow`, and `gamexs-metadata` with
`MetadataRefreshWorkflow` (IGDB enrichment, PS Store prices, S3 image uploads,
stale-listing cleanup). The k8s CronJobs in `k8s/` are legacy and disabled in
favor of Temporal schedules.

- Smoke-run a workflow from CLI (worker must be running):
  `TEMPORAL_ADDRESS=<host>:7233 .venv/bin/python -m gamexs_scraper.temporal.run_workflow sellers --limit-products 1`
  (`metadata --igdb-limit 1 --psstore-limit 1`, or `log-prices --seller gpgaming`)
- Start a `SellerPriceLogWorkflow` by hand: namespace `sellers-prices`,
  task-queue `sellers-prices`, input `{"seller": "gpgaming"}` — prices appear
  in the workflow's **Log** tab / **Input/Results** panel.
- Test an activity without Temporal, e.g.:
  `.venv/bin/python -c "from gamexs_scraper.temporal.activities import log_seller_prices; print(log_seller_prices({'seller':'gpgaming'}))"`

## `db/` (Postgres 16)

```bash
cp .env.example .env         # first time; docker compose reads .env automatically
docker compose up -d         # starts postgres:16, auto-runs db/init/*.sql on first boot (empty volume)
docker exec -it gamexs-postgres psql -U gamexs -d gamexs
```

- Port 5432 may already be taken by an unrelated local Postgres — check
  `docker ps` / `lsof -iTCP:5432`; the repo's dev `.env` overrides
  `POSTGRES_PORT=5434`.
- **Two-layer schema change flow — keep both in sync**:
  - `db/init/01_schema.sql` applies only on first container init with an empty
    data volume. To pick up a change against an existing local volume:
    `docker compose down -v && docker compose up -d` (data loss is fine pre-launch).
  - **`db/migrations/`** (`001_...sql`, `.py`) holds *one-off* scripts run
    manually against an already-initialized DB (e.g. `docker exec -i gamexs-postgres
    psql -U gamexs -d gamexs < db/migrations/00X_....sql`). Many alter
    `ps5_games` and some add sellers. A schema change therefore goes into BOTH
    the init schema (fresh DBs) and a numbered migration (existing DBs/prod).
- Design: `listings` holds the *stable identity* of a trackable offer
  (game + seller + product_type + tier + source_url) and is upserted;
  `price_history` is **append-only**, one row per scrape per listing, queried by
  range scan on `scraped_at` for price-over-time charts — never update a price in place.
- The main catalog table is **`ps5_games`** (older docs/references may say `games`).
  All SQL in scraper, frontend (`games-repo.ts`), and backend `catalog` models use `ps5_games`.
- Core tables: `platforms`, `sellers`, `ps5_games`, `listings`, `price_history`.
  `ps_plus` + `ps_plus_price_history` (migration 002) and `ps5_store_info`
  (migration 014, PS Store prices, one row per concept_id) are added via migrations.
- `sellers`/`platforms` seeded in `db/init/02_seed.sql`. The frontend no longer
  uses a hardcoded `sellers.ts` map — it joins from the DB.

## `frontend/` (Next.js 16, App Router, Turbopack)

```bash
cd frontend
npm run dev     # start dev server
npm run build   # production build (also type-checks)
npm run lint    # eslint
npm run test:e2e   # Playwright; runs against a production build (build first)
```

**Read `frontend/AGENTS.md` and `frontend/CLAUDE.md` before writing any Next.js
code here.** Next.js 16 is new enough that training data is likely stale on
APIs/conventions (e.g. dynamic route `params` is a `Promise` that must be
`await`ed, both in Server *and* Client Components via `use()`) — check
`frontend/node_modules/next/dist/docs/` when unsure rather than assuming.

- RTL Persian is the primary (only) locale — `<html dir="rtl" lang="fa">` in
  `app/layout.tsx`, Vazirmatn font. Toman amounts go through `lib/format.ts`
  (`formatToman`/`toPersianDigits`), which produce real Persian digits and the
  Arabic thousands separator (U+066C) — use it rather than
  `toLocaleString`/raw numbers anywhere a price or count is displayed.
- Design tokens (dark theme, accent blue, success green, CTA amber) are CSS
  variables in `app/globals.css`, mapped into Tailwind v4 via `@theme inline`
  — extend colors there, not in a `tailwind.config`.
- Highlighted game pages (`app/games/[slug]/page.tsx` and the listing/detail
  pages) are `export const dynamic = "force-dynamic"` — never statically cached.
- **Server-only module rule**: `lib/db.ts` opens a real TCP pool via `pg`
  (read from `DATABASE_URL`; cached on `globalThis` for Turbopack dev reloads)
  and `lib/game-details.ts` likewise. These rely on server-only APIs — import
  them only from Server Components / Route Handlers, never from a `"use client"`
  file or anything in its import graph, or the client bundle breaks.
- **Covers**: `lib/covers.ts` (`s3CoverUrl`/`s3ScreenshotUrl`) builds canonical
  S3 URLs (`gs3.gamexs.ir`) and uses **no** `node:fs`, so it's safe from any
  component boundary. `lib/games-repo.ts` resolves `coverUrl` via this (DB may
  store an S3 URL directly, else it's derived from the slug). Render with
  `components/CoverArt.tsx`. For **local dev only**, the route handler
  `app/api/covers/[filename]/route.ts` streams files out of
  `scraper/output/images/{covers,pspro}/` (path-traversal-safe via
  `path.basename`) as a stand-in for S3 — don't rely on it as the primary path.
- `lib/purchase-options.ts` holds the fixed Persian display copy for each
  (product_type, tier) combination — the single place that defines the
  capacity-1/2/3 and disc/own-account UI labels.
- `npm run test:e2e` (Playwright, `tests/e2e/`) runs against a **production
  build** via `next start` on port 3010 — build first and point it at a real DB:
  `DATABASE_URL=postgresql://gamexs:gamexs@localhost:5434/gamexs npm run test:e2e`.
  `npm run test:headers` checks the security/cache headers from `next.config.ts`.

## `backend/` (Django 5.1, Django REST Framework)

```bash
cd backend
cp .env.example .env            # first time — set POSTGRES_* to match the repo .env
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first-time setup
DJANGO_SETTINGS_MODULE=gamexs.settings.local .venv/bin/python manage.py migrate
DJANGO_SETTINGS_MODULE=gamexs.settings.local .venv/bin/python manage.py runserver
DJANGO_SETTINGS_MODULE=gamexs.settings.local .venv/bin/python manage.py test apps.accounts
```

The backend runs on `http://localhost:8000` by default and shares the same
Postgres DB as the scraper and frontend (`POSTGRES_*` env vars in `backend/.env`).

**Settings split**: `gamexs/settings/base.py` (shared) + `local.py` (dev) + `production.py`.
The default in `manage.py` is `local`, but set `DJANGO_SETTINGS_MODULE` explicitly anyway.

**App layout** (`backend/apps/`):

| App | Tables managed | Purpose |
|---|---|---|
| `accounts` | `accounts_user`, `accounts_otpcode`, `accounts_emailverificationtoken` | Custom User model, OTP signup, email verification, password flows |
| `catalog` | none (`managed=False`) | Read-only Django models wrapping `ps5_games`, `sellers`, `listings` |
| `orders` | `orders_cartitem`, `orders_order` | Shopping cart + order history |
| `wishlist` | `wishlist_wishlistitem` | Per-user wishlist with optional price-drop threshold |
| `game_accounts` | `game_accounts_psnaccount` | PSN account storage per user |
| `tickets` | `tickets_ticket`, `tickets_ticketmessage` | Support ticket system |
| `reviews` | `reviews_gamereview` | User game reviews with moderation workflow (pending/approved/rejected) |

**`catalog` is `managed=False`** — Django will never create/drop `ps5_games`,
`sellers`, or `listings`; those belong to the scraper schema. Do not add
migrations for `catalog` models.

**Auth — JWT via httpOnly cookies, with Bearer fallback** (recently migrated;
older notes describing header-only auth are stale):

- `CookieJWTAuthentication` (`apps/accounts/authentication.py`) reads the
  `Authorization: Bearer` header first, falling back to the `gx_access`
  cookie. Tokens are ALSO set as httpOnly cookies (`JWT_ACCESS_COOKIE_NAME` /
  `JWT_REFRESH_COOKIE_NAME`, default `gx_access`/`gx_refresh`) by
  `_set_auth_cookies` in `views.py`.
- Flow: `POST /api/auth/signup/` (phone+password → pending user + OTP SMS, returns
  signed `otp_token`) → `POST /api/auth/verify-otp/` (`otp_token`+`code` →
  activates, sets auth cookies) → `POST /api/auth/complete-profile/`
  (name+email → verification email) → `GET /api/auth/verify-email/?token=<uuid>`.
- `POST /api/auth/login/` uses phone+password only (no OTP). Logs in even if
  email isn't verified, returning `{"email_verified": false}` for the UI to
  prompt verification.
- Refresh: `POST /api/auth/token/refresh/` reads the `gx_refresh` cookie or a
  body `refresh`. Logout blacklists + clears cookies.
- **JWT**: access 1 h, refresh 30 d, rotate + blacklist on logout.
- **OTP**: 6 digits, 2-min expiry (`OTP_EXPIRY_SECONDS`, 120), 5-attempt
  lockout (`OTP_MAX_ATTEMPTS`). Codes print to console in dev
  (`SMS_BACKEND=console`); a real provider is `SMS_BACKEND=smsir` (not kavenegar)
  with `SMS_API_KEY` / `SMS_TEMPLATE_ID` in `.env`.

**API base paths** (accounts endpoints live in `apps/accounts/urls.py`):
```
/api/auth/          signup, verify-otp, complete-profile, verify-email,
                    resend-verification, login, token/refresh, logout,
                    change-password, forgot-password, forgot-password/verify
/api/profile/       GET / PATCH own profile
/api/wishlist/      GET, POST, DELETE {id}
/api/game-accounts/ psn/, psn/{id}/
/api/cart/          GET, POST items/, DELETE items/{id}/, DELETE clear/
/api/orders/        GET, POST, GET {id}/
/api/tickets/       GET, POST, GET {id}/, POST {id}/messages/
/api/reviews/       games/{game_id}/ — list + create
```
