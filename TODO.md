# GameXS — Backlog (remaining)

> Completed items were removed. Tracked here is what's still outstanding.

## IGDB enrichment

- Wrong IGDB matches found while writing descriptions (2026-10-24/25):
  `scraper/repair_catalog_matches.py` fixes hades-2, jumanji (merge) and
  resident-evil-2-remake, ben-10, lisa-definitive-edition,
  the-last-of-us-complete-collector (rematch); dry-run verified in production,
  apply with `python repair_catalog_matches.py --apply` in the scraper pod.
  Remaining: `call-of-duty-black-ops-ii` (shops list a PS4/PS5 version that
  does not exist — needs an owner decision). Digikala PS1–3/Switch/PC-DVD
  listings are now filtered by the adapter.

## Seller / data-quality issues

- Production catalog audit (2026-10-25): clean — 0 duplicate IGDB groups, 0
  special editions without an IGDB id; the only title collision (hades-2 /
  hades-ii) is in the repair script above.

## Deferred by product decision (not urgent)

- User-account extras: favorites are implemented (with account listing and
  catalog validation); price-drop alerts still require a notification-channel
  and trigger-policy decision.
- Gift cards and EA Play/other subscriptions (taxonomy exists; nothing scraped
  yet. PS Plus is live).

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
- Apply the catalog repairs (see IGDB enrichment above).
- Off-disk DB dumps: the S3 bucket is public at bucket level (the endpoint
  ignores bucket policies and per-object ACLs), so dumps need a separate private
  bucket before a `pg_dump` pipeline step can be added.
- Create a Telegram bot and configure `TELEGRAM_BOT_TOKEN` plus
  `TELEGRAM_CHAT_ID` in the production secret to activate scraper failure
  alerts. (Errors already go to Sentry: sentry.hamravesh.com, mahdixak-sentry.)
- The PS Store started answering 403 to the cluster on 2026-10-24 (likely rate
  limiting after repeated sweeps); sweeps are now paced (1 page/s, at most one
  per 20 h). If it persists, PS Store prices and new trailers need another
  route (trailers were fetched from a workstation meanwhile).

## Future features

- Configure and verify the production SMTP mail server. The user-facing support
  flow now covers ticket creation, ticket detail, and user replies; Django admin
  enforces staff-originated replies and ticket status transitions. Production
  credentials and an end-to-end delivery/support test remain.
- Seller admin panel for submitting and managing prices directly (alternative
  to scraping), with auth + approval/moderation workflow.
