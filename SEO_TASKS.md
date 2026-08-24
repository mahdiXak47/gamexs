# SEO Tasks

## Priority 0 — Search Console Recovery

- [ ] [P0] Confirm which Search Console Page indexing report the exported URL
  list belongs to (`Server error (5xx)`, `Crawled — currently not indexed`, or
  another reason); preserve URL examples and counts for each report.
- [ ] [P0] Inspect frontend, reverse-proxy, database, and container logs for
  August 22–23, 2026. The export contains 65 failed URLs (57 publisher, 4
  genre, 2 PS Plus, 2 game), 64 crawled on August 22, and all checked URLs now
  return `200`. Look for DB connection exhaustion/timeouts, `502`/`504`
  responses, OOM/restarts, and deployment or migration events.
- [ ] [P0] Schedule `ops/seo-monitor.mjs` in an external monitoring service for
  the homepage, sitemap, one
  game, one publisher, one genre, one PS Plus tier, one purchase-type page,
  `/robots.txt`, and `/sitemap.xml`; alert on non-2xx responses and high
  latency.
- [ ] [P0] Run “Test live URL” on representative historical failures, then
  click “Validate fix” after the outage is confirmed resolved. Do not manually
  request indexing for all 65 URLs; record validation results and crawl dates.

## Priority 1 — Crawl and Index Control

- [x] Add `noindex,follow` metadata for filtered, sorted, and searched homepage/catalog URLs that use query parameters.
- [x] Add `noindex,follow` metadata for filtered, sorted, and searched genre URLs that use query parameters.
- [x] Add explicit `noindex,nofollow` metadata for `/account`.
- [x] Add explicit `noindex,nofollow` metadata for `/cart`.

## Priority 1 — Current Indexation and Canonical Fixes

- [x] [P1] Redirect hyphen/underscore game-slug aliases to the database slug
  with a permanent redirect; build canonical and Open Graph URLs from
  `game.slug`, not the requested slug.
- [x] [P1] Enforce one HTTPS, non-`www`, non-trailing-slash URL format and test
  HTTP, `www`, trailing-slash, query, and old-slug variants.
- [x] [P1] Audit `noindex` and `X-Robots-Tag`: retain intentional exclusions
  for `/search`, `/account`, and genuine 404 pages, but ensure game, genre,
  publisher, PS Plus, and purchase-type pages remain indexable.
- [x] [P1] Process every Search Console 404 example: permanently redirect
  moved content, or keep a real `404` and remove the URL from internal links
  and the sitemap; never redirect missing pages to the homepage.
- [x] [P1] Review “Crawled — currently not indexed” examples in URL Inspection;
  compare Google’s selected canonical with the declared canonical and improve
  or remove thin pages with no meaningful offers, descriptions, or unique value.
- [x] [P1] Keep `/sitemap.xml` limited to canonical, indexable, `200` URLs;
  check for duplicates, query URLs, redirects, 404s, and stale deleted games.
- [x] [P1] Investigate the stale sitemap `lastmod` value (`2026-07-11` during
  the August issue); verify active listings update `last_seen_at` and that
  sitemap timestamps reflect real content changes.
- [x] [P1] Prevent `https://gs3.gamexs.ir/` from becoming an indexable page by
  making the bucket root return `403`/`404` or `X-Robots-Tag: noindex`, while
  keeping required image objects available.

## Priority 2 — Structured Content and Schema

- [x] Add reusable Persian FAQ content for game purchase pages.
- [x] Add `FAQPage` JSON-LD to game detail pages.
- [x] Add reusable Persian FAQ content for PS Plus tier pages.
- [x] Add `FAQPage` JSON-LD to PS Plus tier pages.
- [x] Enrich global `Organization` JSON-LD with logo and contact/support fields.
- [x] Add `WebPage`/`CollectionPage` JSON-LD to homepage.
- [x] Add `BreadcrumbList` JSON-LD to indexable collection and subscription pages.
- [x] Add default Open Graph and Twitter preview images site-wide.

## Priority 3 — Indexable Landing Pages

- [x] Add publisher landing pages at `/publishers/[slug]` for high-volume publishers.
- [x] Add repository helpers for publisher slug lookup and publisher-scoped game lists.
- [x] Add publisher routes to the XML sitemap.
- [x] Add purchase-type landing pages for account games, disc games, own-account games, and capacity pages.
- [x] Add purchase-type routes to the XML sitemap.

## Priority 4 — Navigation Hygiene

- [x] Remove or replace `#` placeholder links in header navigation.
- [x] Remove or replace `#` placeholder links in footer quick links/social links.

## Priority 5 — Trust and E-E-A-T Signals

- [x] Add indexable About, Contact, Privacy, and Terms pages.
- [x] Link trust pages from the footer.
- [x] Add trust pages to the XML sitemap.

## Validation

- [x] Run lint. Fails on pre-existing React Compiler lint issues outside this SEO change set; see implementation notes.
- [x] Run production build.

## Remaining Priority 1 — Verification and Measurement

- [x] Verify `gamexs.ir` in Google Search Console, preferably with a DNS TXT record.
- [x] Submit `https://gamexs.ir/sitemap.xml` in Google Search Console after verification.
- [ ] Verify `gamexs.ir` in Bing Webmaster Tools.
- [x] Add basic privacy-preserving pageview analytics. The frontend now stores
  anonymous path/timestamp events in `site_page_views`; apply migration 024 in
  existing environments.
- [ ] Run Core Web Vitals / PageSpeed checks for homepage, game detail, genre, publisher, purchase-type, and search pages.
- [ ] Validate live JSON-LD templates with Google Rich Results Test and URL Inspection after deployment.
- [ ] Review Search Console monthly: Page indexing, sitemap coverage, 5xx/404
  trends, canonical selection, Core Web Vitals, and performance by page type.
- [ ] Monitor submitted-versus-indexed sitemap URLs after each significant
  catalog or deployment change.

## Remaining Priority 2 — Content and Structured Data

- [x] Add an indexable Persian FAQ / taxonomy explainer page at `/guide` (with
  the Persian `/راهنما` alias), covering account capacities, disc games,
  own-account purchases, and subscriptions.
- [x] Add `FAQPage` JSON-LD to the Persian FAQ / taxonomy explainer page only as
  non-critical schema; Google Search no longer shows FAQ rich results for
  ordinary sites.
- [x] Add `dateModified` to game `Product` JSON-LD, sourced from the latest
  relevant `price_history.scraped_at` value.
- [x] Add dynamic Open Graph images with Next.js `opengraph-image.tsx`, showing
  game cover art and lowest price where available.
- [x] Add `/image-sitemap.xml` with cover art and available screenshot entries
  for canonical game URLs.
- [ ] Verify the image CDN/domain in Search Console if indexed images are served from `gs3.gamexs.ir`.
- [x] [P2] Add `highPrice` to `AggregateOffer` only when the offer set is complete
  and valid; add `aggregateRating`/`review` only from real, visible, approved
  user reviews. Treat these as secondary to indexation recovery.

## Remaining Priority 3 — Crawlable Discovery

- [x] Revisit `noindex` behavior for plain pagination: search/filter/sort URLs
  remain `noindex,follow`; plain `?page=N` catalog pages are indexable with
  a self-canonical URL.
- [x] Replace client-only pagination controls with crawlable `<a href>` links
  so Googlebot can discover paginated catalog, genre, publisher, and
  purchase-type pages.
- [x] Audit key internal navigation links and add the guide to the footer;
  important catalog, genre, publisher, purchase-type, and trust paths use
  crawlable links.

## Remaining Priority 4 — Product Feed

- [ ] Scope Google Merchant Center eligibility and policy requirements for a comparison-only site that links out to sellers.
- [ ] Build a Google Merchant Center product feed from the same DB-backed product data used by the sitemap, if policy review confirms it is suitable.
- [ ] Keep GameXS product schema aligned with Product snippet / aggregator eligibility; do not add merchant-listing-only fields that imply checkout happens on GameXS unless policy review confirms eligibility.

## Remaining Priority 5 — Ongoing Off-Site SEO

- [ ] Build Persian gaming community and directory presence, including relevant forums, Telegram channels, and third-party mentions.
- [ ] Run a monthly manual visibility check for `site:gamexs.ir` on Google.
- [ ] Run monthly Persian price-query checks for priority games in Google, ChatGPT, and Perplexity.
