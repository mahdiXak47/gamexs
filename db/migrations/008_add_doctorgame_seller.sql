-- Add doctor-game.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 008_add_doctorgame_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('doctorgame', 'دکتر گیم', 'doctor-game.ir')
ON CONFLICT (slug) DO NOTHING;
