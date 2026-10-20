import unittest

from gamexs_scraper.normalize import clean_title, normalize_game_name


class GameNameNormalizationTests(unittest.TestCase):
    def test_roman_and_arabic_sequel_numbers_share_identity(self):
        self.assertEqual(
            normalize_game_name("Armored Core 6"),
            normalize_game_name("Armored Core VI"),
        )

    def test_roman_numeral_is_normalized_only_as_a_standalone_token(self):
        self.assertEqual(
            normalize_game_name("Final Fantasy VII Remake"),
            "final fantasy 7 remake",
        )

    def test_zero_padded_titles_keep_their_identity(self):
        self.assertNotEqual(
            normalize_game_name("007 First Light"),
            normalize_game_name("7 First Light"),
        )

    def test_preorder_prefix_and_transliteration_are_stripped(self):
        title = "پیش خرید و قیمت اکانت قانونی بازی GTA VI جی تی ای 6 برای Ps5"
        self.assertEqual(clean_title(title), "GTA VI")
        self.assertEqual(normalize_game_name(title), "gta 6")
        self.assertEqual(clean_title("نینتندو"), "نینتندو")  # Persian-only titles are left alone

    def test_2k_titles_are_not_split_or_rewritten(self):
        self.assertEqual(normalize_game_name("NBA 2K25"), "nba 2k25")


if __name__ == "__main__":
    unittest.main()
