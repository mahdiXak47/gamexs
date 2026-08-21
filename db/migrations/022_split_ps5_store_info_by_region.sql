-- Migration 022: split ps5_store_info into per-region tables.
--
-- ps5_store_info held both US and TR prices in one row, but a single game can
-- have DIFFERENT PS Store product URLs per region (e.g. EU/TR uses EP0002-...,
-- US uses UP0002-...). We split it into:
--
--   ps5_game_tr_info  — Turkey (tr-tr) region price + product URL
--   ps5_game_us_info  — US (en-us) region price + product URL + PS Plus tiers
--
-- Columns that describe the game family / edition (region-agnostic) move up to
-- ps5_games: concept_id, edition_name, store_display_classification,
-- price_source.
--
-- Only the single most-useful store row per game is migrated (the same row the
-- frontend's getGameStoreInfo() would have picked: product_id over concept,
-- priced over unpriced, newest fetched_at first). 45 rows with NULL game_id and
-- one duplicate concept row are therefore not migrated.
--
-- Uses a session-scoped temp table to reuse the "best row per game" selection
-- across multiple statements (a CTE is scoped to a single statement only).

-- 1) Region-agnostic PS Store metadata columns on ps5_games.
ALTER TABLE ps5_games
    ADD COLUMN IF NOT EXISTS concept_id TEXT,
    ADD COLUMN IF NOT EXISTS edition_name TEXT,
    ADD COLUMN IF NOT EXISTS store_display_classification TEXT,
    ADD COLUMN IF NOT EXISTS price_source TEXT;

-- 2) Per-region tables.
CREATE TABLE IF NOT EXISTS ps5_game_tr_info (
    id           SERIAL PRIMARY KEY,
    game_id      INTEGER     REFERENCES ps5_games(id) ON DELETE SET NULL,
    product_id   TEXT,
    ps_store_url TEXT,
    price        TEXT,
    original_price TEXT,
    discount_pct TEXT,
    fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ps5_game_us_info (
    id            SERIAL PRIMARY KEY,
    game_id       INTEGER     REFERENCES ps5_games(id) ON DELETE SET NULL,
    product_id    TEXT,
    ps_store_url  TEXT,
    price         TEXT,
    original_price TEXT,
    discount_pct  TEXT,
    essential_plus_included BOOLEAN NOT NULL DEFAULT FALSE,
    extra_plus_included     BOOLEAN NOT NULL DEFAULT FALSE,
    deluxe_plus_included    BOOLEAN NOT NULL DEFAULT FALSE,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ps5_game_tr_info_game_id_idx ON ps5_game_tr_info (game_id);
CREATE INDEX IF NOT EXISTS ps5_game_us_info_game_id_idx ON ps5_game_us_info (game_id);
CREATE UNIQUE INDEX IF NOT EXISTS ps5_game_tr_info_product_id_key
    ON ps5_game_tr_info (product_id)
    WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ps5_game_tr_info_concept_fallback_key
    ON ps5_game_tr_info (game_id)
    WHERE product_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ps5_game_us_info_product_id_key
    ON ps5_game_us_info (product_id)
    WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ps5_game_us_info_concept_fallback_key
    ON ps5_game_us_info (game_id)
    WHERE product_id IS NULL;

-- 3) Snapshot the single best store row per game into a temp table.
CREATE TEMP TABLE ps5_store_best AS
    SELECT DISTINCT ON (game_id) game_id, concept_id, product_id,
           edition_name, store_display_classification, price_source,
           us_price, us_original_price, us_discount_pct,
           tr_price, tr_original_price, tr_discount_pct,
           essential_plus_included, extra_plus_included, deluxe_plus_included,
           fetched_at
    FROM ps5_store_info s
    WHERE s.game_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM ps5_games g WHERE g.id = s.game_id)
    ORDER BY s.game_id,
             (s.product_id IS NOT NULL) DESC,
             (s.us_price IS NOT NULL OR s.tr_price IS NOT NULL) DESC,
             s.fetched_at DESC;

-- 4) Populate common columns on ps5_games.
UPDATE ps5_games g
SET concept_id = b.concept_id,
    edition_name = b.edition_name,
    store_display_classification = b.store_display_classification,
    price_source = b.price_source
FROM ps5_store_best b
WHERE g.id = b.game_id;

-- 5) Migrate to per-region tables.
INSERT INTO ps5_game_tr_info (game_id, product_id, ps_store_url, price, original_price, discount_pct, fetched_at)
SELECT b.game_id, b.product_id,
       CASE WHEN b.product_id IS NOT NULL
            THEN 'https://store.playstation.com/tr-tr/product/' || b.product_id
            ELSE 'https://store.playstation.com/tr-tr/concept/' || b.concept_id END,
       b.tr_price, b.tr_original_price, b.tr_discount_pct, b.fetched_at
FROM ps5_store_best b;

INSERT INTO ps5_game_us_info (game_id, product_id, ps_store_url, price, original_price, discount_pct,
                              essential_plus_included, extra_plus_included, deluxe_plus_included, fetched_at)
SELECT b.game_id, b.product_id,
       CASE WHEN b.product_id IS NOT NULL
            THEN 'https://store.playstation.com/en-us/product/' || b.product_id
            ELSE 'https://store.playstation.com/en-us/concept/' || b.concept_id END,
       b.us_price, b.us_original_price, b.us_discount_pct,
       b.essential_plus_included, b.extra_plus_included, b.deluxe_plus_included, b.fetched_at
FROM ps5_store_best b;

DROP TABLE ps5_store_best;

-- 6) Remove the old combined table.
DROP TABLE IF EXISTS ps5_store_info;