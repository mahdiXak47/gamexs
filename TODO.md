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

- User-account extras: favorites are implemented (with account listing and
  catalog validation); price-drop alerts still require a notification-channel
  and trigger-policy decision.
- Gift cards and EA Play/other subscriptions (taxonomy exists; nothing scraped
  yet. PS Plus is live).

## Active: Game editions cleanup

- The local read-only audit on 2026-09-08 found zero special-edition rows
  without an `igdb_id`; repeat the audit against production and review any
  remaining edition labels (Legacy Edition, Collector Edition, etc.).

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

## Production operations

- Set `SMS_BACKEND=smsir` + `SMS_API_KEY` on `gamexs-backend`: it defaults to
  `console`, so signup OTPs are only logged and nobody can register.
- Merge catalog row `hades-2` (IGDB 134619, an unrelated 2001 PC game) into
  `hades-ii` (IGDB 228525); the 10 seller listings sit on the wrong row.
- Off-disk DB dumps: the S3 bucket is public at bucket level (the endpoint
  ignores bucket policies and per-object ACLs), so dumps need a separate private
  bucket before a `pg_dump` pipeline step can be added.
- Create a Telegram bot and configure `TELEGRAM_BOT_TOKEN` plus
  `TELEGRAM_CHAT_ID` in the production secret to activate scraper failure
  alerts. No error tracking (e.g. Sentry) yet.
- technolife has no PS5 game in stock, so its zero-game scrape fails the health
  check every cycle (expected while the shop has no stock).

## Future features

- Configure and verify the production SMTP mail server. The user-facing support
  flow now covers ticket creation, ticket detail, and user replies; Django admin
  enforces staff-originated replies and ticket status transitions. Production
  credentials and an end-to-end delivery/support test remain.
- Seller admin panel for submitting and managing prices directly (alternative
  to scraping), with auth + approval/moderation workflow.
