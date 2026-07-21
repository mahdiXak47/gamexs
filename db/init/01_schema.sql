-- GameXS schema: game catalog + per-seller listings + append-only price
-- history. Runs automatically on first container init (empty data dir) via
-- docker-entrypoint-initdb.d.

CREATE TYPE product_type AS ENUM ('ACCOUNT_GAME', 'OWN_ACCOUNT_GAME', 'DISC');
CREATE TYPE access_tier AS ENUM ('CAPACITY_1', 'CAPACITY_2', 'CAPACITY_3');

CREATE TABLE platforms (
    id SMALLSERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE sellers (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    platform_id SMALLINT NOT NULL REFERENCES platforms (id),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    genre_label TEXT,
    publisher TEXT,
    release_year SMALLINT,
    release_date DATE,
    cover_url TEXT,
    igdb_id INTEGER,
    screenshot_ids TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_id, slug)
);

-- One row per (game, seller, product type, tier) ever seen — the identity of
-- a trackable offer. Prices live in price_history; this table just answers
-- "does this offer exist" and "is it still listed by the seller".
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seller_id INT NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    product_type product_type NOT NULL,
    tier access_tier,
    source_url TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tier_only_for_account_game CHECK (
        (product_type = 'ACCOUNT_GAME' AND tier IS NOT NULL)
        OR (product_type <> 'ACCOUNT_GAME' AND tier IS NULL)
    ),
    UNIQUE (seller_id, source_url)
);

CREATE INDEX idx_listings_game ON listings (game_id);

-- Append-only: one row per scrape per listing, never updated in place, so
-- charting a price over time is just a range query on scraped_at.
CREATE TABLE price_history (
    id BIGSERIAL PRIMARY KEY,
    listing_id INT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
    price_toman INT NOT NULL,
    in_stock BOOLEAN NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Lets a loader re-run the same scrape/cache file safely (ON CONFLICT DO
    -- NOTHING) instead of piling up duplicate rows for one listing+timestamp.
    UNIQUE (listing_id, scraped_at)
);

CREATE INDEX idx_price_history_listing_scraped ON price_history (listing_id, scraped_at DESC);
