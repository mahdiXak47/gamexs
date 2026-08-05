# Next.js Best-Practice Tasks — Completed

All items below were implemented. This file now records what was done and the
key decisions, so future sessions don't re-do or accidentally reverse them.

## 1. CSRF Protection for Cookie Auth — DONE

Auth uses httpOnly JWT cookies; DRF views are `csrf_exempt`, so Django's global
`CsrfViewMiddleware` was bypassing the API entirely.

- `backend/apps/accounts/middleware.py` — `CookieCsrfMiddleware` re-runs Django's
  CSRF check on non-safe `/api/` requests (placed **before** `CsrfViewMiddleware`
  so `_csrf_processing_done` isn't already set).
- `GET /api/auth/csrf/` (`CsrfTokenView`, `views.py`) bootstraps the `csrftoken`
  cookie via `get_token` + `ensure_csrf_cookie`.
- `backend/gamexs/settings/base.py` — added `CSRF_TRUSTED_ORIGINS` (env-configurable).
- Frontend `lib/csrf.ts` + `lib/api.ts` — unsafe methods (`POST/PUT/PATCH/DELETE`)
  ensure a CSRF token and send `X-CSRFToken`; `refreshAccessToken` included too.
- `SameSite=Lax` retained (only relaxed if topology requires).
- Tests: `backend/apps/accounts/tests.py` — uses `Client(enforce_csrf_checks=True)`
  (the default client sets `_dont_enforce_csrf_checks`, which would skip the check).
  Run: `DJANGO_SETTINGS_MODULE=gamexs.settings.local .venv/bin/python manage.py test apps.accounts`

## 2. Remove Inline Script Dependencies From CSP — DONE (nonce-based)

The only JS-executing inline script was the Goftino loader (JSON-LD is
`application/ld+json`, not subject to `script-src`). `'unsafe-inline'` is gone
from `script-src`/`script-src-elem`.

- `frontend/src/proxy.ts` — Next 16 `proxy` (renamed from `middleware`) generates
  a per-request nonce, sets `Content-Security-Policy` with `'nonce-…' 'strict-dynamic'`,
  and exposes it as `x-nonce`. Next auto-applies the nonce to its own framework
  scripts and to `<Script nonce=…>`.
- `app/layout.tsx` reads the nonce via `headers()` and passes it to the Goftino
  `<Script>`.
- `'unsafe-inline'` retained only for `style-src` (React inline `style=` attributes).
- Nonce CSP requires **dynamic rendering**. `force-dynamic` added to the pages that
  were static: `about`, `contact`, `privacy`, `terms`, `not-found`.
- CSP was removed from `next.config.ts` (proxy is now the single source).

## 3. Add `global-error.tsx` — DONE

`frontend/src/app/global-error.tsx` — self-contained (own `<html>`/`<body>`, no
providers), RTL Persian, retry (`unstable_retry`) and home link. Catches root-layout
failures that `app/error.tsx` can't.

## 4. Add Segment-Specific Error Boundaries — DONE

`app/games/[slug]/error.tsx`, `app/cart/error.tsx`, `app/account/error.tsx` (account
copy intentionally avoids exposing sensitive details). Note the Next 16 prop is
`unstable_retry`, not `reset`.

## 5. Fix Full ESLint Suite Failures — DONE

Removed the `react-hooks/set-state-in-effect` errors and unused import:

- `GameGrid.tsx`, `MegaMenu.tsx`, `PublisherFilter.tsx`, `SearchOverlay.tsx` — replaced
  synchronous effect setState with **render-phase state adjustment** (keeping setState
  only in callbacks/async).
- `UpcomingGames.tsx` — dropped unused `toPersianDigits` import.

`npm run lint` is clean.

## 6. Add Lighthouse / Playwright Performance Checks — DONE

- `frontend/playwright.config.ts` (`webServer` runs the production build) +
  `frontend/tests/e2e/perf.spec.ts` — smoke-check `/`, `/search`, `/account`, `/cart`,
  `/about`, `/ps-plus`, a real `/games/[slug]` (from the homepage grid), and a
  conservative homepage LCP bound (< 6000ms).
- Run: `npm run build && DATABASE_URL=… npm run test:e2e`
- Chromium screens covered via `npx playwright install chromium`.

## 7. Add Runtime Header Tests — DONE

- `frontend/scripts/check-headers.mjs` — starts `next start`, asserts `Cache-Control`
  (catalog vs `private, no-store` account), security headers (CSP has a nonce and no
  `unsafe-inline` in script-src, `X-Frame-Options`, etc.), and that `/api/*` gets no CSP.
- Run: `npm run build && DATABASE_URL=… npm run test:headers`

## 8. Decide on a Real Web Vitals Sink — DONE (self-hosted)

`WebVitalsReporter` now defaults to a same-origin collector instead of silently
dropping metrics when `NEXT_PUBLIC_WEB_VITALS_ENDPOINT` is unset.

- `frontend/src/app/api/web-vitals/route.ts` — beacon/keepalive POST, validated, stored
  in the shared `web_vitals` Postgres table (append-only; never throws to the client).
- Schema: `db/init/01_schema.sql` + `db/migrations/015_add_web_vitals.sql`.
- Override with `NEXT_PUBLIC_WEB_VITALS_ENDPOINT` to use an external collector later.

## 9. Review Remaining Raw `<img>` Usage — DONE

Converted internal/S3 (allowlisted in `next.config.ts` `images.remotePatterns`) images
to `next/image`: game-detail hero, `GamePreorderBanner` key art, `GameRecommendations`
card + suggestion thumb, and the account wishlist cover. **The enamad `<img>` in
`Footer.tsx` stays raw** — it requires the non-standard `code` attribute that
`next/image` can't reproduce.

## 10. Revisit `force-dynamic` Versus Data Cache — DONE (decision: keep dynamic + edge cache)

The nonce-based CSP (item 2) now requires every page to be dynamically rendered, so
per-section static/ISR caching would conflict with the strict policy. Decision: keep
price-sensitive catalog pages dynamic and rely on the existing `Cache-Control`
edge-cache headers (`s-maxage`/`stale-while-revalidate`) rather than build-time DB
access. Revisit only if/when a nonce-free static path is introduced.
