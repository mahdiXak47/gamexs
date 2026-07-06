# GameXS — Iranian PS5 Game Price Comparison Service

## What this is

A web service for Iranian customers that aggregates PS5 game/account/subscription
prices from multiple Iranian online game retailers and shows them side by side,
so a customer can see, for one game, what every tracked seller charges across
every way that game can be bought. Platform focus starts with **PS5 only**, but
the data model is generic across platforms (PC, PS4, Xbox, Switch) for later
expansion.

## Business model

**Pure price comparison, not a marketplace.** The service never handles the
transaction itself. Each price row links out to the seller's own site to
complete checkout there. No payments, no in-house inventory, no checkout flow
on our side (at least for this phase).

## The product taxonomy (this is the core domain concept)

PS5 games are sold in Iran through a few structurally different purchase
types, and a single game can appear under several of them simultaneously,
each at a different price:

1. **Account — Capacity 1**: the seller hands over a full PSN account
   containing the game. Buyer downloads it, then must play **offline**
   (turns off internet) to avoid the account being reclaimed/logged out
   elsewhere. Exclusive use, no sharing.
2. **Account — Capacity 2**: a shared PSN account. Buyer can play **online or
   offline**. More flexible, priced higher than Capacity 3.
3. **Account — Capacity 3**: a shared PSN account, but the buyer's console
   must **stay connected to the internet** at all times to play. Cheapest
   account tier — most restrictive.
4. **Own-account game purchase**: a digital code/key activated on the
   **customer's own PSN account**. Distinct from all account-capacity types
   above (no shared account involved at all). *(Note: in practice, at least
   for pspro, this is essentially never actually offered — see "surprising
   findings" below.)*
5. **Physical disc**: a real PS5 disc, bought like normal retail. No
   capacity/account concept applies. Just price (+ maybe condition:
   new/used, though used copies are tracked in a separate market on at least
   one seller).
6. **Subscriptions** (PS Plus, EA Play, etc.): sold via the *same 3 patterns*
   as accounts — own-account activation, Capacity 2 shared, Capacity 3
   shared. No Capacity 1 for subscriptions (doesn't make sense — the whole
   point of a subscription is online access).
7. **Gift cards**: PSN wallet top-ups, sold by denomination. No tiers.

Capacity tiers are **not game-specific** — they're a property of any
account-based offer (games and subscriptions both use them). Own-account
purchases, discs, and gift cards never have tiers.

## Target sellers (Iranian PS5 game retailers)

11 sites identified as scraping targets. Only **pspro.ir** has been
reverse-engineered and scraped so far:

| Seller | Domain | Status |
|---|---|---|
| pspro | pspro.ir | ✅ Adapter built & verified |
| youngcenter | yungcenter.com | Not started |
| nakhlmarket | nakhlmarket.com | Not started (likely WooCommerce) |
| persianconsole | persianconsole.ir | Not started |
| gameplayshop | gameplayshop.ir | Not started (likely WooCommerce) |
| digikala | digikala.com | Not started (large marketplace, may have internal JSON API) |
| parsconsole | parsconsole.com | Not started |
| gameonestore | gameonestore.com | Not started (likely WooCommerce) |
| xgamesstore | xgamesstore.org | Not started (likely WooCommerce) |
| game-center | game-center.ir | Not started (likely WooCommerce) |
| gamario | gamario.com | Not started |
| cdkeyshare | cdkeyshare.ir | Not started |

## Tech stack decisions

- **Frontend**: Next.js (App Router), RTL Persian UI as primary locale
  (bilingual/English toggle possible later, not required for MVP).
- **Backend/API**: Node.
- **Scraper workers**: Python (`requests` + `BeautifulSoup` + `lxml`). Plain
  HTTP GET has been sufficient for every site inspected so far — no headless
  browser needed yet, though that may change for JS-heavy sites (Digikala is
  the likely candidate to need something different, e.g. its own internal
  API instead of HTML scraping).
- **Database**: Postgres (not yet implemented).
- **Game metadata / canonical catalog**: planned to use IGDB or RAWG as the
  source of truth for game titles/cover art/platforms, with fuzzy matching to
  link each seller's raw listing to a canonical game (not yet implemented —
  see "known gaps" below).
- **Refresh cadence**: periodic background scraping (every few hours), not
  live-scrape-per-page-view. The site should always read from the database,
  never scrape synchronously on a user request.
- **User accounts**: optional, deferred. Not needed for MVP browsing.

## Core customer-facing feature (what the UI needs to support)

For a given game, show a **comparison table**: rows/groups by product type
(account tiers, own-account, disc, subscriptions), columns for seller name,
price, stock status, and a "go to seller" link that redirects out. This is
the single most important view in the whole product — it's the reason the
service exists.

Secondary pages: a browsable/searchable game catalog (PS5 only for now), a
subscriptions comparison page, a gift cards comparison page.

## pspro.ir — what we know in detail (reference implementation)

This is the one seller fully reverse-engineered so far, useful as a concrete
example of how messy/specific this gets per seller:

- Runs on **OpenCart** (not WooCommerce, despite URL patterns that looked
  WooCommerce-like at a glance — always verify, don't assume from the URL).
- Fully server-rendered HTML; a plain HTTP GET with a browser-like
  `User-Agent` gets everything needed, no JS execution required.
- Game catalog lives at `pspro.ir/category/خرید-بازی-PS5`, paginated via
  `?page=N`, roughly 52 pages × ~28 products ≈ 1,400+ PS5 titles total.
- Each product page:
  - Title: `<h1>`.
  - Base price: `#button-cart` button text, e.g. `"4,799,000 تومان"`
    (currency is **Toman**, not Rial — matters for every price in this
    system).
  - Capacity tiers, when present, are an OpenCart "option" `<select>`
    (`name="option[<id>]"`) whose `<option>` labels encode the tier name
    (کامل/اول = Capacity 1, دوم = Capacity 2, سوم = Capacity 3) plus an
    optional price delta written right into the label text, e.g.
    `"ظرفیت دوم (+2,700,000 تومان)"` means that tier's price = base +
    2,700,000. A tier with no `(+X تومان)` suffix costs exactly the base
    price.
  - A `warehouse_id` `<select>` (labeled "فروشنده" = "seller" in the UI, but
    it's actually a fulfillment/warehouse field) is the key signal for
    **disc vs. digital**: if its only option is "آنلاین" (Online), the
    product is digital (account-tiered or own-account); if it lists named
    physical pickup branches (e.g. "شعبه چارسو", "شعبه میدان امام خمینی"),
    it's a **physical disc**.
  - One recurring artifact: `/product/خرید-کالا-خدمات` is a sitewide "submit
    a custom order" CTA link embedded on every category page — not a real
    product, must be filtered out of any crawl.
  - Used/secondhand games ("کارکرده") live in a completely separate category
    tree from new games, so the main game category crawl naturally excludes
    them already.

### Surprising finding worth remembering

Initially assumed tier-less listings (no capacity `<select>`) were
"own-account digital purchases." **This was wrong.** Cross-checking against
an independently-collected 500-game reference dataset showed `game on
customer account` is essentially *always* 0 and `game disk` is *almost
always* populated. Root cause: Iran has no official PSN store / payment
method, so buying a digital code redeemable on a customer's *own* PSN
account isn't a realistic purchase path for most Iranian buyers — sellers
instead sell either shared/tiered accounts, or physical discs. The
`warehouse_id` field (physical branch names vs. "Online") is what actually
distinguishes disc from digital, not the absence/presence of a tier
selector. This is a good example of why **cross-checking scraped data
against independent samples matters** — a plausible-looking assumption was
confidently wrong until checked against real data.

## Output format currently used (per-seller CSV, one row per game)

```
game,account capacity 1,account capacity 2,account capacity 3,game on customer account,game disk
saros,0,7499000,4799000,0,0
```

- `0` means "this seller doesn't offer this product type for this game" —
  it does **not** currently distinguish "not offered" from "offered but
  currently out of stock" (stock status is tracked internally per-offer but
  not yet surfaced in this CSV).
- Game names are normalized (boilerplate like "خرید", "اکانت بازی", "برای
  PS5" stripped, lowercased) to merge regional variants (R1/R2/R3) of the
  same title into one row (cheapest price kept). Different **editions**
  (Deluxe/Collector's/Lenticular) are intentionally kept as separate rows
  since they're priced very differently.
- This normalization is a same-seller heuristic only — matching the *same*
  game *across different sellers* (who'll title things differently) will
  need the planned IGDB/RAWG canonical catalog + fuzzy matching + admin
  review queue, not this regex-based approach.

## Known gaps / not yet built

- Only 1 of 11 target sellers has a working scraper.
- No canonical cross-seller game catalog/matching yet (IGDB/RAWG
  integration planned, not started).
- No database — everything today is CSV files produced by one-off scraper
  runs.
- No frontend at all yet — this document exists specifically to hand off to
  a separate chat for frontend/UI design work.
- No scheduling/cron for repeat scraping, no price history tracking.
- Subscriptions (PS Plus, EA Play) and gift cards haven't been scraped for
  any seller yet — the taxonomy above is designed to support them, but no
  data exists.
- No stock-status column in the CSV output yet (tracked internally, not
  exposed).

## What the UI needs to be designed around

- **Primary locale is Persian/Farsi, RTL layout.** This isn't a toggle-able
  nice-to-have for the initial design — it's the default.
- Prices are in **Toman**, large numbers (millions), Persian digit/number
  formatting conventions should be considered.
- The core interaction is comparison, not browsing-for-discovery — design
  the game detail page's price table as the centerpiece.
- Every price row's primary action is an outbound link to the seller's own
  site — this should read clearly as "go compare/buy at the seller," not as
  an in-app checkout affordance.
- No auth required for the core experience.
- Data can be a few hours stale (periodic background refresh) — no need to
  design for real-time price ticking.
