import unittest

from gamexs_scraper.adapters.cdkeyshare import _tier_from_value
from gamexs_scraper.base import FULL_CAPACITY, account_offer_type
from gamexs_scraper.models import AccessTier, ProductType


class FullCapacityTest(unittest.TestCase):
    def test_full_capacity_is_its_own_type(self):
        self.assertEqual(_tier_from_value("ظرفیت کامل"), FULL_CAPACITY)
        self.assertEqual(account_offer_type(FULL_CAPACITY), (ProductType.OWN_ACCOUNT_GAME, None))
        self.assertEqual(account_offer_type(AccessTier.CAPACITY_1), (ProductType.ACCOUNT_GAME, AccessTier.CAPACITY_1))


if __name__ == "__main__":
    unittest.main()
