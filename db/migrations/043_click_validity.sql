-- Migration 043: click validity for CPC billing (backend/apps/billing).
-- Validity is whether a click is a real customer; whether it is charged (free,
-- discounted, over the spending cap) lives in billing_clickcharge. Written by
-- `manage.py classify_clicks` and invoice drafting; reviewed_by is the staff
-- user who confirmed or cleared a click by hand (classification keeps it).
BEGIN;
ALTER TABLE outbound_clicks
    ADD COLUMN IF NOT EXISTS validity TEXT NOT NULL DEFAULT 'pending'
        CHECK (validity IN ('pending', 'valid', 'duplicate', 'suspicious', 'invalid', 'unverifiable')),
    ADD COLUMN IF NOT EXISTS validity_reason TEXT,
    ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by INTEGER;
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_seller_validity ON outbound_clicks (seller_id, validity, clicked_at);
COMMIT;
