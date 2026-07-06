# GameXS — Backlog

## Blocked / deferred

- **IGDB integration** (canonical game catalog, cross-seller fuzzy matching,
  cover art/screenshots/trailers). Deferred: `igdb.com`, `api.igdb.com`,
  `id.twitch.tv` (needed for the OAuth token IGDB requires), and `rawg.io`
  all get reset at the TLS ClientHello stage from the current dev network —
  confirmed to be SNI-based filtering, not a DNS issue (bypassing DNS via
  `/etc/hosts` didn't help). Needs a full-tunnel VPN for local dev; should
  work fine once deployed on ordinary cloud infra abroad. Revisit once
  either (a) a working VPN is available for local dev, or (b) this is
  actually deployed somewhere outside the current network.

## Seller scraper coverage (10 of 11 not started)

Only pspro.ir has a working adapter. Still to reverse-engineer and build:
youngcenter, nakhlmarket, persianconsole, gameplayshop, digikala,
parsconsole, gameonestore, xgamesstore, game-center, gamario, cdkeyshare.
Digikala in particular may need a different approach (internal JSON API
instead of HTML scraping — worth a quick spike before assuming it needs a
headless browser).

## pspro follow-ups

- Open decision: targeted re-fetch of the ~45 games missing capacity-tier
  data in the 500-game sample comparison (their account-tier page fell
  outside our 500-product crawl window), vs. accepting current coverage.
- Spot-check the one real price discrepancy found: Microsoft Flight
  Simulator 2024 disc price (ours 14,650,000 vs. reference 16,950,000
  Toman) — could be a genuine price change or a different edition SKU.
- Apply the same per-product try/except resilience fix (added after a
  connection-reset crashed a full run) to every future adapter, not just
  pspro's.
- `normalize.py` doesn't canonicalize Roman numeral vs. digit naming
  (saw "Armored Core 6" vs. "Armored Core VI" as separate rows on pspro's
  own listings) — minor, low priority.

## Data model gaps

- CSV output doesn't distinguish "not offered" from "offered but currently
  out of stock" — both show as `0`. `in_stock` is already tracked per-offer
  internally, just not surfaced yet.
- No canonical cross-seller game catalog yet — `normalize.py`'s
  boilerplate-stripping only reliably groups one seller's own listings, not
  the same game across different sellers who'll title it differently. This
  is what IGDB + fuzzy matching + an admin review queue was meant to solve
  (see "Blocked" above).
- Subscriptions (PS Plus, EA Play) and gift cards: taxonomy is designed for
  them, but no seller has been scraped for these categories yet.

## Game cover art / media (near-term, unblocked path)

- **Immediate option**: use the product images we're already scraping from
  each seller (`RawOffer.image_url`) as cover art. Zero new integration
  work — it's already being collected. Tradeoff: inconsistent
  quality/cropping across sellers, occasional watermarks/badges baked into
  the image.
- Worth checking reachability of Wikipedia/Wikidata as a free, likely
  unblocked supplementary source for canonical (if lower-res) cover art.
- Once IGDB is unblocked, backfill/replace with its cleaner, canonical
  artwork + add screenshots/trailers, which seller images don't provide.

## Platform

- ✅ Database schema (Postgres 16, via `docker compose up -d`): `games`,
  `sellers`, `platforms`, `listings` (one row per game+seller+product-type+
  tier ever seen), `price_history` (append-only, one row per scrape — this
  is what price charts will query). See `db/init/`.
- Not started: a script that reads the scraper's JSONL/CSV output and
  upserts into `listings` + inserts into `price_history` — this is what
  turns a scrape run into DB rows. Needed before the 24h cron job means
  anything.
- Not started: scheduling/cron for the daily re-scrape + ingest.
- Not started: frontend reading from Postgres instead of its mock data in
  `frontend/src/lib/games.ts` — once that happens, `frontend/src/lib/
  sellers.ts` becomes redundant (superseded by the `sellers` table).
- Not started: price-history chart UI on the game detail page.

## Explicitly deferred by product decision (not urgent)

- User accounts, favorites, price-drop alerts.
