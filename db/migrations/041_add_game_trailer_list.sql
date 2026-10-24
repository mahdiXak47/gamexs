-- Migration 041: every official trailer of a game, not only the featured one.
-- trailers = [{"url": "<our S3 mp4>", "source_url": "<PS Store mp4>", "title": "تریلر ۲" | null}, ...]
-- in display order. Filled by scraper/fetch_trailers.py --all-trailers for the
-- most popular games; trailer_url stays the featured trailer (fallback).

ALTER TABLE ps5_games ADD COLUMN IF NOT EXISTS trailers JSONB;
