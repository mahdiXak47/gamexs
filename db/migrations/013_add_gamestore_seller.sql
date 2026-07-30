-- Add game-store.org to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 013_add_gamestore_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('gamestore', 'گیم استور', 'game-store.org')
ON CONFLICT (slug) DO NOTHING;
