-- Migration 025: add editorial game-list membership and hero ordering.

ALTER TABLE ps5_games
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_newest BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_position SMALLINT,
  ADD COLUMN IF NOT EXISTS preorder_hero_position SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ps5_games_hero_position_range'
      AND conrelid = 'ps5_games'::regclass
  ) THEN
    ALTER TABLE ps5_games
      ADD CONSTRAINT ps5_games_hero_position_range
      CHECK (hero_position IS NULL OR hero_position BETWEEN 1 AND 6);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ps5_games_preorder_hero_position_range'
      AND conrelid = 'ps5_games'::regclass
  ) THEN
    ALTER TABLE ps5_games
      ADD CONSTRAINT ps5_games_preorder_hero_position_range
      CHECK (preorder_hero_position IS NULL OR preorder_hero_position BETWEEN 1 AND 6);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ps5_games_hero_position_key
  ON ps5_games (hero_position)
  WHERE hero_position IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ps5_games_preorder_hero_position_key
  ON ps5_games (preorder_hero_position)
  WHERE preorder_hero_position IS NOT NULL;

-- Preserve the existing homepage's approximate ranking until staff curate the
-- selections in Django admin. Catalog popularity sorting remains unchanged.
WITH ranked AS (
  SELECT
    g.id,
    ROW_NUMBER() OVER (
      ORDER BY COUNT(DISTINCT l.seller_id) DESC, g.created_at DESC, g.title ASC
    ) AS position
  FROM ps5_games g
  JOIN listings l ON l.game_id = g.id AND l.is_active
  WHERE g.platform_id = (SELECT id FROM platforms WHERE slug = 'ps5')
  GROUP BY g.id
)
UPDATE ps5_games g
SET is_popular = ranked.position <= 10,
    hero_position = CASE
      WHEN ranked.position <= 6 THEN ranked.position::smallint
      ELSE NULL
    END
FROM ranked
WHERE g.id = ranked.id
  AND NOT EXISTS (
    SELECT 1
    FROM ps5_games existing
    WHERE existing.is_popular OR existing.hero_position IS NOT NULL
  );

-- Preserve the existing preorder hero choices, in their previous order.
WITH selected(slug, position) AS (
  VALUES
    ('grand-theft-auto-vi', 1),
    ('marvels-wolverine', 2),
    ('halo-campaign-evolved', 3),
    ('control-resonant', 4),
    ('call-of-duty-modern-warfare-4', 5)
)
UPDATE ps5_games g
SET preorder_hero_position = selected.position
FROM selected
WHERE g.slug = selected.slug
  AND g.release_date > CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1
    FROM ps5_games existing
    WHERE existing.preorder_hero_position IS NOT NULL
  );
