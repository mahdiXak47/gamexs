# GameXS Full Development Prompt

You are a senior full-stack engineer. Rebuild the GameXS website and data platform from scratch.

Do not treat this as a generic online game store. GameXS is primarily an Iranian PS5 game price-comparison service.

The core goal is:

> Aggregate PS5 game, account, disc, and subscription prices from Iranian sellers, normalize the data into one canonical catalog, display offers side by side in Persian RTL pages, and send customers to the original seller website to complete the purchase.

GameXS itself must not own inventory, process payments, or complete checkout unless that is explicitly approved as a future product decision.

## 1. Product identity

GameXS compares prices from Iranian gaming retailers. It is not currently a marketplace.

Every seller offer must include:

- Seller name
- Seller domain
- Current price in Toman
- Stock status
- Product type
- Capacity/tier when applicable
- Original seller URL
- Latest scrape timestamp

The primary user action is: compare the offers, then click through to the seller website.

Do not invent in-app checkout, payment processing, inventory management, or seller order fulfillment for the comparison product.

The website is for Persian-speaking Iranian users and must use Persian/Farsi UI text, RTL layout, lang=fa, dir=rtl, a Persian font such as Vazirmatn, Persian digits, the Arabic thousands separator ٬, and prices in Toman.

## 2. Core product taxonomy

A single game may have several independent purchase options.

### Account capacity 1

The seller provides a complete PSN account containing the game. The customer downloads the game and generally keeps the console offline. This is the most restrictive offline-oriented account model.

### Account capacity 2

A shared account is provided. The customer can usually play online and offline.

### Account capacity 3

A shared account is provided. The console must remain connected to the internet while playing. This is normally the cheapest account option.

### Own-account purchase

A digital code or activation intended for the customer’s own PSN account. This must remain distinct from shared-account capacities.

This offer is rarely available from Iranian sellers because Iran does not have a normal official PSN payment path. Do not infer own-account availability merely because a product has no capacity selector.

### Physical disc

A physical PS5 disc. Discs do not have account capacity.

### Subscriptions

Subscriptions such as PlayStation Plus are modeled separately from ordinary games.

PS Plus supports Essential, Extra, and Premium. Each subscription may have full-account/capacity-1, capacity-2, capacity-3, different terms such as 3 months or 1 year, multiple sellers, and independent price history.

### Gift cards

Gift cards are part of the conceptual taxonomy but are not currently implemented in the database or frontend. Do not add gift-card support unless explicitly requested.

## 3. Taxonomy casing rules

The same concepts use different values in different layers.

Scraper Python values:

    ProductType:
    account_game
    own_account_game
    disc
    subscription
    gift_card
    unknown

    AccessTier:
    capacity_1
    capacity_2
    capacity_3
    full_capacity

PostgreSQL values:

    product_type:
    ACCOUNT_GAME
    OWN_ACCOUNT_GAME
    DISC

    access_tier:
    CAPACITY_1
    CAPACITY_2
    CAPACITY_3

Frontend TypeScript values:

    ProductType:
    ACCOUNT_GAME
    OWN_ACCOUNT_GAME
    DISC

    AccessTier:
    CAPACITY_1
    CAPACITY_2
    CAPACITY_3

The scraper loader must explicitly convert lowercase Python enum values into uppercase database values.

The database must enforce:

    ACCOUNT_GAME requires a non-null tier
    OWN_ACCOUNT_GAME requires a null tier
    DISC requires a null tier

Do not use full_capacity as a database tier. Map it to OWN_ACCOUNT_GAME with a null tier.

## 4. Canonical catalog rules

Every catalog game must have:

- A verified English title
- A real IGDB ID
- A unique IGDB ID
- A canonical slug
- PS5 support or valid PS4/PS5 cross-generation support

The canonical title must never be copied directly from a seller page and must not contain Persian or Arabic characters.

Seller titles may contain Persian boilerplate, account labels, capacity labels, disc labels, PS4/PS5 suffixes, edition names, spelling mistakes, abbreviations, and seller-specific naming.

Required flow:

    raw seller title
            ↓
    clean_title()
            ↓
    normalize_game_name()
            ↓
    English-only and PS5 validation
            ↓
    IGDB search and confidence scoring
            ↓
    existing IGDB game or verified alias
            ↓
    canonical ps5_games row
            ↓
    seller listing
            ↓
    append-only price_history row

Never create a new canonical game merely because a seller title is unknown. If an offer cannot be confidently resolved to IGDB, reject it for review.

Do not insert Persian seller titles, fake IGDB IDs, zero IDs, placeholder catalog rows, duplicate catalog rows for different sellers, or separate games merely because capacity/product type differs.

A capacity difference creates a listing, not a game. A seller difference creates a listing, not a game. A price difference creates a price-history record, not a game.

## 5. Database architecture

Use PostgreSQL 16.

### Platform registry

Table: platforms.

Current platform: ps5.

### Seller registry

Table: sellers.

Fields:

- id
- slug
- name
- domain
- is_active

Current seller registry:

    pspro
    yungcenter
    nakhlmarket
    technolife
    persianconsole
    gameplayshop
    digikala
    parsconsole
    gameonestore
    xgamesstore
    gamecenter
    gamario
    cdkeyshare
    dragonshop
    doctorgame
    hajigame
    gameaccess
    clockstore1
    gamepulse
    gpgaming
    gamestore
    uperagame

### Canonical games

Table: ps5_games.

Important fields:

- id
- platform_id
- slug
- title
- genre_label
- publisher
- release_year
- release_date
- cover_url
- main_background_image_url
- description
- igdb_id
- screenshot_ids
- concept_id
- edition_name
- store_display_classification
- price_source
- is_popular
- is_newest
- hero_position
- preorder_hero_position
- created_at

Constraints:

- igdb_id is unique and non-null
- title is English/ASCII-only
- platform_id plus slug is unique
- hero positions are unique and limited to 1–6
- preorder hero positions are unique and limited to 1–6

### Historical URL aliases

Table: ps5_game_slug_aliases.

When a canonical slug changes, the old slug must permanently redirect to the new slug instead of returning 404.

### Seller-title aliases

Table: ps5_game_aliases.

Use this for verified mappings such as FC 27 to EA Sports FC 27.

Aliases must be explicit and verified. Do not use broad fuzzy matching during price loading.

### Listings

Table: listings.

A listing is the stable identity of one seller offer.

Identity:

    seller_id
    source_url
    product_type
    tier

Fields:

- id
- game_id
- seller_id
- product_type
- tier
- source_url
- is_active
- first_seen_at
- last_seen_at

A single seller URL may expose multiple account capacities, so the unique key must include product type and tier.

### Price history

Table: price_history.

Fields:

- id
- listing_id
- price_toman
- in_stock
- scraped_at

This table is append-only. Never update historical prices in place.

The current price is always the newest price_history row ordered by scraped_at descending. Do not use an all-time minimum as the current price.

### PS Plus

Tables: ps_plus and ps_plus_price_history.

PS Plus must not be stored as an ordinary game listing.

ps_plus includes tier, seller, capacity, term, source URL, cover URL, active state, and first/last seen timestamps.

The effective unique identity is tier, seller_id, capacity, and term. Terms such as 3months and 1year must remain separate.

### Official PS Store data

Support:

- ps5_game_tr_info
- ps5_game_us_info

Store data may include product ID, product URL, current price, original price, discount percentage, fetch timestamp, and US PS Plus inclusion flags.

A game concept may have multiple product editions/SKUs. Do not attach a Deluxe product to a Standard catalog game.

### Analytics and operational tables

Support:

- game_page_view_stats
- game_page_view_daily
- game_page_view_uniques
- site_page_views
- web_vitals
- scrape_runs
- scrape_run_attempts

Analytics must be privacy-preserving: no third-party analytics requirement, no query strings stored, no user-identifying cookies required, and anonymous visitor hashes only where needed for daily uniqueness.

### Django-owned tables

Django owns:

- accounts_user
- accounts_otpcode
- accounts_emailverificationtoken
- orders_cartitem
- orders_order
- wishlist_wishlistitem
- game_accounts_psnaccount
- tickets_ticket
- tickets_ticketmessage
- reviews_gamereview

Django catalog models for ps5_games, sellers, and listings must use managed=False. Django must never create or delete those scraper-owned catalog tables.

## 6. Database migrations

Maintain two schema layers:

1. Fresh-install schema in db/init
2. Numbered migrations for existing databases

Every schema change must update both when applicable.

Important migration concepts include:

- PS Plus extraction
- IGDB metadata
- Screenshots and background images
- PS Store information
- Regional PS Store split
- Page-view analytics
- Editorial hero positions
- Seller registration
- Seller-title aliases
- Upera Game support
- Enforced IGDB invariants
- GTA title correction
- Historical game slug aliases
- Scrape health records

Migration 028 allowed unenriched rows as a transitional state. Final behavior must follow migration 029 and reject new catalog rows without valid IGDB identity.

Do not silently delete invalid catalog rows while enforcing constraints. Fail closed and require repair.

## 7. Scraper architecture

Implement the scraper in Python using requests, BeautifulSoup, lxml, psycopg, boto3 for object storage, and Crawl4AI only for sellers that genuinely require it.

### Raw offer model

Each adapter yields:

    seller
    source_url
    raw_title
    product_type
    price_toman
    tier
    in_stock
    image_url
    scraped_at

Adapters are read-only and never mutate seller websites.

### Common HTTP behavior

Use a shared fetcher with:

- Browser-like User-Agent
- Persian Accept-Language
- Retry handling for 429 and 5xx responses
- Per-seller minimum request delay
- Request timeout
- Total response deadline
- HTTPS_PROXY support

A single product-page connection failure must not kill an entire seller crawl.

### Adapter registry

Every adapter must be imported and registered in a central adapter map.

Adding a seller requires:

- New adapter module
- Registry entry
- Seller seed row
- Numbered seller migration
- Tests
- Inclusion in the daily pipeline

Current regular adapters:

    pspro
    cdkeyshare
    digikala
    gamario
    gamecenter
    gameonestore
    gameplayshop
    nakhlmarket
    parsconsole
    persianconsole
    technolife
    xgamesstore
    yungcenter
    dragonshop
    doctorgame
    hajigame
    gameaccess
    clockstore1
    gamepulse
    gpgaming
    gamestore

Upera Game uses a dedicated Crawl4AI pipeline rather than the normal adapter interface.

### PSPro behavior

PSPro is the reference implementation. It is an OpenCart site with server-rendered HTML.

Product pages expose:

- Product title in an h1
- Base price in the cart button
- Capacity options in an OpenCart select
- Optional price deltas in option labels
- Product image
- Stock state

Capacity mapping:

    کامل / اول → CAPACITY_1
    دوم → CAPACITY_2
    سوم → CAPACITY_3

A label such as ظرفیت دوم (+2,700,000 تومان) means base price plus 2,700,000.

Critical rule:

> If a PSPro product has no capacity selector, treat it as a physical disc.

Do not classify tier-less products as own-account digital purchases. Do not use warehouse_id as a disc/digital signal.

Exclude the fake sitewide custom-order product:

    /product/خرید-کالا-خدمات

### Normalization

clean_title() and normalize_game_name() remove seller boilerplate such as خرید, بازی, اکانت, اکانت ظرفیتی, capacity labels, PS4/PS5 suffixes, دیسک, کارکرده, digital-code text, and region labels.

The normalizer also handles Persian digits, Persian edition translations, Roman numerals, sequel numbers, 2K titles, common spelling corrections, and title casing.

This is only a lookup aid, not proof that two seller titles refer to the same game.

### CSV/cache behavior

Support JSONL caches.

If a cache file exists:

- Make no network calls
- Rebuild the CSV from the cache
- Allow parsing/classification changes to be tested offline

Legacy CSV columns:

    game
    account capacity 1
    account capacity 2
    account capacity 3
    game on customer account
    game disk

A zero price means no offer in the legacy CSV. Internally preserve stock status and price history.

### Loader behavior

The loader must:

1. Read cached offers
2. Validate the catalog preflight
3. Normalize each seller title
4. Resolve explicit aliases
5. Resolve exact canonical slugs where safe
6. Reject unresolved seller titles
7. Upsert listings
8. Append price-history observations
9. Preserve source URLs
10. Convert enum casing correctly
11. Run in a transaction

If the database contains invalid catalog rows, fail before loading new seller data.

If an offer is not resolved to a verified canonical game, reject it.

Never create a provisional ps5_games row in the seller loader.

### Seller health

Each seller scrape must:

- Record a scrape run
- Record attempts
- Retry failed runs
- Reject zero-game snapshots
- Reject snapshots that drop by more than 50% from the previous healthy baseline
- Accept exactly 50% of the previous baseline
- Avoid loading suspicious snapshots
- Alert operators only after all retries fail

Default policy:

    3 attempts
    30 seconds between retries

A failed seller must not cause global stale-listing cleanup. Only run stale cleanup when seller processing is healthy.

### Daily pipeline

The pipeline should:

1. Scrape sellers in controlled groups
2. Validate each snapshot
3. Load seller listings and prices
4. Run Upera’s dedicated crawler
5. Run IGDB enrichment
6. Fetch official PS Store prices
7. Download and upload artwork
8. Run stale-listing cleanup only if seller health is acceptable
9. Report failures
10. Return a non-zero exit status when a seller or required stage failed

The production scheduler should run the one-shot pipeline on an interval, defaulting to once per day, with graceful SIGTERM handling.

## 8. Image and object storage

Use object storage for production media.

Canonical paths:

    covers/<slug>-main-cover.webp
    artworks/<slug>-key-art.webp
    screenshots/<filename>

Production origin:

    https://gs3.gamexs.ir/gamexs/

The frontend should construct canonical S3 URLs when possible.

Local development may stream images from scraper/output/images.

Filesystem image routes must use path.basename, reject traversal, return correct MIME types, return 404 for missing files, and add cache headers.

Do not copy the entire scraper image directory into frontend/public.

## 9. Frontend architecture

Use:

- Next.js 16
- React 19
- App Router
- TypeScript
- Tailwind CSS v4
- HeroUI
- PostgreSQL access through pg
- Server Components for database access
- Client Components only for interaction

The frontend reads directly from PostgreSQL for public catalog pages. Do not introduce mock catalog data as the primary source.

### Server/client boundary

Server-only modules include:

- lib/db.ts
- lib/game-details.ts

Never import them into client-component dependency graphs.

lib/covers.ts must remain safe for shared usage and must not require filesystem access.

Resolve server-side URLs and pass serializable props into client components.

### Public routes

Implement:

    /
    /games/[slug]
    /genres/[slug]
    /publishers/[slug]
    /search
    /upcoming
    /ps-plus
    /ps-plus/[tier]
    /account-games
    /disc-games
    /own-account-games
    /capacity-1
    /capacity-2
    /capacity-3
    /guide
    /guide/ps5-capacity-accounts
    /راهنما
    /about
    /contact
    /privacy
    /terms

Supporting routes:

    /api/search
    /api/genre-games
    /api/games/[slug]/view
    /api/pageview
    /api/web-vitals
    /api/cover-proxy
    /api/covers/[filename]
    /api/covers/igdb/[imageId]
    /api/screenshots/[filename]
    /feeds/products.xml
    /image-sitemap.xml
    /sitemap.xml
    /robots.txt

The repository has account UI and backend support, but cart behavior must be treated carefully because pure comparison is the current business model. Do not add checkout behavior without an explicit product decision.

### Homepage

Include:

- RTL header
- GameXS branding
- Search
- Main navigation
- Mobile menu
- Hero carousel
- Featured games
- Popular games
- Newest games
- Upcoming/preorder section
- Full searchable catalog
- Sort controls
- Publisher filters
- Pagination
- Social links
- Trust/disclaimer section
- Footer

The homepage catalog must be database-backed and paginated. Do not send the entire catalog to the browser when only one page is needed.

### Game cards

Show:

- Cover
- PS5 label
- Genre
- Title
- Lowest available price
- Lowest purchase path
- Seller count
- Purchase-type count
- Best-price marker when relevant

Only use in-stock offers with positive prices. Never display zero as a valid price.

### Game detail page

Show:

- Breadcrumbs
- Game title
- Cover/background artwork
- Genre and publisher
- Release date
- Description
- Screenshots
- Similar games
- Other editions/versions
- Official US/TR PS Store prices when available
- Purchase-type selector
- Seller comparison tables
- Stock status
- Current price
- Outbound seller buttons
- Price-history chart
- Reviews
- Wishlist button
- Preorder countdown when applicable
- Persian FAQ
- Disclaimer

Every seller CTA must open the seller site in a new tab with target=_blank and rel=noopener noreferrer.

Clearly state:

> خرید در سایت فروشنده انجام می‌شود. قیمت و موجودی نهایی را قبل از پرداخت در همان سایت بررسی کنید.

### Purchase comparison table

For each purchase type, show seller, domain, price, availability, best-price label, and external purchase link.

Sort valid in-stock offers by price. Show unavailable offers separately or afterward. Do not make unavailable rows look purchasable.

Canonical Persian labels:

    اکانت ظرفیت ۱
    اکانت ظرفیت ۲
    اکانت ظرفیت ۳
    روی اکانت شما
    دیسک فیزیکی

Keep taxonomy display copy in one reusable module.

### Catalog filters

Support search query, popularity/newest/price/alphabetical sort, publisher filter, genre filter, product-type landing pages, and pagination.

Use crawlable anchor links for pagination. Important discovery must not depend only on client-side JavaScript.

### Persian formatting

All displayed numbers use Persian digits. Prices use a shared Toman formatter.

Example:

    ۲٬۵۰۰٬۰۰۰ تومان

Do not use raw toLocaleString directly throughout components.

### Header and footer

Header:

- GameXS logo
- Main navigation
- Search button
- Account button
- Mobile menu
- Genre mega-menu
- Active-route states

Footer:

- About/contact/trust links
- Privacy and terms
- Social links
- Enamad badge when verified
- Telegram and Instagram links once confirmed
- Disclaimer that GameXS does not process seller transactions

### Account UI

Support:

- Login/signup modal
- Orders section if order scaffolding remains enabled
- Wishlist
- PSN accounts
- Support tickets
- Security/account settings
- Logout
- Profile editing
- Error, loading, empty, and retry states

Private pages must be noindex, nofollow and private, no-store.

## 10. Authentication and backend API

Use Django 5.1 and Django REST Framework.

Use JWT authentication through secure HTTP-only cookies, with Bearer-token fallback.

### Authentication flow

Signup endpoint:

    POST /api/auth/signup/

Input: phone_number and password.

Validate Iranian phone format, create an inactive user, generate a six-digit OTP, send it through the configured SMS backend, and return a signed temporary OTP token.

OTP verification:

    POST /api/auth/verify-otp/

Input: otp_token and code.

Validate expiry, enforce the five-attempt limit, mark the phone verified, activate the user, and return/set access and refresh JWT cookies.

Profile completion:

    POST /api/auth/complete-profile/

Input: first_name, last_name, and email.

Save profile data and send email verification.

Email verification:

    GET /api/auth/verify-email/?token=<uuid>

Validate the token, mark the email verified, and redirect to the frontend.

Login:

    POST /api/auth/login/

Use phone number and password. Do not require OTP for normal login. Return whether the email is verified.

Refresh:

    POST /api/auth/token/refresh/

Read the refresh token from the cookie, with body fallback.

Logout:

    POST /api/auth/logout/

Blacklist refresh tokens and clear cookies.

JWT configuration:

    Access lifetime: 1 hour
    Refresh lifetime: 30 days
    Rotate refresh tokens: yes
    Blacklist after rotation: yes

Cookies:

    gx_access
    gx_refresh

Use secure cookies in production.

### CSRF

Unsafe cookie-authenticated requests require CSRF protection.

Frontend API calls must include credentials, fetch a CSRF token when needed, send X-CSRFToken for POST/PATCH/DELETE, attempt one access-token refresh on 401, and retry the original request once after refresh.

### Backend endpoints

Implement:

    /api/auth/
    /api/profile/
    /api/wishlist/
    /api/game-accounts/
    /api/cart/
    /api/orders/
    /api/tickets/
    /api/reviews/

Specific operations:

    GET/PATCH /api/profile/

    GET/POST /api/wishlist/
    DELETE /api/wishlist/<id>/

    GET/POST /api/game-accounts/psn/
    PATCH/DELETE /api/game-accounts/psn/<id>/

    GET /api/cart/
    POST /api/cart/items/
    DELETE /api/cart/items/<id>/
    DELETE /api/cart/clear/

    GET/POST /api/orders/
    GET /api/orders/<id>/

    GET/POST /api/tickets/
    GET/POST /api/tickets/<id>/
    POST /api/tickets/<id>/messages/

    GET/POST /api/reviews/games/<game_id>/

Reviews:

- Public GET returns approved reviews
- Authenticated POST creates or updates a pending review
- Validate ratings
- Enforce one review per user/game
- Staff controls approval

Tickets:

- Users create tickets
- Users reply only to their own tickets
- Staff replies are marked as staff replies
- Staff replies can transition ticket status
- Users cannot access another user’s tickets

Wishlist:

- Validate that the game exists
- Enforce positive target prices
- Apply mutation throttling
- Enforce one wishlist item per user/game

PSN accounts:

- Belong only to the authenticated user
- Support nickname, PSN ID, and region
- Never expose another user’s records

## 11. SEO requirements

Use canonical HTTPS URLs:

    https://gamexs.ir

Normalize HTTP to HTTPS, www to non-www, trailing-slash removal, old slug to canonical slug, and hyphen/underscore variants to canonical slugs.

Indexable pages:

- Homepage
- Game detail pages
- Genre pages
- Publisher pages
- PS Plus pages
- Product-type landing pages
- Guide pages
- Trust pages
- Upcoming page

Non-indexable pages:

- Search pages
- Query-filtered/sorted catalog pages where appropriate
- Account pages
- Cart/private routes
- Internal APIs
- Genuine 404 pages

Use Organization, WebSite, CollectionPage, Product, valid AggregateOffer, BreadcrumbList, FAQPage, and ItemList JSON-LD where appropriate.

Also provide dynamic Open Graph images, XML sitemap, image sitemap, and robots metadata.

Do not claim checkout on GameXS, zero prices, unavailable offers, fake aggregate ratings, fake reviews, or merchant features that imply GameXS fulfills orders.

Sitemaps must contain only canonical, indexable, query-free, valid, deduplicated URLs.

Game sitemap lastModified should come from latest listing or price activity when available.

## 12. Performance and security

Use server-side database queries, pagination, appropriate public caching, private no-store headers for accounts, security headers, strict referrer policy, nosniff, frame denial, Permissions Policy, HSTS in production, safe image URL allowlists, path-traversal protection, input validation, rate limiting, and no secrets in Git/logs/image arguments/source code.

Track:

    CLS
    FCP
    INP
    LCP
    TTFB

Telemetry failures must never break the user experience.

## 13. Local development

Database:

    docker compose up -d

Use PostgreSQL 16. If port 5432 is occupied, configure another host port such as 5434.

Frontend:

    cd frontend
    npm install
    npm run dev
    npm run build
    npm run lint
    npm run test:e2e

Frontend environment:

    DATABASE_URL
    S3_ENDPOINT_URL
    S3_BUCKET
    NEXT_PUBLIC_API_URL

Backend:

    cd backend
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    DJANGO_SETTINGS_MODULE=gamexs.settings.local .venv/bin/python manage.py migrate
    DJANGO_SETTINGS_MODULE=gamexs.settings.local .venv/bin/python manage.py runserver

Scraper:

    cd scraper
    python3 -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/python -m gamexs_scraper.cli pspro --limit 5

## 14. Testing requirements

### Scraper tests

Test Persian and English normalization, Roman numerals, 2K names, edition handling, aliases, IGDB matching, PS5 validation, PS Store product matching, adapter parsing, price deltas, disc/account classification, cache replay without network calls, health thresholds, retries, Telegram alerts, unresolved-title rejection, invalid-catalog rejection, duplicate listing prevention, and append-only price history.

### Backend tests

Test CSRF behavior, signup/login/OTP, expiry and lockout, cookie authentication, refresh/logout, profile access, wishlist validation/throttling, user isolation, PSN account isolation, ticket access isolation, staff reply rules, review moderation and uniqueness, and order/cart behavior if retained.

### Frontend tests

Test production build, type checking, lint, security headers, homepage, game detail, search error/empty states, auth validation, pagination, genre pages, publisher pages, product-type pages, PS Plus, upcoming, SEO routes, sitemap uniqueness, legacy redirects, page errors, and Core Web Vital thresholds.

## 15. Deployment architecture

Production consists of:

- Next.js frontend
- Django API
- PostgreSQL 16
- Scraper runner
- PS Store price job
- S3-compatible object storage
- Xray HTTP proxy
- Kubernetes/Darkube/Helm-managed deployments

Use the current long-running scraper Deployment/runner architecture. The old scraper CronJob manifest is historical/deprecated and must not be treated as the active scheduler.

The PS Store fetcher can remain a separate scheduled job.

The proxy must fetch an Xray subscription, test endpoints, select the fastest reachable configuration, expose an internal HTTP proxy on port 10809, restart Xray after refresh, and use Kubernetes health checks.

Use Kubernetes Secrets for:

    DATABASE_URL
    IGDB credentials
    S3 credentials
    Telegram credentials
    SMTP credentials
    Proxy subscription URL

Never hardcode secrets.

## 16. Current known gaps

Track these remaining issues:

- Verify IGDB enrichment quality in production
- Audit cross-seller catalog integrity in production
- Review special-edition rows
- Apply and verify GTA Trilogy migrations
- Preserve old GTA slugs with permanent redirects
- Verify Enamad badge and certificate
- Confirm final logo
- Confirm Telegram and Instagram URLs
- Finalize and lock the database schema
- Deploy and verify the current scraper runner
- Configure Telegram scraper alerts
- Configure production SMTP
- Verify end-to-end support email delivery
- Decide whether price-drop alerts are required
- Gift cards are not implemented
- EA Play and other subscriptions are not implemented
- Seller-admin price submission is not implemented
- Merchant Center feed is intentionally disabled pending policy review
- Bing Webmaster verification is incomplete
- Production Core Web Vitals should be checked
- JSON-LD should be validated in Google tools
- Image CDN/domain should be verified in Search Console
- Monthly SEO monitoring is required

## 17. Important inconsistencies to resolve consciously

Some historical documents describe an earlier version of the project. Use the current implementation and database policy as the source of truth.

Known inconsistencies:

- Older documents describe a Node backend; the current backend is Django.
- Older documents say there was no frontend or database; both now exist.
- Older documents describe only one scraper adapter; the current repository contains many adapters plus Upera support.
- Migration 028 allowed temporary unenriched games; the final policy rejects new unenriched catalog rows.
- The old scraper CronJob is deprecated; production uses the runner/Deployment architecture.
- The product is pure comparison, but backend cart/order models exist as scaffolding. Do not automatically turn them into a marketplace.
- Frontend configuration references private/cart handling, but the current route set does not necessarily contain a complete cart page. Verify before exposing navigation to it.
- Some documentation is historical or incomplete; inspect actual behavior before extending it.

## 18. Final acceptance criteria

The project is complete when:

1. A fresh PostgreSQL database initializes successfully.
2. All schema invariants are enforced.
3. A verified IGDB catalog can be imported.
4. Seller offers resolve only to canonical catalog games.
5. Seller listings and append-only price history load safely.
6. Current prices come from the newest observation.
7. Failed or suspicious seller snapshots do not corrupt the database.
8. The daily scraper runs repeatedly and safely.
9. The frontend displays real database-backed catalog data.
10. Persian RTL UI works on mobile and desktop.
11. Game detail pages clearly compare seller offers.
12. Every outbound offer links to the original seller.
13. No false checkout or marketplace behavior is presented.
14. Account authentication and private features are secure.
15. Reviews, wishlist, tickets, and PSN-account ownership are isolated correctly.
16. SEO routes produce correct canonical URLs and structured data.
17. Sitemaps contain only valid canonical URLs.
18. Images load from object storage in production.
19. Builds, tests, linting, and security-header checks pass.
20. Deployment configuration does not expose secrets or use deprecated production resources.

Start with the smallest complete vertical slice:

    PostgreSQL schema
    → canonical IGDB game
    → one seller adapter
    → listing and price history
    → homepage catalog
    → game detail comparison page
    → outbound seller link

Then expand seller coverage, PS Plus, authentication, account features, SEO, analytics, and production operations.

Do not add speculative features, abstraction layers, payment systems, or marketplace behavior that are not required by this specification.

