-- Migration 034: one row per customer redirected to a seller ("خرید از فروشگاه").
-- Written by the frontend's /go/[listingId] page; read by the admin referrals report.
-- Game, seller and offer are denormalised so the report survives listing cleanup.
-- No raw IP is stored: visitor_hash = sha256(ip + user agent + day + salt).

BEGIN;

CREATE TABLE IF NOT EXISTS outbound_clicks (
    id           BIGSERIAL PRIMARY KEY,
    listing_id   INT REFERENCES listings (id) ON DELETE SET NULL,
    game_id      INT NOT NULL REFERENCES ps5_games (id) ON DELETE CASCADE,
    seller_id    INT NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    product_type product_type NOT NULL,
    tier         access_tier,
    price_toman  BIGINT,
    visitor_hash TEXT NOT NULL,
    referrer     TEXT,
    clicked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_seller_time ON outbound_clicks (seller_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_game_time ON outbound_clicks (game_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_time ON outbound_clicks (clicked_at DESC);

COMMIT;
