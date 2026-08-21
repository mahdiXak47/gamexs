-- Add the @PlayBox_Account Telegram channel as a seller.
-- Run against an existing volume: psql -U gamexs -d gamexs -f 021_add_playbox_seller.sql

INSERT INTO sellers (slug, name, domain)
VALUES ('playbox', 'پلی باکس', 't.me/PlayBox_Account')
ON CONFLICT (slug) DO NOTHING;
