-- Allow PS Store edition/SKU rows to share one concept_id.
-- PS Store concept_id identifies the game family; product_id identifies a
-- specific purchasable edition such as Standard or Deluxe.

ALTER TABLE ps5_store_info
    ADD COLUMN IF NOT EXISTS product_id TEXT,
    ADD COLUMN IF NOT EXISTS ps_store_url TEXT,
    ADD COLUMN IF NOT EXISTS edition_name TEXT,
    ADD COLUMN IF NOT EXISTS store_display_classification TEXT,
    ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT 'concept';

ALTER TABLE ps5_store_info
    DROP CONSTRAINT IF EXISTS ps5_store_info_concept_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS ps5_store_info_product_id_key
    ON ps5_store_info (product_id)
    WHERE product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ps5_store_info_concept_fallback_key
    ON ps5_store_info (concept_id)
    WHERE product_id IS NULL;
