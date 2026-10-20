import unittest

from gamexs_scraper.adapters.fillgame import buttons, capacity_offers, product_info
from gamexs_scraper.models import AccessTier, ProductType

URL = "https://fill-game.ir/product/x"


def button(attr, value, label):
    return f'<button type="button" wire:click="selectValue({attr}, {value})"><span>{label}</span></button>'


class FillGameTest(unittest.TestCase):
    def test_capacity_options(self):
        options = "".join([
            button(5, 174, "PS5"),
            button(3, 175, "ظرفیت 2 اختصاصی <b>۱۲,۷۹۹,۰۰۰</b> ت"),
            button(3, 176, "ظرفیت 3 ۶,۹۹۰,۰۰۰ ت"),
            button(3, 177, "ظرفیت 3 اجاره‌ای ۹۹۰,۰۰۰ ت"),
            button(3, 178, "ظرفیت 3 اجاره ای ۹۹۰,۰۰۰ ت"),
            button(3, 179, "ظرفیت 3 اشتراکی ۵۰۰,۰۰۰ ت"),
            button(3, 180, "ظرفیت 3 اختصاصی ۸۰۰,۰۰۰ ت ناموجود"),
        ])
        offers = capacity_offers(options, URL, "اکانت بازی GTA VI", True, None)
        self.assertEqual(
            [(o.tier, o.price_toman, o.in_stock) for o in offers],
            [(AccessTier.CAPACITY_2, 12799000, True), (AccessTier.CAPACITY_3, 6990000, True), (AccessTier.CAPACITY_3, 800000, False)],
        )
        self.assertTrue(all(o.product_type is ProductType.ACCOUNT_GAME and o.seller == "fillgame" for o in offers))

    def test_page_parts(self):
        page = button(5, 174, "PS5") + (
            '<script type="application/ld+json">{"@type":"Product","name":"اکانت بازی Alan Wake 2",'
            '"offers":{"availability":"https://schema.org/OutOfStock"}}</script>'
        )
        self.assertEqual(buttons(page), [(5, 174, "PS5")])
        self.assertEqual(product_info(page), ("اکانت بازی Alan Wake 2", False, None))


if __name__ == "__main__":
    unittest.main()
