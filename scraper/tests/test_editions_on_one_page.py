"""Shops that sell Standard and Ultimate on one page (GTA VI, 2026-10-28)."""

import json
import unittest

from gamexs_scraper.adapters.psnacctm import offers_from_product
from gamexs_scraper.base import title_with_edition
from gamexs_scraper.game_aliases import alias_candidates
from gamexs_scraper.load_to_postgres import catalog_title_index
from gamexs_scraper.normalize import normalize_game_name

INDEX = catalog_title_index([(1, "Grand Theft Auto VI"), (2, "Grand Theft Auto VI Ultimate Edition")])


def resolve(raw_title: str) -> int | None:
    """The loader's title-index step: exact normalized title first, then alias candidates."""
    normalized = normalize_game_name(raw_title)
    candidates = [normalized, *sorted(alias_candidates(raw_title) - {normalized})]
    return next((INDEX[c] for c in candidates if c in INDEX), None)


class EditionsOnOnePageTests(unittest.TestCase):
    def test_each_shop_variant_lands_on_its_own_edition(self):
        cases = [
            ("اکانت قانونی GTA VI 6 PS5", {"attribute_pa_version-type": "ultimate"}, 2),  # uperagame
            ("اکانت قانونی GTA VI 6 PS5", {"attribute_pa_version-type": "standard"}, 1),
            ("خرید و قیمت اکانت قانونی بازی GTA VI جی تی ای 6", {"attribute_pa_edition": "ultimate-edition"}, 2),  # parsconsole
            ("Grand Theft Auto VI", {"attribute_انتخاب-ادیشن": "Ultimate ریجن امریکا"}, 2),  # cdkeyshare
        ]
        for raw, attrs, expected in cases:
            with self.subTest(raw=raw, attrs=attrs):
                self.assertEqual(resolve(title_with_edition(raw, attrs)), expected)

    def test_psnacctm_keeps_the_edition_attribute(self):
        def variant(price, edition):
            return {"enabled": True, "price": price, "is_stock_managed": False, "product_attributes": [
                {"name": "🕹️ پلتفرم", "value": {"value": "PS5 ⚪️"}},
                {"name": "⭐ نسخه بازی", "value": {"value": edition}},
                {"name": "⚙️ ظرفیت ", "value": {"value": "🟢 دوم ( آنلاین و آفلاین )"}},
            ]}
        offers = offers_from_product({"name": "اکانت قانونی بازی Grand Theft Auto VI برای کنسول PS5", "url": "/product/gta",
                                      "product_variants": [variant(12_490_000, "Standard 🔵"), variant(14_490_000, "Ultimate 🟣")]})
        self.assertEqual([resolve(o.raw_title) for o in offers], [1, 2])

    def test_nakhlmarket_reads_the_tier_from_the_option_label(self):
        from bs4 import BeautifulSoup
        from gamexs_scraper.adapters.nakhlmarket import NakhlMarketAdapter
        variations = [
            {"attributes": {"pa_select-capacity": "capacity-two-2", "نسخه-بازی": "آلتیمیت"}, "display_price": 10680000, "in_stock": True, "is_purchasable": True},
            {"attributes": {"pa_select-capacity": "capacity-two", "نسخه-بازی": "استاندارد"}, "display_price": 11880000, "in_stock": True, "is_purchasable": False},
            {"attributes": {"pa_select-capacity": "ظرفیت-کامل", "نسخه-بازی": "استاندارد"}, "display_price": 24780000, "in_stock": True, "is_purchasable": True},
        ]
        page = ('<div class="variations"><select><option value="capacity-two">ظرفیت 2</option>'
                '<option value="capacity-two-2">ظرفیت 3</option></select>'
                f"<script>var allVariations = {json.dumps(variations, ensure_ascii=False)};</script></div>")
        offers = list(NakhlMarketAdapter()._parse_variable("u", "اکانت قانونی بازی GTA VI برای PS5", None, BeautifulSoup(page, "lxml")))
        self.assertEqual([(o.tier and o.tier.value, o.product_type.value, o.in_stock, resolve(o.raw_title)) for o in offers], [
            ("capacity_3", "account_game", True, 2),
            ("capacity_2", "account_game", False, 1),  # pre-order closed: can't be ordered
            (None, "own_account_game", True, 1),       # «ظرفیت کامل»
        ])


if __name__ == "__main__":
    unittest.main()
