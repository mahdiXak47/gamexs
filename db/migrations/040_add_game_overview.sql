-- Migration 040: structured Persian editorial overview per game.
--
-- overview is GameXS-written copy for the «توضیحات» tab, stored as JSON so the
-- text can interleave the game's own media by key instead of embedding HTML:
--   {"intro": "...", "suits": ["..."],
--    "sections": [{"heading": "...", "paragraphs": ["..."], "media": "trailer" | "screenshot:N"}]}
-- "screenshot:N" is the 1-based position in screenshot_ids (our S3 copies);
-- "trailer" is trailer_url. Media that does not exist for a game is skipped at
-- render time. Content lives in db/content/game_overviews.sql (re-runnable).
-- The older plain-text description column stays as the fallback.

ALTER TABLE ps5_games
    ADD COLUMN IF NOT EXISTS overview JSONB;
