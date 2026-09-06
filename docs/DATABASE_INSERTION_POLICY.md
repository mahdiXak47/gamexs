# GameXS Canonical Game Insertion Policy

This is the mandatory policy for inserting or updating GameXS catalog and
seller-price data. It applies to local and production databases, all seller
adapters, Crawl4AI extractors, one-off imports, and automated runners.

## Non-negotiable invariants

1. `ps5_games.title` is always the canonical English game title.
2. `ps5_games.title` must contain no Persian words or Persian/Arabic Unicode
   letters.
3. Every `ps5_games` row must have a real, verified `igdb_id`.
4. `igdb_id` is the canonical game identity and is unique.
5. A seller's raw title is never used as the final catalog title.
6. A new game row is inserted only after IGDB resolution. Seller prices are
   appended only after the canonical game row has been found or created.
7. Capacity, account type, disc, platform, stock, term, and seller differences
   create offer/listing or price-history data; they must not create duplicate
   `ps5_games` rows.

The table called “games” in older notes is `ps5_games` in the actual schema.

## Required insertion flow

```text
raw seller offer
       |
       v
clean_title / normalize_game_name
       |
       v
English-only and PS5 validation
       |
       v
IGDB search and confident canonical match
       |
       +--> existing igdb_id/alias -> reuse game_id
       |
       +--> no existing row -> insert canonical English title + igdb_id
       |
       v
upsert listing for product type/tier/source URL
       |
       v
append price_history observation
```

If any gate fails, reject the offer. Never insert a provisional catalog row
just to preserve its price.

## Step 1: normalize the seller title

Use the shared normalization implementation:

```text
scraper/gamexs_scraper/normalize.py
    clean_title()
    normalize_game_name()
```

The normalizer removes seller boilerplate and product qualifiers such as
`خرید`, `بازی`, `اکانت`, `اکانت ظرفیتی`, `PS4`, `PS5`, and related platform
suffixes. It also normalizes digits and known Persian edition words.

Normalization is a lookup aid, not proof that two titles are the same game.
It is currently documented in the code as a same-seller heuristic. The final
identity decision must use an IGDB ID or an explicit verified alias.

After normalization, reject the candidate if:

- it is empty or only boilerplate;
- it still contains Persian/Arabic letters;
- it is PS4-only rather than PS5 or cross-generation;
- it is clearly a non-game product, gift card, accessory, or subscription;
- it is an edition/platform string that cannot be mapped confidently.

Example:

```text
raw:        Assassin's Creed Valhalla PS4 و
candidate:  Assassin's Creed Valhalla
```

This raw seller title must not become a new game row. If the offer is PS4-only,
reject the offer. If it is a PS4/PS5 product, resolve the candidate through
IGDB and attach its price to the existing canonical PS5 game when matched.

## Step 2: resolve through IGDB

Search IGDB using the cleaned English candidate and require a confident PS5
match. The existing enrichment implementation is the reference for search
cleanup and scoring:

```text
scraper/gamexs_scraper/enrich_metadata.py
    _search_title()
    _search_title_direct()
    _MIN_SCORE
```

The accepted result must provide:

- a real IGDB numeric ID;
- an English canonical name;
- PS5 support or a valid PS4/PS5 cross-generation result;
- a confident match with no unresolved title collision.

If multiple IGDB results are plausible, do not guess. Reject the offer for
manual review or resolve it with the existing catalog/import tooling.

The display title saved to `ps5_games.title` comes from the verified English
IGDB result, not from the Persian seller page. Validate the title before the
insert even when it came from IGDB.

## Step 3: find or create the canonical game

Use this order:

1. Look up the exact `igdb_id` in `ps5_games`.
2. If absent, look up a verified normalized alias in `ps5_game_aliases` and
   confirm that the alias points to the same IGDB-backed game.
3. If no row exists, insert one row using the IGDB canonical English title,
   canonical slug, platform, metadata, and non-null `igdb_id`.
4. If the normalized title conflicts with an existing different IGDB ID,
   stop and require manual review.

Never create a new row using only `raw_title`, a seller URL, or a normalized
seller string. Never use a fake, placeholder, zero, or guessed IGDB ID.

## Step 4: append the seller price

Once `game_id` is known, append the offer to the existing game:

- upsert `listings` using seller, source URL, product type, and tier;
- insert the observation into `price_history`;
- preserve the seller source URL;
- keep price history append-only;
- do not update the catalog title from the seller title.

GameXS product mapping:

| Seller offer | `listings.product_type` | `listings.tier` |
|---|---|---|
| Account capacity 1/2/3 | `ACCOUNT_GAME` | `CAPACITY_1/2/3` |
| Full capacity | `OWN_ACCOUNT_GAME` | `NULL` |
| Physical disc | `DISC` | `NULL` |

PS Plus offers belong in `ps_plus` and `ps_plus_price_history`, not in
`ps5_games` or ordinary `listings`.

## Invalid insertion examples

These are rejected, not inserted as games:

```text
اکانت ظرفیتی Assassin's Creed Valhalla ظرفیت ۳
خرید بازی Assassin's Creed Valhalla برای PS5
Assassin's Creed Valhalla PS4 و
007 First Light (seller spelling with no IGDB match)
```

They may become valid offer records only after normalization, PS5 filtering,
and a confident IGDB match. Their raw text may remain in an offer/cache for
diagnostics, but it must never become `ps5_games.title`.

## Database preflight checks

Run these checks before and after a catalog import on both databases:

```sql
SELECT
    COUNT(*) AS total_games,
    COUNT(*) FILTER (WHERE igdb_id IS NULL) AS missing_igdb_id,
    COUNT(*) FILTER (WHERE title ~ '[^[:ascii:]]') AS non_ascii_titles
FROM ps5_games;
```

```sql
SELECT id, title, slug, igdb_id
FROM ps5_games
WHERE igdb_id IS NULL
   OR title ~ '[^[:ascii:]]'
ORDER BY id
LIMIT 100;
```

The target state is zero rows from the second query. Do not proceed with a
production seller load while invalid catalog rows remain unresolved.

## Repairing existing invalid rows

Repair is a separate, reviewed operation:

1. Back up the database.
2. Export all rows with NULL `igdb_id`, Persian/non-ASCII titles, or duplicate
   normalized identities.
3. Resolve each row through IGDB and record the canonical ID.
4. Merge duplicate rows by reassigning listings, price history, and aliases to
   the canonical game; preserve history and source URLs.
5. Delete only an empty duplicate row after its references are safely moved.
6. Re-run the preflight queries.
7. Enforce `igdb_id NOT NULL` after the data is clean.

Do not repair by copying a seller title into the catalog or by assigning an
arbitrary IGDB ID.

## Current implementation

The generic loader now fails closed: it refuses to create a `ps5_games` row
from seller text and refuses to load a seller snapshot while invalid catalog
rows remain. For a cache containing new titles, use the IGDB-first importer
(`scraper/import_uperagame_catalog.py`) or the explicit IGDB import tooling.
For existing NULL/non-ASCII rows, the targeted repair command is
`python -m gamexs_scraper.enrich_metadata --repair-invalid`; review its dry
run and separately resolve any PS4-only rows that it intentionally excludes.
The deterministic duplicate merger is
`scraper/repair_invalid_catalog.py`; it only maps an invalid row to an
existing canonical IGDB row and preserves listing/history references.

Migration 028 was introduced to allow unenriched rows, but that is a legacy
compatibility state and contradicts this policy. It must not be treated as
permission to insert new NULL-IGDB games. Migration
`029_enforce_igdb_catalog_invariants.sql` restores the final `igdb_id NOT NULL`
state and adds the database-level English-title check after existing invalid
rows are repaired.

## Context rule for future database work

Before any agent or operator inserts catalog or seller data, it must read this
document and answer:

1. What is the canonical English title?
2. What is the verified IGDB ID?
3. Does that IGDB ID or a verified alias already exist in `ps5_games`?
4. Is this only a new listing/price variant of an existing game?
5. Does the offer pass PS5, product-type, and stock validation?

If the answer to the first three questions is not known, no database insert is
allowed.
