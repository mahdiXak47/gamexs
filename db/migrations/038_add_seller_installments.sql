-- Installment (خرید اقساطی / BNPL) options per seller, written by scraper/detect_installments.py.
-- 'own' = the shop's own plan; the others are the providers digipay, snapppay, torobpay.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 038_add_seller_installments.sql

ALTER TABLE sellers
    ADD COLUMN IF NOT EXISTS installment_options TEXT[] NOT NULL DEFAULT '{}'
        CHECK (installment_options <@ ARRAY['own', 'digipay', 'snapppay', 'torobpay']),
    ADD COLUMN IF NOT EXISTS installment_checked_at TIMESTAMPTZ;
