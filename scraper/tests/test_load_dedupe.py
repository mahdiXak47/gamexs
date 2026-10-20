import unittest

from gamexs_scraper.load_to_postgres import _better_offer
from gamexs_scraper.models import ProductType, RawOffer


def offer(price: int, in_stock: bool = True) -> RawOffer:
    return RawOffer(seller="x", source_url="u", raw_title="t", product_type=ProductType.DISC, price_toman=price, in_stock=in_stock)


class VariantPickTests(unittest.TestCase):
    """One price per listing per load: in stock first, then the cheapest priced variant."""

    def test_cheaper_in_stock_variant_wins(self):
        self.assertTrue(_better_offer(offer(395_000), offer(2_642_000)))
        self.assertFalse(_better_offer(offer(2_642_000), offer(395_000)))

    def test_in_stock_beats_cheaper_out_of_stock(self):
        self.assertTrue(_better_offer(offer(900, in_stock=True), offer(100, in_stock=False)))

    def test_zero_price_never_beats_a_real_price(self):
        self.assertFalse(_better_offer(offer(0), offer(13_980_000)))

    def test_equal_offers_keep_the_first(self):
        self.assertFalse(_better_offer(offer(500), offer(500)))


if __name__ == "__main__":
    unittest.main()
