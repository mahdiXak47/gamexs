-- PS Store price data fetched daily.
-- One row per PS Store product_id, or per concept_id when no product_id is known.
-- Upserted on each run, no history kept.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 014_add_ps5_store_info.sql

CREATE TABLE IF NOT EXISTS ps5_store_info (
    id                      SERIAL PRIMARY KEY,
    concept_id              TEXT        NOT NULL,
    product_id              TEXT,
    game_id                 INTEGER     REFERENCES ps5_games(id) ON DELETE SET NULL,
    ps_store_url            TEXT,
    edition_name            TEXT,
    store_display_classification TEXT,
    price_source            TEXT        NOT NULL DEFAULT 'concept',
    us_price                TEXT,
    us_original_price       TEXT,
    us_discount_pct         TEXT,
    tr_price                TEXT,
    tr_original_price       TEXT,
    tr_discount_pct         TEXT,
    essential_plus_included BOOLEAN     NOT NULL DEFAULT FALSE,
    extra_plus_included     BOOLEAN     NOT NULL DEFAULT FALSE,
    deluxe_plus_included    BOOLEAN     NOT NULL DEFAULT FALSE,
    fetched_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ps5_store_info_game_id_idx ON ps5_store_info (game_id);
CREATE UNIQUE INDEX IF NOT EXISTS ps5_store_info_product_id_key
    ON ps5_store_info (product_id)
    WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ps5_store_info_concept_fallback_key
    ON ps5_store_info (concept_id)
    WHERE product_id IS NULL;
