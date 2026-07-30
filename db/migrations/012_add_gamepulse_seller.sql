-- Add game-pulse.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 012_add_gamepulse_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('gamepulse', 'گیم پالس', 'game-pulse.ir')
ON CONFLICT (slug) DO NOTHING;
