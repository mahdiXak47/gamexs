-- Migration 004: store raw IGDB canonical name alongside the display title.
--
-- After this column exists, enrich_metadata.py writes the IGDB canonical name
-- here and derives games.title / games.slug from it, replacing the seller-page
-- titles that were used as a placeholder before a canonical match was found.
--
-- Safe to run against a live database (ADD COLUMN IF NOT EXISTS is non-blocking
-- on Postgres 16 when the column has no default and allows NULL).

ALTER TABLE games ADD COLUMN IF NOT EXISTS igdb_name TEXT;
