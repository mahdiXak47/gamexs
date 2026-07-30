-- Add clockstore1.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 011_add_clockstore1_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('clockstore1', 'کلاک استور', 'clockstore1.ir')
ON CONFLICT (slug) DO NOTHING;
