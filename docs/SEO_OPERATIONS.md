# SEO operations runbook

This document covers the remaining SEO actions that cannot be completed by a
repository change alone.

## Availability monitoring

Run the public monitor from an external scheduler, not inside the same
frontend cluster:

```bash
SEO_BASE_URL=https://gamexs.ir \
SEO_MONITOR_GAME_SLUG=clair-obscur-expedition-33 \
SEO_MONITOR_PUBLISHER_SLUG=sony \
node ops/seo-monitor.mjs
```

Set `SEO_ALERT_WEBHOOK` to a team webhook and keep the representative slugs
pointing to known live pages. The check covers the homepage, robots, both
sitemaps, one game, publisher, genre, PS Plus tier, and purchase-type page.

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

## Off-site work

Community mentions, directory submissions, Telegram/forum outreach, and
monthly Google/ChatGPT/Perplexity visibility checks require a human owner.
Record the date, query, result URL, and whether the mention links to a
canonical GameXS page.
