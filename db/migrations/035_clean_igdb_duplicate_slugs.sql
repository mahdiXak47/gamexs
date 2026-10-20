-- Migration 035: move games off IGDB's "--N" duplicate slugs (e.g. until-dawn--1)
-- onto the clean slug when it is free. The old slug becomes a ps5_game_slug_aliases
-- row, so /games/<old> answers with a permanent redirect (games/[slug]/layout.tsx).
--
-- Cover and background file names on S3 are derived from the slug; where the row
-- does not already store an S3 URL, pin it to the old file name so images keep
-- working. Stored S3 URLs are rebased onto the configured endpoint by the frontend,
-- so the host written here does not matter. Idempotent: re-running finds nothing.

BEGIN;

CREATE TEMP TABLE slug_moves ON COMMIT DROP AS
SELECT g.id, g.slug AS old_slug, regexp_replace(g.slug, '--[0-9]+$', '') AS new_slug
FROM ps5_games g
WHERE g.slug ~ '--[0-9]+$'
  AND NOT EXISTS (SELECT 1 FROM ps5_games b WHERE b.slug = regexp_replace(g.slug, '--[0-9]+$', ''))
  AND NOT EXISTS (SELECT 1 FROM ps5_game_slug_aliases a WHERE a.slug = regexp_replace(g.slug, '--[0-9]+$', ''))
  AND NOT EXISTS (SELECT 1 FROM ps5_game_slug_aliases a WHERE a.slug = g.slug AND a.game_id <> g.id);

-- Two "--N" rows could collapse to the same clean slug; keep the lowest id only.
DELETE FROM slug_moves m
WHERE EXISTS (SELECT 1 FROM slug_moves o WHERE o.new_slug = m.new_slug AND o.id < m.id);

INSERT INTO ps5_game_slug_aliases (game_id, slug)
SELECT id, old_slug FROM slug_moves
ON CONFLICT (slug) DO NOTHING;

UPDATE ps5_games g
SET slug = m.new_slug,
    cover_url = CASE WHEN g.cover_url LIKE '%/gamexs/covers/%' THEN g.cover_url
                     ELSE 'https://mahdixak-spwnu.hs3.ir/gamexs/covers/' || m.old_slug || '-main-cover.webp' END,
    main_background_image_url = CASE WHEN g.main_background_image_url LIKE '%/gamexs/%' THEN g.main_background_image_url
                     ELSE 'https://mahdixak-spwnu.hs3.ir/gamexs/artworks/' || m.old_slug || '-key-art.webp' END
FROM slug_moves m
WHERE g.id = m.id;

SELECT count(*) AS moved FROM slug_moves;

COMMIT;
