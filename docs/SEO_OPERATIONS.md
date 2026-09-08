# SEO operations runbook

This document covers the remaining SEO actions that cannot be completed by a
repository change alone.

## Availability monitoring

Run the public monitor from an external scheduler, not inside the same
frontend cluster. The repository includes
`.github/workflows/seo-monitor.yml`, which runs every 30 minutes and supports
manual dispatch:

```bash
SEO_BASE_URL=https://gamexs.ir \
SEO_MONITOR_GAME_SLUG=clair-obscur-expedition-33 \
SEO_MONITOR_PUBLISHER_SLUG=sony \
node ops/seo-monitor.mjs
```

The monitor checks status and latency, and also rejects streamed `404`/`500`
documents or `noindex` responses that incorrectly arrive with HTTP `200`.

Set `SEO_ALERT_WEBHOOK` to a team webhook and keep the representative slugs
pointing to known live pages. The check covers the homepage, robots, both
sitemaps, one game, publisher, genre, PS Plus tier, and purchase-type page.
Configure `SEO_BASE_URL` and representative slugs as repository variables when
the production catalog differs from the defaults. Configure
`SEO_ALERT_WEBHOOK` as an Actions secret, then enable the workflow after it is
merged into the repository's default branch.

The public smoke check on 2026-09-08 found that the old GTA slug still returns
`200` while the new canonical slug returns the site's `404` page, so the GTA
data/redirect migrations are not deployed yet. The same check saw sitemap
responses take roughly 17 seconds and the concurrent monitor hit its timeout;
deploy the lightweight sitemap query change with the next frontend release,
then rerun the monitor against production.

## Search Console recovery

1. Preserve the original export and record which Page indexing reason it came
   from, the affected count, example URLs, first detected date, and validation
   status.
2. Compare those URLs with frontend/reverse-proxy/database/container logs for
   22–23 August 2026. Look for 502/504 responses, pool exhaustion, timeouts,
   OOM/restarts, and deploy or migration events.
3. Test one representative URL from each failure group with **Test live URL**.
   Only after all representative URLs return 200 and are indexable, choose
   **Validate fix** for the relevant Search Console report. Do not submit all
   65 URLs individually.
4. Repeat the Page indexing and sitemap reports monthly. Record submitted vs.
   indexed sitemap counts after catalog or deployment changes.

## Bing and performance tools

Verify `gamexs.ir` in Bing Webmaster Tools using the DNS method, then submit
`https://gamexs.ir/sitemap.xml`. Run PageSpeed/Core Web Vitals checks against
the homepage, a real game, genre, publisher, purchase-type, and search page.
The repository already stores anonymous Web Vitals in Postgres; do not add
personal identifiers to that table.

## Merchant Center

The guarded endpoint `/feeds/products.xml` is disabled unless
`MERCHANT_FEED_ENABLED=true`. Confirm Google Merchant Center policy eligibility
for a comparison-only site that sends customers to third-party sellers before
enabling or submitting it. If approved, submit the feed and monitor policy
status. The feed must not imply that GameXS accepts payment or fulfills orders.

### Current policy gate (reviewed 2026-09-08)

Google's [online store URL requirements](https://support.google.com/merchants/answer/12160471)
say that a site must not be a marketplace where other businesses sell their
products and that customers must be able to buy directly from the site without
being redirected elsewhere. GameXS is intentionally a comparison service: it
does not accept payment or fulfill orders, and every offer links to the
seller's site. On the current product model, this is therefore a **no-go for
Merchant Center product feeds** unless Google provides written confirmation of
an eligible comparison-service setup or the business model changes.

Keep `MERCHANT_FEED_ENABLED=false` and do not add merchant-only fields that
suggest GameXS is the seller. Organic Product/Offer structured data may remain
in use where it accurately describes the comparison page; it is not evidence
that a Merchant Center feed is eligible.

## Off-site work

Community mentions, directory submissions, Telegram/forum outreach, and
monthly Google/ChatGPT/Perplexity visibility checks require a human owner.
Record the date, query, result URL, and whether the mention links to a
canonical GameXS page.
