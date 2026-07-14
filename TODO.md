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

**Long-term (optional)**: Download covers at scrape time → push to object storage
(e.g. S3-compatible on Hamravesh) → store object-storage URL in `games.cover_url`.
Eliminates the proxy entirely and serves images from a CDN. Aligns with the CLAUDE.md
note about production object-storage URLs.

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
