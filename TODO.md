# GameXS — Backlog (remaining)

> Completed items were removed. Tracked here is what's still outstanding.

## Not started

- Price-history chart UI on the game detail page (data is in `price_history`,
  no chart component yet).

## IGDB enrichment

- Verify enrichment match rate/quality in production; tune `_MIN_SCORE` or
  `_EDITION_RE` if needed.

## Seller / data-quality issues

- No canonical cross-seller catalog — the same game from different sellers
  often appears as separate rows. Merge is planned on IGDB `igdb_id`;
  dedup query not yet written.
- `normalize.py` doesn't canonicalize Roman numeral vs. digit naming
  ("Armored Core 6" vs. "Armored Core VI").

## Admin panel (backend)

- Register all models in `admin.py` — the six `admin.py` files are empty.
  Register `User`, `OTPCode`, `Order`, `Ticket`, `TicketMessage`,
  `WishlistItem`, `PSNAccount`.

## Deferred by product decision (not urgent)

- User-account extras: favorites, price-drop alerts.
- Gift cards and EA Play/other subscriptions (taxonomy exists; nothing scraped
  yet. PS Plus is live).
- Cross-seller deduplication using `igdb_id` as canonical key.
- **GTA games**: investigate the data/display problem (likely cross-seller
  dedup, regional naming variants, or scraper mis-classification).

## Active: Game editions cleanup

- Audit remaining special-edition rows that have no `igdb_id` and verify their
  edition labels are correct (Legacy Edition, Collector Edition, etc.).

## SEO (pending)

- **Verification & measurement (no code):** verify `gamexs.ir` in Google Search
  Console and Bing Webmaster Tools; add analytics (GA4 or a privacy-friendly
  alternative) — there is currently no pageview tracking.
- **Content additions:** FAQ/taxonomy page (`/راهنما`) with `FAQPage` schema;
  `BreadcrumbList` JSON-LD on game/genre pages; `dateModified` in the `Product`
  JSON-LD sourced from `price_history.scraped_at`; dynamic OG images
  (`opengraph-image.tsx`) showing cover + lowest price.
- **Bigger bet:** Google Merchant Center product feed (needs its own scoping
  conversation before implementation).
- **Ongoing / no-code:** Persian community/directory presence; monthly
  `site:gamexs.ir` + a few "قیمت [بازی] برای PS5" LLM-citation checks.

## Legal and trust

- Apply for and integrate the Enamad (اینماد) e-trust certificate (badge code
  is already in the footer).

## Branding

- Integrate the GameXS logo into the UI (header, favicon, OG image, loading
  screen). Assets are in `frontend/public/logos/`.
- Wire up real social media URLs in `frontend/src/components/Footer.tsx`
  (`socialLinks` are all `#` placeholders until accounts exist).

## Database finalisation

- Lock the database schema once the data model is stable: write a final
  migration and restrict writes to the enrichment pipeline
  (`enrich_metadata.py`) and the daily scraper; other writes go through the
  application layer with validation.

## Future features

- Mail server + support/پشتیبانی section (users submit support requests).
- Seller admin panel for submitting and managing prices directly (alternative
  to scraping), with auth + approval/moderation workflow.

## feedbacks

- Replace the AI "find game" UI in search with something else.
- Change the main logo to one that isn't text-only.
- Add a rate limit for adding/removing to wishlist.
- Remove "مشاهده بازی‌های مطابق با سلیقه تو".

- Sellers typically send data as ~150 games × 5 pricing types.