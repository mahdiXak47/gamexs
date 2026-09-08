-- Migration 030: correct the canonical title for the 2005 GTA trilogy.
--
-- IGDB 5850 is Grand Theft Auto: The Trilogy (2005).  The 2021 Definitive
-- Edition is a separate IGDB game (53070), so the old row must not be merged
-- with it.  This migration changes catalog metadata only; listings and price
-- history remain attached to the same game id.

BEGIN;

DO $$
DECLARE
    game_id INTEGER;
    current_title TEXT;
    current_slug TEXT;
BEGIN
    SELECT id, title, slug
      INTO game_id, current_title, current_slug
      FROM ps5_games
     WHERE igdb_id = 5850
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE NOTICE 'IGDB 5850 row is absent; no correction needed';
        RETURN;
    END IF;

    IF current_title = 'Grand Theft Auto: The Trilogy'
       AND current_slug = 'grand-theft-auto-the-trilogy' THEN
        RAISE NOTICE 'IGDB 5850 row is already corrected';
        RETURN;
    END IF;

    IF current_title <> 'Grand Theft Auto The Trilogy The Definitive Edition'
       OR current_slug <> 'grand-theft-auto-the-trilogy-the-definitive-edition' THEN
        RAISE EXCEPTION
            'unexpected IGDB 5850 row (title=%, slug=%); review manually before correcting',
            current_title, current_slug;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM ps5_games
         WHERE slug = 'grand-theft-auto-the-trilogy'
           AND id <> game_id
    ) THEN
        RAISE EXCEPTION
            'target slug grand-theft-auto-the-trilogy already belongs to another game';
    END IF;

    UPDATE ps5_games
       SET title = 'Grand Theft Auto: The Trilogy',
           slug = 'grand-theft-auto-the-trilogy'
     WHERE id = game_id;
END $$;

COMMIT;
