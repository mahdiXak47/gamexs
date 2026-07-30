-- PS Store price data fetched daily.
-- One row per concept_id — upserted on each run, no history kept.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 014_add_ps5_store_info.sql

CREATE TABLE IF NOT EXISTS ps5_store_info (
    id                      SERIAL PRIMARY KEY,
    concept_id              TEXT        NOT NULL UNIQUE,
    game_id                 INTEGER     REFERENCES ps5_games(id) ON DELETE SET NULL,
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
