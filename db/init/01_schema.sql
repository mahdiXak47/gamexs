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

CREATE TABLE ps5_games (
    id SERIAL PRIMARY KEY,
    platform_id SMALLINT NOT NULL REFERENCES platforms (id),
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    genre_label TEXT,
    publisher TEXT,
    release_year SMALLINT,
    release_date DATE,
    cover_url TEXT,
    main_background_image_url TEXT,
    description TEXT,
    -- New seller listings may be loaded before IGDB enrichment runs.
    igdb_id INTEGER UNIQUE,
    screenshot_ids TEXT[],
    concept_id TEXT,
    edition_name TEXT,
    store_display_classification TEXT,
    price_source TEXT,
    is_popular BOOLEAN NOT NULL DEFAULT false,
    is_newest BOOLEAN NOT NULL DEFAULT false,
    hero_position SMALLINT,
    preorder_hero_position SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ps5_games_hero_position_range CHECK (hero_position IS NULL OR hero_position BETWEEN 1 AND 6),
    CONSTRAINT ps5_games_preorder_hero_position_range CHECK (
        preorder_hero_position IS NULL OR preorder_hero_position BETWEEN 1 AND 6
    ),
    UNIQUE (platform_id, slug)
);

CREATE UNIQUE INDEX ps5_games_hero_position_key
    ON ps5_games (hero_position)
    WHERE hero_position IS NOT NULL;

CREATE UNIQUE INDEX ps5_games_preorder_hero_position_key
    ON ps5_games (preorder_hero_position)
    WHERE preorder_hero_position IS NOT NULL;

-- One row per game per region's PS Store price + product URL. Region-specific
-- because a single game can have different PS Store product URLs per region
-- (e.g. EU uses EP0002-..., US uses UP0002-...). Region-agnostic PS Store
-- metadata (concept_id, edition_name, store_display_classification,
-- price_source) lives on ps5_games.
CREATE TABLE ps5_game_tr_info (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES ps5_games (id) ON DELETE SET NULL,
    product_id TEXT,
    ps_store_url TEXT,
    price TEXT,
    original_price TEXT,
    discount_pct TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id)
);
CREATE UNIQUE INDEX ps5_game_tr_info_product_id_key
    ON ps5_game_tr_info (product_id)
    WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX ps5_game_tr_info_concept_fallback_key
    ON ps5_game_tr_info (game_id)
    WHERE product_id IS NULL;
CREATE INDEX ps5_game_tr_info_game_id_idx ON ps5_game_tr_info (game_id);

CREATE TABLE ps5_game_us_info (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES ps5_games (id) ON DELETE SET NULL,
    product_id TEXT,
    ps_store_url TEXT,
    price TEXT,
    original_price TEXT,
    discount_pct TEXT,
    essential_plus_included BOOLEAN NOT NULL DEFAULT false,
    extra_plus_included BOOLEAN NOT NULL DEFAULT false,
    deluxe_plus_included BOOLEAN NOT NULL DEFAULT false,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id)
);
CREATE UNIQUE INDEX ps5_game_us_info_unique_key
    ON ps5_game_us_info (product_id)
    WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX ps5_game_us_info_concept_fallback_key
    ON ps5_game_us_info (game_id)
    WHERE product_id IS NULL;
CREATE INDEX ps5_game_us_info_game_id_idx ON ps5_game_us_info (game_id);

-- One row per (game, seller, product type, tier) ever seen — the identity of
-- a trackable offer. Prices live in price_history; this table just answers
-- "does this offer exist" and "is it still listed by the seller".
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    game_id INT NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
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
    UNIQUE (seller_id, source_url, product_type, tier)
);

CREATE INDEX idx_listings_game ON listings (game_id);

-- Explicit seller-title aliases populated by the IGDB game importer.  This
-- lets short seller names such as "FC 27" resolve to the canonical
-- "EA Sports FC 27" row instead of creating a duplicate game.
CREATE TABLE ps5_game_aliases (
    id              SERIAL PRIMARY KEY,
    platform_id     SMALLINT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    game_id         INTEGER NOT NULL REFERENCES ps5_games(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'igdb',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_id, normalized_name)
);

CREATE INDEX idx_ps5_game_aliases_game_id ON ps5_game_aliases (game_id);

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

-- Aggregated game detail page views. `total_views` increments for accepted
-- visits; `unique_daily_views` increments at most once per anonymous visitor
-- per game per day via game_page_view_uniques.
CREATE TABLE game_page_view_stats (
    game_id INT PRIMARY KEY REFERENCES ps5_games (id) ON DELETE CASCADE,
    total_views BIGINT NOT NULL DEFAULT 0,
    unique_daily_views BIGINT NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ
);

CREATE TABLE game_page_view_daily (
    game_id INT NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
    viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    total_views BIGINT NOT NULL DEFAULT 0,
    unique_views BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, viewed_on)
);

CREATE TABLE game_page_view_uniques (
    game_id INT NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
    viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    visitor_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, viewed_on, visitor_hash)
);

CREATE INDEX idx_game_page_view_daily_viewed_on ON game_page_view_daily (viewed_on DESC);
CREATE INDEX idx_game_page_view_uniques_created_at ON game_page_view_uniques (created_at);

-- One row per submitted Core Web Vitals metric (self-hosted analytics sink,
-- fed by the frontend's /api/web-vitals route). Append-only.
CREATE TABLE web_vitals (
    id BIGSERIAL PRIMARY KEY,
    metric_id TEXT NOT NULL,
    name TEXT NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    delta DOUBLE PRECISION,
    rating TEXT,
    navigation_type TEXT,
    path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_vitals_created_at ON web_vitals (created_at);
CREATE INDEX idx_web_vitals_name ON web_vitals (name);

-- Anonymous first-party pageview analytics. No cookies, user identifiers, or
-- query strings are stored; this is intentionally a minimal privacy-friendly
-- alternative to third-party analytics.
CREATE TABLE site_page_views (
    id BIGSERIAL PRIMARY KEY,
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_page_views_created_at ON site_page_views (created_at DESC);
CREATE INDEX idx_site_page_views_path_created_at ON site_page_views (path, created_at DESC);
