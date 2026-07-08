# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

GameXS is a price-comparison service for Iranian PS5 game/account/subscription
retailers. It's pure comparison, not a marketplace — every price row links out
to the seller's own site; there is no checkout on this side. Full domain
model, seller list, and UI requirements: **`docs/PROJECT_CONTEXT.md`** (written
to be handed to a separate design conversation — read it before making
product-shape decisions). Current build status and known gaps: **`TODO.md`**.

Monorepo with three independent pieces that are **not yet wired together**:

- `scraper/` — Python, scrapes seller sites, writes CSV/JSONL to `scraper/output/` (gitignored, regenerable).
- `db/` — Postgres 16 schema, currently empty (no ingestion script loads scraper output into it yet).
- `frontend/` — Next.js UI, currently reads **hardcoded mock data** from `frontend/src/lib/games.ts`, not the scraper or the database.

Connecting these (scraper → Postgres → frontend) is the main outstanding work; see `TODO.md`.

## The product taxonomy (needed to understand any of the three pieces)

A single game can be sold multiple ways simultaneously, each a different price:

- **Account capacity 1** — full account handover, buyer must play offline only.
- **Account capacity 2** — shared account, online *and* offline.
- **Account capacity 3** — shared account, online only (cheapest, most restrictive).
- **Own-account purchase** — digital code activated on the customer's own PSN account (see pspro note below — in practice almost never actually offered).
- **Physical disc** — no tier concept.
- *(Modeled in the scraper's Python enum but not yet scraped anywhere or represented in the DB/frontend: subscriptions sold via the same 3 tiers, and gift cards.)*

This taxonomy is duplicated across three places with **different casing
conventions** — a real gotcha for anyone writing the scraper→DB ingestion path:

| Layer | Type | Tier | Values |
|---|---|---|---|
| `scraper/gamexs_scraper/models.py` | `ProductType` / `AccessTier` (Python `str` enums) | lowercase snake_case | `"account_game"`, `"capacity_1"` |
| `db/init/01_schema.sql` | `product_type` / `access_tier` (Postgres enums) | UPPER_SNAKE | `'ACCOUNT_GAME'`, `'CAPACITY_1'` |
| `frontend/src/lib/types.ts` | `ProductType` / `AccessTier` (TS union types) | UPPER_SNAKE | `"ACCOUNT_GAME"`, `"CAPACITY_1"` |

The DB additionally enforces via a `CHECK` constraint that `tier` is set if
and only if `product_type = 'ACCOUNT_GAME'`.

## `scraper/` (Python)

```bash
cd scraper
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # first-time setup
.venv/bin/python -m gamexs_scraper.cli pspro --limit 5               # print raw offers as JSON (no file output)
.venv/bin/python -m gamexs_scraper.export_csv pspro -o output/pspro.csv --cache output/pspro_offers.jsonl
.venv/bin/python -m gamexs_scraper.download_images pspro --cache output/pspro_offers.jsonl
.venv/bin/python -m gamexs_scraper.compare output/pspro.csv some_reference.csv
```

- **Adapter pattern**: one `SellerAdapter` subclass per seller in
  `gamexs_scraper/adapters/`, registered in `adapters/__init__.py`'s
  `ADAPTERS` dict. `iter_listings()` yields `RawOffer` records (see
  `models.py`). Only `pspro.py` exists — the other 11 sellers listed in
  `docs/PROJECT_CONTEXT.md` have no adapter yet.
- Adapters use `PoliteFetcher` (`http.py`) — a `requests.Session` with retry +
  a minimum delay between requests. Plain HTTP GET has been sufficient for
  every site inspected so far (server-rendered HTML, no headless browser
  needed) — verify this assumption before assuming it holds for a new seller.
- **`--cache <file>.jsonl`** on `export_csv`/`download_images`: if the file
  already exists, rebuild from it with zero network calls (essential after
  tweaking classification logic — don't re-scrape to test a parsing fix).
  If it doesn't exist, the run scrapes live and writes the cache as it goes.
- Wrap any new adapter's per-product parsing in try/except around
  `requests.exceptions.RequestException` — a single connection reset must not
  kill an in-progress multi-hundred-product crawl (see `pspro.py` for the pattern).
- **Non-obvious pspro finding, worth knowing before "fixing" similar logic in
  a new adapter**: a product page with no capacity-tier `<select>` is treated
  unconditionally as `DISC`, never `OWN_ACCOUNT_GAME` — verified against an
  independent 500-game reference dataset. Iran has no official PSN
  store/payment method, so "digital code on your own account" isn't a real
  purchase path for most Iranian buyers; don't reintroduce a warehouse/stock
  field as a disc-vs-digital signal, it was tried and proven unreliable.
- `normalize.py`'s `normalize_game_name()` strips Persian/English scraper
  boilerplate and lowercases — it's a **same-seller-only** heuristic for
  merging regional listings (R1/R2/R3) of one title, not cross-seller
  matching. Cross-seller canonical matching is unbuilt (planned: IGDB/RAWG +
  fuzzy matching, currently blocked — see `TODO.md`).
- `scraper/output/` (CSVs, JSONL caches, downloaded cover images) is
  gitignored — always regenerable from a live or cached scrape, never treat
  it as source of truth to commit.

## `db/` (Postgres 16)

```bash
cp .env.example .env         # first time; docker compose reads .env automatically
docker compose up -d         # starts postgres:16, auto-runs db/init/*.sql on first boot (empty volume)
docker exec -it gamexs-postgres psql -U gamexs -d gamexs
```

- Port 5432 may already be taken by an unrelated local Postgres — check
  `docker ps` / `lsof -iTCP:5432` before assuming it's free, and override
  `POSTGRES_PORT` in `.env` if not (this repo's own dev `.env` uses 5434).
- Schema is plain SQL in `db/init/`, applied automatically via Postgres'
  `docker-entrypoint-initdb.d` mechanism — **only runs on first container
  init with an empty data volume**. To pick up a schema change against an
  existing volume: `docker compose down -v && docker compose up -d` (data
  loss is fine pre-launch; there's no real data yet).
- Design: `listings` holds the *stable identity* of a trackable offer
  (game + seller + product_type + tier + source_url) and is upserted;
  `price_history` is **append-only**, one row per scrape per listing, and is
  what price-over-time charts will query via a range scan on `scraped_at` —
  never update a price in place.
- `sellers`/`platforms` seed data in `db/init/02_seed.sql` mirrors
  `frontend/src/lib/sellers.ts` — keep them in sync until the frontend reads
  from this DB instead of its mock data (at which point delete the frontend
  copy).

## `frontend/` (Next.js 16, App Router, Turbopack)

```bash
cd frontend
npm run dev     # start dev server
npm run build   # production build (also type-checks)
npm run lint    # eslint
```

**Read `frontend/AGENTS.md` before writing any Next.js code in this
directory.** Next.js 16 is new enough that training data is likely stale on
APIs/conventions (e.g. dynamic route `params` is a `Promise` that must be
`await`ed, both in Server *and* Client Components via `use()`) — check
`frontend/node_modules/next/dist/docs/` when unsure rather than assuming.

- RTL Persian is the primary (only) locale — `<html dir="rtl" lang="fa">` in
  `app/layout.tsx`, Vazirmatn font. Toman amounts are formatted through
  `lib/format.ts` (`formatToman`/`toPersianDigits`), which produces real
  Persian digits and the Arabic thousands separator (U+066C) — use it rather
  than `toLocaleString`/raw numbers anywhere a price or count is displayed.
- Design tokens (dark theme, accent blue, success green, CTA amber) live as
  CSS variables in `app/globals.css`, mapped into Tailwind v4 via `@theme
  inline` — extend colors there, not in a `tailwind.config`.
- **Server/Client component boundary gotcha**: `lib/covers.ts` uses
  `node:fs` and must only be imported from Server Components (the `page.tsx`
  files) — never from a `"use client"` file or anything in its import graph
  (`GameGrid.tsx`, `PurchaseTypeSelector.tsx`), or the client bundle breaks.
  The pattern is: resolve the cover URL server-side in the page, pass it down
  as a plain `string | null` prop, render via `components/CoverArt.tsx`.
- Cover images are **not** copied into `frontend/public/` — the route
  handler `app/api/covers/[filename]/route.ts` streams files straight out of
  `scraper/output/images/<seller>/` on request (path-traversal-safe via
  `path.basename`). This is explicitly the local-dev stand-in for what will
  be an object-storage URL in production — don't add a copy step.
- Mock data (`lib/games.ts`, `lib/sellers.ts`) is intentionally shaped to
  mirror the scraper's `ProductType`/`AccessTier` taxonomy and the DB's
  `sellers` table so swapping in real data later is a data-source change, not
  a UI rewrite — keep that shape if you extend it.
