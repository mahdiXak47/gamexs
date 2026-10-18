import unittest

from bs4 import BeautifulSoup

from gamexs_scraper.adapters.persianconsole import _price_toman, _tier
from gamexs_scraper.models import AccessTier


def _soup(price: str, currency: str) -> BeautifulSoup:
    return BeautifulSoup(
        f'<meta itemprop="price" content="{price}"/><meta itemprop="priceCurrency" content="{currency}"/>',
        "lxml",
    )


class PersianConsoleParsingTests(unittest.TestCase):
    def test_toman_price_is_used_as_is(self):
        self.assertEqual(_price_toman(_soup("12350000.00", "Toman")), 12350000)

    def test_rial_price_is_converted_to_toman(self):
        self.assertEqual(_price_toman(_soup("123500000", "IRR")), 12350000)

    def test_zero_or_missing_price_is_skipped(self):
        self.assertIsNone(_price_toman(_soup("0.00", "Toman")))
        self.assertIsNone(_price_toman(BeautifulSoup("<p></p>", "lxml")))

    def test_tier_is_read_from_title_words_and_digits(self):
        self.assertEqual(_tier("اکانت قانونی Alan Wake 2 ظرفیت دو"), AccessTier.CAPACITY_2)
        self.assertEqual(_tier("اکانت ظرفیت ۳ EA FC"), AccessTier.CAPACITY_3)
        self.assertIsNone(_tier("اکانت قانونی Alan Wake 2"))


if __name__ == "__main__":
    unittest.main()
