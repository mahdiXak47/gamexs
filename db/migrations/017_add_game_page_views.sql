-- Migration 017: game detail page view tracking.
--
-- Run against an existing volume:
-- psql -U gamexs -d gamexs -f 017_add_game_page_views.sql
--
-- Safe to re-run: uses IF NOT EXISTS throughout.

CREATE TABLE IF NOT EXISTS game_page_view_stats (
    game_id INT PRIMARY KEY REFERENCES ps5_games (id) ON DELETE CASCADE,
    total_views BIGINT NOT NULL DEFAULT 0,
    unique_daily_views BIGINT NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS game_page_view_daily (
    game_id INT NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
    viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    total_views BIGINT NOT NULL DEFAULT 0,
    unique_views BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, viewed_on)
);

CREATE TABLE IF NOT EXISTS game_page_view_uniques (
    game_id INT NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
    viewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
    visitor_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (game_id, viewed_on, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_game_page_view_daily_viewed_on
    ON game_page_view_daily (viewed_on DESC);

CREATE INDEX IF NOT EXISTS idx_game_page_view_uniques_created_at
    ON game_page_view_uniques (created_at);
