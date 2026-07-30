-- Add dragon-shop.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 007_add_dragonshop_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('dragonshop', 'دراگون شاپ', 'dragon-shop.ir')
ON CONFLICT (slug) DO NOTHING;
