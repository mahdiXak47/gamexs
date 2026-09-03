-- Migration 027: register Upera Game and support duration-specific PS Plus offers.
-- Run against an existing database after migrations 002 and the base schema:
--   psql -U gamexs -d gamexs -f 027_add_uperagame_support.sql

BEGIN;

INSERT INTO sellers (slug, name, domain)
VALUES ('uperagame', 'آپرا گیم', 'uperagame.com')
ON CONFLICT (slug) DO NOTHING;

-- A seller product URL can expose multiple game capacities. The old constraint
-- allowed only one listing per seller URL, while the loader identity includes
-- product type and tier.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'listings'::regclass
          AND conname = 'listings_seller_id_source_url_key'
    ) THEN
        ALTER TABLE listings DROP CONSTRAINT listings_seller_id_source_url_key;
    END IF;
    -- The fresh schema may expose this identity as a unique index rather than
    -- a named pg_constraint.  to_regclass() handles both representations.
    IF to_regclass('public.listings_seller_source_type_tier_key') IS NULL THEN
        ALTER TABLE listings
          ADD CONSTRAINT listings_seller_source_type_tier_key
          UNIQUE (seller_id, source_url, product_type, tier);
    END IF;
END $$;

-- PS Plus products can have multiple terms (for example 3 months and 1 year)
-- for the same tier and account capacity.
ALTER TABLE ps_plus
  ADD COLUMN IF NOT EXISTS term TEXT NOT NULL DEFAULT 'unspecified';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'ps_plus'::regclass
          AND conname = 'ps_plus_tier_seller_id_capacity_key'
    ) THEN
        ALTER TABLE ps_plus DROP CONSTRAINT ps_plus_tier_seller_id_capacity_key;
    END IF;
    IF to_regclass('public.ps_plus_tier_seller_capacity_term_key') IS NULL THEN
        ALTER TABLE ps_plus
          ADD CONSTRAINT ps_plus_tier_seller_capacity_term_key
          UNIQUE (tier, seller_id, capacity, term);
    END IF;
END $$;

COMMIT;
