# SEO Tasks

## Priority 1 — Crawl and Index Control

- [x] Add `noindex,follow` metadata for filtered, sorted, and searched homepage/catalog URLs that use query parameters.
- [x] Add `noindex,follow` metadata for filtered, sorted, and searched genre URLs that use query parameters.
- [x] Add explicit `noindex,nofollow` metadata for `/account`.
- [x] Add explicit `noindex,nofollow` metadata for `/cart`.

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
- [ ] Add basic pageview analytics, using GA4 or a privacy-respecting alternative.
- [ ] Run Core Web Vitals / PageSpeed checks for homepage, game detail, genre, publisher, purchase-type, and search pages.
- [ ] Validate live JSON-LD templates with Google Rich Results Test and URL Inspection after deployment.

## Remaining Priority 2 — Content and Structured Data

- [ ] Add an indexable Persian FAQ / taxonomy explainer page, for example `/راهنما`, covering account capacities, disc games, own-account purchases, and subscriptions.
- [ ] Add `FAQPage` JSON-LD to the Persian FAQ / taxonomy explainer page only as non-critical schema; Google Search no longer shows FAQ rich results for ordinary sites.
- [ ] Add `dateModified` to game `Product` JSON-LD, sourced from the latest relevant `price_history.scraped_at` value.
- [ ] Add dynamic Open Graph images with Next.js `opengraph-image.tsx`, showing game cover art and lowest price where available.
- [ ] Add an image sitemap, or image sitemap entries, for game cover art, key art, and screenshots that should be discoverable in Google Images.
- [ ] Verify the image CDN/domain in Search Console if indexed images are served from `gs3.gamexs.ir`.

## Remaining Priority 3 — Crawlable Discovery

- [ ] Revisit `noindex` behavior for plain pagination: keep `noindex,follow` for search/filter/sort URLs, but evaluate allowing indexable self-canonical `?page=N` catalog pages.
- [ ] Replace client-only pagination controls with crawlable `<a href>` links so Googlebot can discover paginated catalog, genre, publisher, and purchase-type pages.
- [ ] Audit key internal navigation links to confirm important indexable pages are reachable through crawlable `<a href>` links, not only search boxes or JavaScript actions.

## Remaining Priority 4 — Product Feed

- [ ] Scope Google Merchant Center eligibility and policy requirements for a comparison-only site that links out to sellers.
- [ ] Build a Google Merchant Center product feed from the same DB-backed product data used by the sitemap, if policy review confirms it is suitable.
- [ ] Keep GameXS product schema aligned with Product snippet / aggregator eligibility; do not add merchant-listing-only fields that imply checkout happens on GameXS unless policy review confirms eligibility.

## Remaining Priority 5 — Ongoing Off-Site SEO

- [ ] Build Persian gaming community and directory presence, including relevant forums, Telegram channels, and third-party mentions.
- [ ] Run a monthly manual visibility check for `site:gamexs.ir` on Google.
- [ ] Run monthly Persian price-query checks for priority games in Google, ChatGPT, and Perplexity.
