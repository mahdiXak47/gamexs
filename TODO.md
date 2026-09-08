# GameXS — Backlog (remaining)

> Completed items were removed. Tracked here is what's still outstanding.

## IGDB enrichment

- Verify enrichment match rate/quality in production; tune `_MIN_SCORE` or
  `_EDITION_RE` if needed.

## Seller / data-quality issues

- Cross-seller catalog integrity still needs production verification. The
  repository now has IGDB-based merge/repair tooling and the local catalog has
  no duplicate IGDB groups; run the audit against the production database and
  review any edition-level collisions before applying merges.

## Deferred by product decision (not urgent)

- User-account extras: favorites, price-drop alerts.
- Gift cards and EA Play/other subscriptions (taxonomy exists; nothing scraped
  yet. PS Plus is live).
- **GTA games**: investigate the data/display problem (likely cross-seller
  dedup, regional naming variants, or scraper mis-classification).

## Active: Game editions cleanup

- Audit remaining special-edition rows that have no `igdb_id` and verify their
  edition labels are correct (Legacy Edition, Collector Edition, etc.).

## Legal and trust

- Confirm the Enamad (اینماد) certificate is active in production and that the
  footer badge points to the current certificate.

## Branding

- Decide on and replace the current logo asset if the final non-text-only mark
  is different; the current logo is already used in the header, social/search
  surfaces, favicon metadata, and site-wide OG metadata.
- Confirm the published Telegram and Instagram URLs in the social section.

## Database finalisation

- Lock the database schema once the data model is stable: write a final
  migration and restrict writes to the enrichment pipeline
  (`enrich_metadata.py`) and the daily scraper; other writes go through the
  application layer with validation.

## Future features

- Configure and verify the production SMTP mail server and complete staff-side
  support replies; ticket creation and the user-facing support section already
  exist.
- Seller admin panel for submitting and managing prices directly (alternative
  to scraping), with auth + approval/moderation workflow.

## feedbacks

- The AI recommendation UI and unused streaming endpoint were removed; the
  normal catalog search is the primary discovery flow.
- The wishlist mutation rate limit is implemented at 30 requests per minute
  per authenticated user.

- Sellers typically send data as ~150 games × 5 pricing types.



- Cover gift-card prices and update them once gift cards have an approved
  product type and storage/display model.
