import unittest

from gamexs_scraper.base import title_with_edition
from gamexs_scraper.load_to_postgres import catalog_title_index
from gamexs_scraper.normalize import normalize_game_name

KEY = "attribute_انتخاب-ادیشن"


class EditionTest(unittest.TestCase):
    def test_editions_resolve_to_their_own_game(self):
        index = catalog_title_index([(1, "Grand Theft Auto VI"), (2, "Grand Theft Auto VI Ultimate Edition")])
        title = "اکانت قانونی Grand Theft Auto VI برای PS5"
        for edition, game in (("Standard Edition", 1), ("Standard ریجن امریکا", 1), ("Ultimate Edition", 2), ("Ultimate ریجن امریکا", 2)):
            self.assertEqual(index.get(normalize_game_name(title_with_edition(title, {KEY: edition}))), game, edition)

    def test_persian_and_slug_editions(self):
        self.assertEqual(title_with_edition("Alan Wake 2", {"attribute_pa_edition": "%d8%af%db%8c%d9%84%d8%a7%da%a9%d8%b3"}), "Alan Wake 2 Deluxe Edition")
        self.assertEqual(title_with_edition("X", {"attribute_نسخه": "ultimate-edition"}), "X ultimate edition")
        self.assertEqual(title_with_edition("X", {"attribute_نسخه": "استاندارد"}), "X")

    def test_no_edition_attribute_keeps_title(self):
        self.assertEqual(title_with_edition("X", {"attribute_ظرفیت": "ظرفیت 2"}), "X")


if __name__ == "__main__":
    unittest.main()
