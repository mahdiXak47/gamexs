import unittest

from gamexs_scraper.adapters.digikala import _NON_PS5_RE


class DigikalaPlatformTest(unittest.TestCase):
    def test_old_consoles_pc_dvds_and_switch_are_rejected(self):
        for title in ("بازی killzone مخصوص پلی استیشن ۲", "بازی civil war مخصوص پلی استیشن 2",
                      "بازی عصر بازی مدل driver san francisco", "بازی hogwarts legacy مخصوص نینتندو سوئیچ",
                      "بازی Killzone مخصوص PS2"):
            self.assertTrue(_NON_PS5_RE.search(title), title)

    def test_ps4_and_ps5_games_pass(self):
        for title in ("بازی EA FC 26 مخصوص PS5", "بازی Elden Ring مخصوص پلی استیشن 5",
                      "بازی GTA V مخصوص PS4", "بازی NBA 2K23 مخصوص پلی استیشن ۴"):
            self.assertIsNone(_NON_PS5_RE.search(title), title)


if __name__ == "__main__":
    unittest.main()
