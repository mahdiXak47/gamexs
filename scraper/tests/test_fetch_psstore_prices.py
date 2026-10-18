import unittest
import urllib.error
from unittest.mock import patch

import fetch_psstore_prices as psstore


class FetchPsPriceFailureTests(unittest.TestCase):
    def test_network_error_raises_instead_of_returning_empty_price(self):
        with patch.object(psstore, "_http_get", side_effect=urllib.error.URLError("reset")):
            with self.assertRaises(urllib.error.URLError):
                psstore.fetch_ps_price("1", "en-us")

    def test_page_without_store_data_raises(self):
        with patch.object(psstore, "_http_get", return_value=b"<html>blocked</html>"):
            with self.assertRaises(ValueError):
                psstore.fetch_ps_price("1", "en-us")

    def test_missing_page_is_an_empty_price(self):
        err = urllib.error.HTTPError("u", 404, "not found", {}, None)
        with patch.object(psstore, "_http_get", side_effect=err):
            self.assertEqual(psstore.fetch_ps_price("1", "en-us"), psstore.PriceInfo())


if __name__ == "__main__":
    unittest.main()
