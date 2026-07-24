-- Migration 005: add rich IGDB detail columns to the games table.
--
-- All columns are nullable — existing rows keep NULL until enrich_metadata.py
-- re-runs and fills them in.  ADD COLUMN IF NOT EXISTS is safe on a live DB.

ALTER TABLE ps5_games
  ADD COLUMN IF NOT EXISTS storyline   TEXT,
  ADD COLUMN IF NOT EXISTS summary     TEXT,
  ADD COLUMN IF NOT EXISTS igdb_url    TEXT,
  ADD COLUMN IF NOT EXISTS genres      TEXT[],
  ADD COLUMN IF NOT EXISTS game_modes  TEXT[],
  ADD COLUMN IF NOT EXISTS platforms   TEXT[],
  ADD COLUMN IF NOT EXISTS franchises  TEXT[],
  ADD COLUMN IF NOT EXISTS collections TEXT[],
  ADD COLUMN IF NOT EXISTS developers  TEXT[];
