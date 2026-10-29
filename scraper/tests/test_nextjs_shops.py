import json
import unittest

from gamexs_scraper.adapters.clockstore1 import ClockStore1Adapter
from gamexs_scraper.adapters.gamestore import GameStoreAdapter
from gamexs_scraper.models import AccessTier, ProductType


class _Fetcher:
    def __init__(self, html):
        self.html = html

    def get(self, url, **kwargs):
        class Response:
            content = self.html.encode()
            def raise_for_status(self):
                pass
        return Response()


def page(variants, key="variants"):
    block = json.dumps({"has_variants": True, key: variants}, ensure_ascii=False, separators=(",", ":"))
    escaped = json.dumps(block, ensure_ascii=False)[1:-1]
    return f'<meta property="og:title" content="Bloodborne"><script>self.__next_f.push([1,"{escaped}"])</script>'


class Clockstore1Tests(unittest.TestCase):
    def test_reads_digit_tiers_and_skips_ps4_variants_of_a_ps4_ps5_title(self):
        html = page([
            {"id": 1, "name": "اکانت قانونی Bloodborne PS5 PS4 - ظرفیت 1 ps4 افلاین", "price": 827000, "max_available": 1},
            {"id": 2, "name": "اکانت قانونی Bloodborne PS5 PS4 - ظرفیت 2 ps5 انلاین افلاین", "price": 2130000, "max_available": 1},
            {"id": 3, "name": "اکانت قانونی Bloodborne PS5 PS4 - ظرفیت 3 ps5 انلاین", "price": 900000, "max_available": 0},
            {"id": 4, "name": "اکانت قانونی Bloodborne PS5 PS4 - ظرفیت 1 ps5 افلاین", "price": 0, "max_available": 0},
        ])
        adapter = ClockStore1Adapter(fetcher=_Fetcher(html))
        offers = [(o.tier, o.price_toman, o.in_stock) for o in adapter._parse_product("https://x/product/1/")]
        self.assertEqual(offers, [(AccessTier.CAPACITY_2, 2130000, True), (AccessTier.CAPACITY_3, 900000, False)])


class GameStoreTests(unittest.TestCase):
    def test_full_capacity_and_out_of_stock_options_are_kept(self):
        html = page([
            {"capacity": 2, "console": "PS5", "available": True, "final": 12999000},
            {"capacity": 3, "console": None, "available": False, "final": 6859000},
            {"capacity": 4, "console": None, "available": True, "final": 18999000},
            {"capacity": 1, "console": "PS4", "available": True, "final": 900000},
        ], key="options")
        adapter = GameStoreAdapter(fetcher=_Fetcher(html))
        offers = [(o.product_type, o.tier, o.in_stock) for o in adapter._parse_product("gta-vi-account", ["PS5"], None, "GTA VI")]
        self.assertEqual(offers, [
            (ProductType.ACCOUNT_GAME, AccessTier.CAPACITY_2, True),
            (ProductType.ACCOUNT_GAME, AccessTier.CAPACITY_3, False),
            (ProductType.OWN_ACCOUNT_GAME, None, True),
        ])


if __name__ == "__main__":
    unittest.main()
