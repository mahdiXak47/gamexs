import os
import unittest
from unittest.mock import patch

from runner import interval_seconds


class RunnerConfigTests(unittest.TestCase):
    def test_defaults_to_daily_interval(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(interval_seconds(), 24 * 60 * 60)

    def test_reads_positive_configured_interval(self):
        with patch.dict(os.environ, {"SCRAPER_INTERVAL_SECONDS": "90"}, clear=True):
            self.assertEqual(interval_seconds(), 90)

    def test_rejects_non_positive_or_invalid_interval(self):
        for value in ("0", "-1", "tomorrow"):
            with self.subTest(value=value), patch.dict(
                os.environ, {"SCRAPER_INTERVAL_SECONDS": value}, clear=True
            ):
                with self.assertRaises(ValueError):
                    interval_seconds()


if __name__ == "__main__":
    unittest.main()
