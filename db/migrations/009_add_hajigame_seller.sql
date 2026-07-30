-- Add hajigame.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 009_add_hajigame_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('hajigame', 'حاجی گیم', 'hajigame.ir')
ON CONFLICT (slug) DO NOTHING;
