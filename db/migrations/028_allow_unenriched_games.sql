-- Migration 028: allow seller listings before IGDB enrichment.
--
-- The scraper inserts newly discovered games first, then enrich_metadata.py
-- resolves igdb_id asynchronously.  A nullable UNIQUE column still prevents
-- duplicate IGDB identities while allowing multiple pending rows.

ALTER TABLE ps5_games
  ALTER COLUMN igdb_id DROP NOT NULL;
