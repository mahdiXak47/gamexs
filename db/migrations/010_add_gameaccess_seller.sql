-- Add gameaccess.ir to the sellers table.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 010_add_gameaccess_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('gameaccess', 'گیم اکسس', 'gameaccess.ir')
ON CONFLICT (slug) DO NOTHING;
