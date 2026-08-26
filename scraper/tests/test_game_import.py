import unittest

from add_game import parse_igdb_slug
from gamexs_scraper.game_aliases import alias_candidates


class IgdbUrlTests(unittest.TestCase):
    def test_parses_game_url(self):
        self.assertEqual(
            parse_igdb_slug("https://www.igdb.com/games/ea-sports-fc-27"),
            "ea-sports-fc-27",
        )

    def test_rejects_non_game_url(self):
        with self.assertRaises(ValueError):
            parse_igdb_slug("https://www.igdb.com/platforms/playstation-5")


class AliasCandidateTests(unittest.TestCase):
    def test_fc_short_name_maps_to_canonical_name(self):
        aliases = alias_candidates("EA Sports FC 27")
        self.assertIn("ea sports fc 27", aliases)
        self.assertIn("ea fc 27", aliases)
        self.assertIn("fc 27", aliases)
        self.assertIn("fc27", aliases)

    def test_edition_suffix_and_short_name_are_supported(self):
        aliases = alias_candidates("EA Sports FC 27 Ultimate Edition")
        self.assertIn("fc 27 ultimate", aliases)
        self.assertIn("fc 27 ultimate edition", aliases)


if __name__ == "__main__":
    unittest.main()
