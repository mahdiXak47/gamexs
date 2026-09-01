import unittest

from add_game import (
    filter_target_offers,
    parse_seller_url_specs,
    parse_igdb_slug,
    prompt_for_seller_urls,
)
from gamexs_scraper.game_aliases import alias_candidates
from gamexs_scraper.models import ProductType, RawOffer


class IgdbUrlTests(unittest.TestCase):
    def test_parses_game_url(self):
        self.assertEqual(
            parse_igdb_slug("https://www.igdb.com/games/ea-sports-fc-27"),
            "ea-sports-fc-27",
        )

    def test_rejects_non_game_url(self):
        with self.assertRaises(ValueError):
            parse_igdb_slug("https://www.igdb.com/platforms/playstation-5")

    def test_parses_repeated_seller_url_specs(self):
        self.assertEqual(
            parse_seller_url_specs([
                "xgamesstore=https://xgamesstore.org/product/fc-27/",
                "gamario=https://gamario.com/product/fc-27/",
            ]),
            [
                ("xgamesstore", "https://xgamesstore.org/product/fc-27/"),
                ("gamario", "https://gamario.com/product/fc-27/"),
            ],
        )

    def test_prompt_blank_line_skips_seller(self):
        answers = iter([""] * 21)
        self.assertEqual(prompt_for_seller_urls(lambda _prompt: next(answers)), [])

    def test_prompt_displays_seller_website(self):
        prompts = []
        answers = iter([""] * 21)

        prompt_for_seller_urls(lambda prompt: (prompts.append(prompt), next(answers))[1])

        self.assertTrue(any("https://gamario.com" in prompt for prompt in prompts))


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

    def test_filters_adapter_offers_to_imported_titles(self):
        offers = [
            RawOffer("pspro", "https://seller/fc27", "FC 27", ProductType.DISC, 100),
            RawOffer("pspro", "https://seller/fifa26", "FIFA 26", ProductType.DISC, 100),
        ]
        self.assertEqual(
            filter_target_offers(offers, alias_candidates("EA Sports FC 27")),
            offers[:1],
        )

    def test_filters_persian_fc_suffix(self):
        offer = RawOffer(
            "parsconsole", "https://seller/fc27", "خرید اکانت قانونی بازی FC 27 اف سی",
            ProductType.ACCOUNT_GAME, 100,
        )
        self.assertEqual(
            filter_target_offers([offer], alias_candidates("EA Sports FC 27")),
            [offer],
        )


if __name__ == "__main__":
    unittest.main()
