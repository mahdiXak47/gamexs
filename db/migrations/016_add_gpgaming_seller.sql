-- Add gpgaming.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 016_add_gpgaming_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('gpgaming', 'گیم پردایس', 'gpgaming.ir')
ON CONFLICT (slug) DO NOTHING;