-- Add fill-game.ir ("فیل گیم", a Laravel/Livewire shop) to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 039_add_fillgame_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('fillgame', 'فیل گیم', 'fill-game.ir')
ON CONFLICT (slug) DO NOTHING;
