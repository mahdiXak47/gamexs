-- Migration 026: explicit aliases for seller-to-catalog game matching.
--
-- Seller titles are not stable catalog identifiers (for example, sellers call
-- "EA Sports FC 27" simply "FC 27").  Imported IGDB games populate this table
-- and load_to_postgres checks it before falling back to slug matching.

CREATE TABLE IF NOT EXISTS ps5_game_aliases (
    id              SERIAL PRIMARY KEY,
    platform_id     SMALLINT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    game_id         INTEGER NOT NULL REFERENCES ps5_games(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT 'igdb',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS ps5_game_aliases_game_id_idx
    ON ps5_game_aliases (game_id);
