-- Migration 029: restore the canonical catalog invariants.
--
-- Migration 028 temporarily made igdb_id nullable so seller titles could be
-- inserted before enrichment. That workflow is retired: a seller cache must
-- resolve to an existing or newly imported IGDB game before its prices are
-- loaded. This migration is intentionally fail-closed; it will not silently
-- delete or rewrite bad catalog rows.

BEGIN;

DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*)
      INTO invalid_count
      FROM ps5_games
     WHERE igdb_id IS NULL
        OR title ~ '[^[:ascii:]]';

    IF invalid_count > 0 THEN
        RAISE EXCEPTION
            'cannot enforce catalog invariants: % ps5_games rows have a missing IGDB ID or non-English title; repair them first',
            invalid_count;
    END IF;

    ALTER TABLE ps5_games
      ALTER COLUMN igdb_id SET NOT NULL;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'ps5_games'::regclass
           AND conname = 'ps5_games_title_ascii_check'
    ) THEN
        ALTER TABLE ps5_games
          ADD CONSTRAINT ps5_games_title_ascii_check
          CHECK (title !~ '[^[:ascii:]]');
    END IF;
END $$;

COMMIT;
