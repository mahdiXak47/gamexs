-- Migration 023: remove Nintendo games from the catalog.
--
-- These titles are Nintendo-exclusive (Switch) games that accidentally made it
-- into the PS5 catalog — they are not available on PlayStation, so comparing
-- PS5 prices for them is meaningless. Listings and price history for them
-- cascade away; PS Store region rows (none exist) would be set NULL.
--
-- Super Mario Odyssey 64 (id 11766) is included even though its IGDB publisher
-- is "Kaze Emanuar" (a fan project) — it is a Mario title, not a real PS5 game.

DELETE FROM ps5_games
WHERE id IN (
    (SELECT id FROM ps5_games WHERE slug = 'animal-crossing-new-horizons'),
    (SELECT id FROM ps5_games WHERE slug = 'donkey-kong-bananza'),
    (SELECT id FROM ps5_games WHERE slug = 'mario-golf-super-rush'),
    (SELECT id FROM ps5_games WHERE slug = 'mario-vs-donkey-kong'),
    (SELECT id FROM ps5_games WHERE slug = 'nintendo-world-championships-nes-edition'),
    (SELECT id FROM ps5_games WHERE slug = 'paper-mario-the-origami-king'),
    (SELECT id FROM ps5_games WHERE slug = 'super-mario-odyssey-64'),
    (SELECT id FROM ps5_games WHERE slug = 'super-mario-party-jamboree')
);
-- 023b: also remove DLC / add-on / pack-only titles (no prices, no store rows).

DELETE FROM ps5_games
WHERE id IN (
  (SELECT id FROM ps5_games WHERE slug='assassins-creed-mirage-master-assassin-pack'),
  (SELECT id FROM ps5_games WHERE slug='assetto-corsa-competizione--1'),
  (SELECT id FROM ps5_games WHERE slug='atelier-yumia-swimsuit-set'),
  (SELECT id FROM ps5_games WHERE slug='batman-arkham-knight-batman-inc-skin'),
  (SELECT id FROM ps5_games WHERE slug='diablo-iv-vessel-of-hatred'),
  (SELECT id FROM ps5_games WHERE slug='poppy-playtime-triple-pack'),
  (SELECT id FROM ps5_games WHERE slug='resident-evil-triple-pack'),
  (SELECT id FROM ps5_games WHERE slug='yuoni-sunset-edition')
);
