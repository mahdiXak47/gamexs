import unittest

from gamexs_scraper.load_to_postgres import catalog_title_index
from gamexs_scraper.normalize import normalize_game_name


class CatalogTitleIndexTest(unittest.TestCase):
    def test_seller_title_matches_catalog_title(self):
        index = catalog_title_index([(19332, "Grand Theft Auto VI"), (1517, "Grand Theft Auto VI Ultimate Edition")])
        seller = "اکانت قانونی بازی Grand Theft Auto VI    برای کنسول PS5 "
        self.assertEqual(index.get(normalize_game_name(seller)), 19332)

    def test_ambiguous_titles_are_left_out(self):
        index = catalog_title_index([(1, "Hades II"), (2, "Hades 2"), (3, "Astro Bot")])
        self.assertNotIn(normalize_game_name("Hades II"), index)
        self.assertEqual(index[normalize_game_name("Astro Bot")], 3)


if __name__ == "__main__":
    unittest.main()
