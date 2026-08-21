"""Parser tests for the Telegram channel adapter (no network, no telethon).

Run from scraper/:
    .venv/bin/python -m unittest tests.test_telegram_channel
    .venv/bin/python tests/test_telegram_channel.py
"""

import unittest

from gamexs_scraper.adapters.telegram_channel import TelegramChannelAdapter
from gamexs_scraper.models import AccessTier
from gamexs_scraper.telegram_config import PLAYBOX

SINGLE_OFFER = """اکانت قانونی بازی Assassin's Creed Black Flag Resynced
🏷 فروش مجدد
ریجن انگلیس 🏴󠁧󠁢󠁥󠁮󠁧󠁿 |⚡️#تحویل_فوری

▫️ظرفیت دوم: 4500 ✅ 

🛒 جهت خرید پیام دهید: @PlayBoxAdmin

🕹@PlayBox_Account"""

MULTI_REGION_SAME_TIER = """اکانت قانونی بازی Marvel’s Wolverine Deluxe Edition
♨️ #پیش_خرید

ریجن سوئد 🇸🇪 |⚡️#تحویل_فوری

▫️ظرفیت سوم: 4800 ✅

تاریخ عرضه: ۲۴ شهریور ۱۴۰۵

♨️ #پیش_خرید

ریجن اسپانیا 🇪🇸 |⚡️#تحویل_فوری

▫️ظرفیت سوم: 3750 ✅

تاریخ عرضه: ۱۲ شهریور ۱۴۰۵

⏲️ جهت رزرو برای خرید پیام دهید: @PlayBoxAdmin

🕹@PlayBox_Account"""

BONUS_LINES = """🌀 اکانت قانونی بازی Grand Theft Auto VI
♨️ #پیش_خرید
- پک محتویات Vintage Vice City
- یک ماه اشتراک +GTA
ریجن آمریکا 🇺🇸 |⚡️#تحویل_فوری

▫️ظرفیت سوم: 4800 ✅

تاریخ عرضه: ۲۸ آبان ۱۴۰۵

💶 امکان خرید ظرفیت سوم به صورت اقساطی

⏲️ جهت رزرو برای خرید پیام دهید: @PlayBoxAdmin

🕹@PlayBox_Account"""

PERSIAN_DIGIT_PRICE = """اکانت قانونی بازی Marvel’s Wolverine Deluxe Edition
▫️ظرفیت دوم: ۴۵۰۰ ✅
"""

NO_PRICE_LINE = """🎮 جدیدترین بازی‌ها به زودی
این پیام قیمتی ندارد."""

GIFT_CARD_POST = """اکانت قانونی بازی جایزه؟ 🎁
گیفت کارت پلی‌استیشن ۵
▫️ظرفیت سوم: 2000 ✅"""


class PlayBoxParserTest(unittest.TestCase):
    def setUp(self):
        self.adapter = TelegramChannelAdapter(PLAYBOX)

    def test_single_offer(self):
        offers = self.adapter._offers_from_message(SINGLE_OFFER, 100)
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0].raw_title, "اکانت قانونی بازی Assassin's Creed Black Flag Resynced")
        self.assertEqual(offers[0].tier, AccessTier.CAPACITY_2)
        self.assertEqual(offers[0].price_toman, 4_500_000)
        self.assertEqual(offers[0].source_url, "https://t.me/PlayBox_Account/100")

    def test_multi_region_keeps_cheapest_per_tier(self):
        offers = self.adapter._offers_from_message(MULTI_REGION_SAME_TIER, 200)
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0].tier, AccessTier.CAPACITY_3)
        self.assertEqual(offers[0].price_toman, 3_750_000)

    def test_bonus_and_detail_lines_ignored(self):
        offers = self.adapter._offers_from_message(BONUS_LINES, 300)
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0].tier, AccessTier.CAPACITY_3)
        self.assertEqual(offers[0].price_toman, 4_800_000)

    def test_persian_digit_price(self):
        offers = self.adapter._offers_from_message(PERSIAN_DIGIT_PRICE, 400)
        self.assertEqual(len(offers), 1)
        self.assertEqual(offers[0].tier, AccessTier.CAPACITY_2)
        self.assertEqual(offers[0].price_toman, 4_500_000)

    def test_no_price_line_yields_no_offers(self):
        self.assertEqual(self.adapter._offers_from_message(NO_PRICE_LINE, 500), [])

    def test_skip_keyword_rejects_non_game_post(self):
        self.assertEqual(self.adapter._offers_from_message(GIFT_CARD_POST, 600), [])

    def test_multiple_tiers_one_message(self):
        both = """اکانت قانونی بازی Spider-Man 2
▫️ظرفیت دوم: 4000 ✅
▫️ظرفیت سوم: 3500 ✅"""
        offers = self.adapter._offers_from_message(both, 700)
        by_tier = {o.tier: o.price_toman for o in offers}
        self.assertEqual(by_tier, {AccessTier.CAPACITY_2: 4_000_000, AccessTier.CAPACITY_3: 3_500_000})


if __name__ == "__main__":
    unittest.main()