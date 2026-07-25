# GameXS — Backlog

## Platform

- ✅ Database schema (Postgres 16, via `docker compose up -d`): `games`,
  `sellers`, `platforms`, `listings`, `price_history`. See `db/init/`.
- ✅ Loader: `python -m gamexs_scraper.load_to_postgres <seller> --cache
  <path>.jsonl` upserts games/listings + appends price_history (idempotent).
  All 13 sellers loaded.
- ✅ Cover art: scraped `image_url` stored in `games.cover_url`. Trusted
  sellers (digikala, pspro, technolife, nakhlmarket) always overwrite; others
  only fill in when NULL. ~96% of games have covers.
- ✅ Frontend reads from Postgres: `games-repo.ts` queries all tables.
  Both listing and detail pages are `force-dynamic` (never statically cached).
- ✅ Seller info (name, domain) comes from DB JOIN in `getGameBySlug` —
  no more hardcoded `sellers.ts` map on the detail page.
- ✅ Game grid: search, sort (newest, price asc/desc, popular=most sellers),
  pagination (20/page), Persian digit formatting.
- ✅ Daily scrape: `scraper/scrape_all.sh` runs 13 sellers in parallel pairs
  (2 at a time), enriches with IGDB, then cleans stale listings. Deployed as
  a k8s CronJob (`k8s/scraper-cronjob.yaml`) at 1am Tehran (21:30 UTC).
- **Not started**: price-history chart UI on the game detail page (data is in
  `price_history`, just no chart component yet).

## IGDB enrichment

- ✅ `enrich_metadata.py` — searches IGDB for each game (by cleaned English
  title), scores on name similarity + PS5 platform + main category, writes
  `igdb_id`, `genre_label`, `publisher`, `release_year`, `cover_url` to DB.
  Threshold: 0.65. Rate: 0.28s delay (≤ 3.5 req/s, within free tier).
- ✅ IGDB cover URL overwrites seller cover (canonical quality). If no IGDB
  cover, seller image is kept as fallback.
- ✅ `scrape_all.sh` calls `enrich_metadata.py` after each daily scrape run
  so new games get enriched automatically.
- ✅ Local DB enrichment: ~169/2570 matched in partial run. Full re-run in
  progress (2379 remaining).
- **Pending**: verify match rate and quality after current run; tune
  `_MIN_SCORE` or `_EDITION_RE` if needed.
- **Pending**: run enrichment against production DB (port-forward to 5435).

## Active: Seller scraper coverage

All 13 target sellers have working adapters:
pspro, gamario, gameonestore, gamecenter, gameplayshop, xgamesstore,
nakhlmarket, persianconsole, yungcenter, technolife, parsconsole,
cdkeyshare, digikala.

Current DB: ~2,570 games, ~5,800 listings across all 13 sellers.

Known data quality issues:
- No canonical cross-seller game catalog — same game from different sellers
  often has slightly different titles and appears as separate rows. IGDB
  `igdb_id` will eventually be used to merge these; deduplication query not
  yet written.
- `normalize.py` doesn't canonicalize Roman numeral vs. digit naming
  ("Armored Core 6" vs. "Armored Core VI" = separate rows) — minor, low priority.

## Production deployment

- ✅ Production DB: `gamexs-db.mahdixak-gamexs.svc:5432`, superuser `postgres`.
  `igdb_id` column added. All 13 sellers loaded (2570 games, ~5800 listings).
- ✅ k8s CronJob manifest: `k8s/scraper-cronjob.yaml` — schedule 21:30 UTC,
  `concurrencyPolicy: Forbid`, 5h deadline, no auto-retry.
- ✅ k8s Secret template: `k8s/scraper-secret.yaml.example`.
- **Pending**: build scraper Docker image, push to registry, apply Secret +
  CronJob to production cluster.
  ```bash
  docker build -t <registry>/gamexs-scraper:latest scraper/
  docker push <registry>/gamexs-scraper:latest
  # edit k8s/scraper-cronjob.yaml: replace REGISTRY with actual registry
  kubectl apply -f k8s/scraper-cronjob.yaml
  # copy scraper-secret.yaml.example → scraper-secret.yaml, fill HTTPS_PROXY + IGDB_CLIENT_SECRET
  kubectl apply -f k8s/scraper-secret.yaml
  ```

## Cover image delivery

- ✅ **Server-side proxy** (`/api/cover-proxy`): `images.igdb.com` is blocked in Iran.
  `games-repo.ts::toCoverUrl()` rewrites all IGDB URLs to `/api/cover-proxy?url=…`
  so the Next.js server fetches them server-side (k8s has internet access). Proxy uses:
  - Semaphore (`MAX_CONCURRENT=3`) — stays well under IGDB CDN's connection limit
  - Request coalescing (`inflight` Map) — concurrent requests for the same image share one outbound fetch
  - `next: { revalidate: 604800 }` — Next.js data cache stores each image for 7 days
  - `Cache-Control: public, max-age=604800, immutable` — browser caches indefinitely

**TODO — object storage migration**: Move covers + screenshots off IGDB CDN into
self-hosted object storage so images are served from our own infrastructure with no
external dependency or redirect overhead. Steps:
1. Provision an S3-compatible bucket (Hamravesh object storage or ArvanCloud).
2. Upload `scraper/output/images/covers/` and `/screenshots/` (~1.2 GB) to the bucket.
3. Update `download_igdb_images.py` to push new images to the bucket on each scrape run.
4. Run a one-off migration script to set `games.cover_url` and `games.screenshot_ids`
   to object-storage URLs for all existing rows.
5. Remove the `/api/cover-proxy` redirect route — it becomes a dead code path.
6. Update `toCoverUrl()` in `games-repo.ts` to pass object-storage URLs straight through.

## Explicitly deferred by product decision (not urgent)

- User accounts, favorites, price-drop alerts.
- Subscriptions (PS Plus, EA Play) and gift cards: taxonomy designed for them,
  no seller scraped for these categories yet.
- Price-history chart UI on game detail page.
- Cross-seller deduplication using `igdb_id` as canonical key.
- **GTA games**: investigate and fix the data/display problem with GTA titles
  (likely cross-seller deduplication, regional naming variants, or scraper
  mis-classification — needs diagnosis).
- **Pre-order & unreleased games**: include games that are not yet launched
  (available for pre-order). Sellers already list pre-order prices; the scraper
  and DB schema support them, but the frontend currently shows no indicator.
  Needs: pre-order badge on GameCard, release date prominence on detail page,
  and filtering/sorting that accounts for unreleased titles.

## Active: Game editions cleanup

- **In progress**: identifying and merging duplicate game rows that represent the
  same edition (e.g. "Collector 007 First Light" and "007 First Light Collector Edition"
  should be one row). Migration 006 handles IGDB-matched duplicates automatically;
  unmatched rows require manual review and SQL merges.
- **Pending**: audit remaining special edition rows that have no `igdb_id` and
  verify their edition labels are correct (Legacy Edition, Collector Edition, etc.).

## Pending: Legal and trust

- **Enamad sign**: apply for and integrate the Enamad (اینماد) e-trust certificate
  into the website. Required for credibility with Iranian users and sellers.

## Pending: Branding

- **Logo in application**: integrate the GameXS logo into the application UI
  (header, favicon, OG image, loading screen). Logo assets need to be finalised
  and placed in `frontend/public/`.

## Active: Django REST backend

The backend scaffold is complete and running (`backend/`). Remaining tasks:

### Missing endpoints

- **Forgot password flow**: `OTPCode.PURPOSE_PASSWORD_RESET` is modeled but has
  no views. Needs:
  - `POST /api/auth/forgot-password/` — accepts phone number, sends OTP, returns `otp_token`
  - `POST /api/auth/reset-password/` — accepts `otp_token` + code + new password

- **Resend OTP**: if the 2-minute OTP expires during signup there is no resend path.
  Needs `POST /api/auth/resend-otp/` that accepts an `otp_token` and fires a new code.

- **Email re-verification on email change**: `PATCH /api/profile/` allows changing
  `email` without resetting `is_email_verified`. When email changes, set
  `is_email_verified=False` and send a new verification email.

### Admin panel

- **Register all models in admin.py** — all six `admin.py` files are empty.
  The support team needs Django admin to manage tickets, view orders, and
  manage users. Register: `User`, `OTPCode`, `Order`, `Ticket`, `TicketMessage`,
  `WishlistItem`, `PSNAccount`.

### Infrastructure

- **`.gitignore` for `backend/`** — `.venv/`, `__pycache__/`, `.env`, `*.pyc`,
  `staticfiles/` are not gitignored and will be committed accidentally.

- **OTP console output buffering** — when `SMS_BACKEND=console`, the OTP `print()`
  in `apps/accounts/services/sms.py` is buffered and may not appear in server logs.
  Add `PYTHONUNBUFFERED=1` to `backend/.env` or replace `print()` with `logging`.

- **`wsgi.py` settings path** — `gamexs/wsgi.py` still defaults to `gamexs.settings`
  (Django scaffold). Change to `gamexs.settings.production` before deploying.

### SMS provider

- **Wire SMS.ir** as the production SMS backend. Provider: `https://api.sms.ir`
  Auth: `x-api-key` header. OTP send endpoint: `POST /v1/send/verify`.
  Update `apps/accounts/services/sms.py` with an `smsir` backend branch.
  Required env vars: `SMS_BACKEND=smsir`, `SMS_API_KEY=<key>`, `SMS_TEMPLATE_ID=<id>`.

## Pending: Authentication

- **SMS.ir integration**: SMS provider chosen is SMS.ir (https://app.sms.ir).
  Sandbox docs: https://app.sms.ir/developer/help/sandbox.
  OTP template must be created in the SMS.ir panel before going live.
  See `backend/apps/accounts/services/sms.py` for the integration point.

## Pending: Game detail page

- **Complete game header**: finish the hero section on each game detail page
  (cover art, title, release date, genre, developer, IGDB rating, platform badges).
- **Similar games section**: on each game detail page show a list of related
  games (same genre, franchise, or developer) pulled from the DB using IGDB
  metadata already stored in `games.genres`, `games.franchises`, `games.developers`.

## Pending: User features

- **Bucket list / wishlist**: implemented in backend (`/api/wishlist/`). Frontend
  integration pending — needs a wishlist UI page and a heart/save button on GameCard.

## Pending: Database finalisation

- **Lock the database schema**: once the data model is stable, freeze the schema,
  write a final migration that documents the locked state, and restrict write access
  so that only the IGDB enrichment pipeline (`enrich_metadata.py`) and the daily
  scraper can write into the database. All other writes should go through the
  application layer with strict validation.

## Future features

- **Mail server + پشتیبانی section**: set up a mail server (e.g. Postfix/SES/Resend)
  and wire it into the site's پشتیبانی (support) section so users can submit
  support requests or contact the team via email.
- **PS Plus & subscriptions section**: dedicated section for PS Plus tiers (Essential,
  Extra, Premium) and other subscriptions (EA Play, etc.). Requires scraper adapters
  for subscription sellers, new product-type handling in the DB/frontend, and a
  separate UI section distinct from the game catalog.
- **Customer login & sign-up**: user authentication for site visitors — account
  creation, login, session management. Foundation for favorites, price-drop alerts,
  and personalized features.
- **Seller admin panel**: a web panel for sellers to submit and manage their own
  prices directly into GameXS, as an alternative to scraping. Requires seller
  authentication, a price-submission UI, and an approval/moderation workflow.
