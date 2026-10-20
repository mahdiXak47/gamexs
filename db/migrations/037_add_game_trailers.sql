-- Migration 037: one self-hosted trailer per game (scraper/fetch_trailers.py).
-- trailer_url is our S3 copy (720p H.264); trailer_source_url is the PlayStation
-- Store original it was transcoded from, used to skip unchanged trailers.

ALTER TABLE ps5_games
    ADD COLUMN IF NOT EXISTS trailer_url TEXT,
    ADD COLUMN IF NOT EXISTS trailer_source_url TEXT,
    ADD COLUMN IF NOT EXISTS trailer_updated_at TIMESTAMPTZ;
