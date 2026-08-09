-- Migration 018: rename GameXS-owned key-art storage naming to main background image.
--
-- This keeps the old key_art_url column, when present, for rollback/inspection,
-- but moves application reads to main_background_image_url. Keep existing
-- artwork URLs intact until the main-background-images prefix has been fully
-- populated in S3; rewriting now would create 404s for existing objects.

ALTER TABLE ps5_games
  ADD COLUMN IF NOT EXISTS main_background_image_url TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ps5_games'
      AND column_name = 'key_art_url'
  ) THEN
    UPDATE ps5_games
    SET main_background_image_url = key_art_url
    WHERE main_background_image_url IS NULL
      AND key_art_url IS NOT NULL;
  END IF;
END $$;
