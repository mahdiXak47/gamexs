-- Migration 031: preserve old game URLs when canonical slugs change.

BEGIN;

CREATE TABLE IF NOT EXISTS ps5_game_slug_aliases (
    id         SERIAL PRIMARY KEY,
    game_id    INTEGER NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
    slug       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ps5_game_slug_aliases_game_id_idx
    ON ps5_game_slug_aliases (game_id);

DO $$
DECLARE
    game_id INTEGER;
    owner_id INTEGER;
BEGIN
    SELECT id INTO game_id
      FROM ps5_games
     WHERE igdb_id = 5850;

    IF NOT FOUND THEN
        RAISE NOTICE 'IGDB 5850 row is absent; no GTA slug alias needed';
        RETURN;
    END IF;

    SELECT ps5_game_slug_aliases.game_id
      INTO owner_id
      FROM ps5_game_slug_aliases
     WHERE slug = 'grand-theft-auto-the-trilogy-the-definitive-edition';

    IF FOUND AND owner_id <> game_id THEN
        RAISE EXCEPTION
            'legacy GTA slug belongs to game id %, expected %', owner_id, game_id;
    END IF;

    INSERT INTO ps5_game_slug_aliases (game_id, slug)
    VALUES (game_id, 'grand-theft-auto-the-trilogy-the-definitive-edition')
    ON CONFLICT (slug) DO NOTHING;
END $$;

COMMIT;
