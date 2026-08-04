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

## Priority 3 — Indexable Landing Pages

- [x] Add publisher landing pages at `/publishers/[slug]` for high-volume publishers.
- [x] Add repository helpers for publisher slug lookup and publisher-scoped game lists.
- [x] Add publisher routes to the XML sitemap.
- [x] Add purchase-type landing pages for account games, disc games, own-account games, and capacity pages.
- [x] Add purchase-type routes to the XML sitemap.

## Priority 4 — Navigation Hygiene

- [x] Remove or replace `#` placeholder links in header navigation.
- [x] Remove or replace `#` placeholder links in footer quick links/social links.

## Validation

- [x] Run lint. Fails on pre-existing React Compiler lint issues outside this SEO change set; see implementation notes.
- [x] Run production build.
