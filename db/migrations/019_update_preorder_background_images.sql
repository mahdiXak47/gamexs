-- Override selected preorder carousel background artwork.
-- These rows are inserted by the scraper; run after the game rows exist.

UPDATE ps5_games
SET main_background_image_url = 'https://images.igdb.com/igdb/image/upload/t_720p/ar5z88.webp'
WHERE slug = 'marvels-wolverine';

UPDATE ps5_games
SET main_background_image_url = 'https://images.igdb.com/igdb/image/upload/t_720p/ar5z78.webp'
WHERE slug = 'control-resonant';
