-- Migration 002: extract PS Plus subscription rows out of games/listings
-- and into dedicated ps_plus + ps_plus_price_history tables.
--
-- Run against the live DB:
--   docker exec -i gamexs-postgres psql -U gamexs -d gamexs < db/migrations/002_extract_ps_plus.sql
--
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT DO NOTHING throughout.

BEGIN;

-- ── 1. Types ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE ps_plus_tier AS ENUM ('ESSENTIAL', 'EXTRA', 'PREMIUM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ps_plus (
    id          SERIAL PRIMARY KEY,
    tier        ps_plus_tier NOT NULL,
    seller_id   INT NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    capacity    access_tier NOT NULL,
    source_url  TEXT NOT NULL,
    cover_url   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tier, seller_id, capacity)
);

CREATE TABLE IF NOT EXISTS ps_plus_price_history (
    id          BIGSERIAL PRIMARY KEY,
    ps_plus_id  INT NOT NULL REFERENCES ps_plus (id) ON DELETE CASCADE,
    price_toman INT NOT NULL,
    in_stock    BOOLEAN NOT NULL,
    scraped_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ps_plus_id, scraped_at)
);

CREATE INDEX IF NOT EXISTS idx_ps_plus_price_history_scraped
    ON ps_plus_price_history (ps_plus_id, scraped_at DESC);

-- ── 3. Migrate ps_plus rows ───────────────────────────────────────────────────
-- Map the three game rows to the enum values and carry over cover_url.

WITH source AS (
    SELECT
        CASE
            WHEN g.title ILIKE '%essential%' THEN 'ESSENTIAL'::ps_plus_tier
            WHEN g.title ILIKE '%extra%'     THEN 'EXTRA'::ps_plus_tier
            WHEN g.title ILIKE '%premium%'   THEN 'PREMIUM'::ps_plus_tier
        END                     AS tier,
        l.seller_id,
        l.tier                  AS capacity,
        l.source_url,
        g.cover_url,
        l.is_active,
        l.first_seen_at,
        l.last_seen_at,
        l.id                    AS old_listing_id
    FROM games g
    JOIN listings l ON l.game_id = g.id
    WHERE g.title ILIKE '%playstation plus%'
       OR g.title ILIKE '%پلی استیشن پلاس%'
       OR g.title ILIKE '%پلاس اسنشیال%'
),
inserted AS (
    INSERT INTO ps_plus (tier, seller_id, capacity, source_url, cover_url,
                         is_active, first_seen_at, last_seen_at)
    SELECT tier, seller_id, capacity, source_url, cover_url,
           is_active, first_seen_at, last_seen_at
    FROM source
    WHERE tier IS NOT NULL
    ON CONFLICT (tier, seller_id, capacity) DO NOTHING
    RETURNING id, tier, seller_id, capacity
)
-- ── 4. Migrate price_history rows ─────────────────────────────────────────────
INSERT INTO ps_plus_price_history (ps_plus_id, price_toman, in_stock, scraped_at)
SELECT
    pp.id,
    ph.price_toman,
    ph.in_stock,
    ph.scraped_at
FROM source s
JOIN inserted pp
    ON pp.tier = s.tier
   AND pp.seller_id = s.seller_id
   AND pp.capacity = s.capacity
JOIN price_history ph ON ph.listing_id = s.old_listing_id
ON CONFLICT (ps_plus_id, scraped_at) DO NOTHING;

-- ── 5. Remove from games (cascades to listings + price_history) ───────────────

DELETE FROM games
WHERE title ILIKE '%playstation plus%'
   OR title ILIKE '%پلی استیشن پلاس%'
   OR title ILIKE '%پلاس اسنشیال%';

COMMIT;
