import unittest

from gamexs_scraper.adapters.psnacctm import offers_from_product
from gamexs_scraper.models import AccessTier, ProductType


def variant(price, stock, **attrs):
    names = {"platform": "🕹️ پلتفرم ", "capacity": "⚙️ظرفیت ", "disc": "نوع دیسک"}
    return {
        "enabled": True, "price": price, "stock_number": stock, "is_stock_managed": True,
        "product_attributes": [{"name": names[k], "value": {"value": v}} for k, v in attrs.items()],
    }


def product(name, *variants):
    return {"name": name, "url": "/product/x", "enabled": True, "images": [{"url": "https://img/x.jpg"}], "product_variants": list(variants)}


class PsnAcctmTests(unittest.TestCase):
    def test_account_keeps_ps5_variants_and_maps_capacities(self):
        offers = offers_from_product(product(
            "اکانت قانونی بازی Batman Arkham Knight برای کنسول PS4 & PS5",
            variant(747500, 0, platform="PS5 ⚪️", capacity="🟢 دوم ( آنلاین و آفلاین )"),
            variant(517500, 4, platform="PS4 ⚫️", capacity="🟢 دوم ( آنلاین و آفلاین )"),
            variant(390000, 2, platform="PS5", capacity="🟠 سوم ( نیاز به اینترنت )"),
            variant(90000, 1, platform="PS5", capacity="اول"),
        ))
        self.assertEqual([(o.tier, o.price_toman, o.in_stock) for o in offers], [
            (AccessTier.CAPACITY_2, 747500, False),
            (AccessTier.CAPACITY_3, 390000, True),
            (AccessTier.CAPACITY_1, 90000, True),
        ])
        self.assertTrue(all(o.product_type is ProductType.ACCOUNT_GAME for o in offers))
        self.assertEqual(offers[0].source_url, "https://psnacctm.com/product/x")

    def test_disc_keeps_only_sealed_ps5(self):
        offers = offers_from_product(product(
            "دیسک بازی Phantom Blade Zero کارکرده و آکبند برای PS5",
            variant(990000, 3, disc="🟢 آکبند (نو و پلمپ)"),
            variant(790000, 3, disc="🟠 کارکرده (تمیز و تست‌شده)"),
        ))
        self.assertEqual([(o.product_type, o.price_toman) for o in offers], [(ProductType.DISC, 990000)])

    def test_rentals_services_and_ps4_only_discs_are_skipped(self):
        self.assertEqual(offers_from_product(product("اجاره بازی FC 26", variant(100, 1, capacity="سوم"))), [])
        self.assertEqual(offers_from_product(product("گیفت کارت پلی استیشن ۱۰ دلاری", variant(500000, 5))), [])
        self.assertEqual(offers_from_product(product("دیسک بازی Uncharted 4 برای PS4", variant(900, 1, disc="آکبند"))), [])

    def test_zero_price_and_disabled_variants_are_skipped(self):
        disabled = variant(500, 1, platform="PS5", capacity="دوم") | {"enabled": False}
        self.assertEqual(offers_from_product(product("اکانت X", variant(0, 1, platform="PS5", capacity="دوم"), disabled)), [])


if __name__ == "__main__":
    unittest.main()
