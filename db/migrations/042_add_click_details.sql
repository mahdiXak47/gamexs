-- Migration 042: per-click details for the admin click log.
-- ip_address / user_agent: who clicked (personal data — cleared after 90 days
-- by gamexs_scraper.maintenance). user_id: the GameXS account if the visitor
-- was logged in; reported by the visitor's browser after the redirect page
-- loads (the login cookie belongs to api.gamexs.ir), so it is self-reported
-- and fine for analytics, never for billing. claim_token lets only the page
-- that created the click attach that user, once, within 10 minutes.

ALTER TABLE outbound_clicks
    ADD COLUMN IF NOT EXISTS ip_address INET,
    ADD COLUMN IF NOT EXISTS user_agent TEXT,
    ADD COLUMN IF NOT EXISTS user_id INTEGER,
    ADD COLUMN IF NOT EXISTS claim_token UUID;
