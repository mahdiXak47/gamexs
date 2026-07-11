# GameXS — Backlog

## Blocked / deferred

- **IGDB integration** (canonical game catalog, cross-seller fuzzy matching,
  cover art/screenshots/trailers). Deferred: `igdb.com`, `api.igdb.com`,
  `id.twitch.tv` (needed for the OAuth token IGDB requires), and `rawg.io`
  all get reset at the TLS ClientHello stage from the current dev network —
  confirmed to be SNI-based filtering, not a DNS issue. Needs a full-tunnel
  VPN for local dev; should work fine once deployed on ordinary cloud infra
  abroad.

## Active: Seller scraper coverage

All 13 target sellers have working adapters:
pspro, gamario, gameonestore, gamecenter, gameplayshop, xgamesstore,
nakhlmarket, persianconsole, yungcenter, technolife, parsconsole,
cdkeyshare, digikala.

Current DB: ~2,566 games, ~5,800 listings across all 13 sellers.
All loaded via `load_to_postgres`; scrape data in `scraper/output/`.

Known data quality issues:
- No canonical cross-seller game catalog — `normalize.py`'s boilerplate-
  stripping reliably groups one seller's own listings; different sellers
  often title the same game differently. This needs IGDB + fuzzy matching
  (see "Blocked"). In the meantime, games appear as duplicates across sellers
  under slightly different slugs.
- `normalize.py` doesn't canonicalize Roman numeral vs. digit naming
  ("Armored Core 6" vs. "Armored Core VI" = separate rows) — minor, low priority.

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
- **Not started**: scheduling/cron for daily re-scrape + ingest.
- **Not started**: price-history chart UI on the game detail page (data is in
  `price_history`, just no chart component yet).

## Cover art / media

- ✅ Seller product images used as cover art — zero new integration needed.
- **Not started**: Wikidata/Wikipedia as a free supplementary source for
  canonical cover art (likely unblocked from current network, worth a spike).
- Once IGDB is unblocked: backfill with cleaner canonical art + screenshots.

## Explicitly deferred by product decision (not urgent)

- User accounts, favorites, price-drop alerts.
- Subscriptions (PS Plus, EA Play) and gift cards: taxonomy designed for them,
  no seller scraped for these categories yet.
- `games.genre_label`/`publisher`/`release_year`: always NULL — needs IGDB
  backfill or manual scraping of per-game metadata.
