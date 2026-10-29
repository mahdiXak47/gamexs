import json
import unittest

import requests
from bs4 import BeautifulSoup

from gamexs_scraper.woo_store import WooStoreFetcher, page_key, variation_record

VARIATION = {
    "id": 7, "name": "اکانت قانونی GTA VI &amp; more", "parent": 5,
    "permalink": "https://shop.ir/product/%d8%ac%db%8c-gta/?attribute_pa_platform=ps5"
                 "&attribute_pa_capacity=%25d8%25b8%25d8%25b1%25d9%2581%25db%258c%25d8%25aa-2",
    "prices": {"price": "129990", "regular_price": "150000", "currency_minor_unit": 1},
    "is_in_stock": True, "is_purchasable": True, "images": [{"src": "https://shop.ir/a.jpg"}],
}


class _Response:
    def __init__(self, payload=None, text="", headers=None, fail=False):
        self.payload, self.text, self.headers, self.fail = payload, text, headers or {}, fail
        self.content = text.encode()

    def raise_for_status(self):
        if self.fail:
            raise requests.exceptions.HTTPError("403")

    def json(self):
        return self.payload


class _Fetcher:
    def __init__(self, api):
        self.api, self.urls = api, []

    def get(self, url, **kwargs):
        self.urls.append(url)
        if "wp-json" in url:
            return self.api
        return _Response(text="<html>real page</html>")


class WooStoreTests(unittest.TestCase):
    def test_variation_keeps_the_html_attribute_slugs_and_whole_toman(self):
        record = variation_record(VARIATION)
        # Same values as data-product_variations: taxonomy slugs stay percent-encoded once.
        self.assertEqual(record["attributes"], {
            "attribute_pa_platform": "ps5",
            "attribute_pa_capacity": "%d8%b8%d8%b1%d9%81%db%8c%d8%aa-2",
        })
        self.assertEqual(record["display_price"], 12999)  # minor unit 1
        self.assertTrue(record["is_in_stock"])

    def test_product_pages_come_from_one_sweep_and_other_urls_are_fetched(self):
        inner = _Fetcher(_Response([VARIATION], headers={"X-WP-TotalPages": "1"}))
        fetcher = WooStoreFetcher(inner, "https://shop.ir")
        page = fetcher.get("https://shop.ir/product/%D8%AC%DB%8C-GTA")
        soup = BeautifulSoup(page.content, "lxml")
        self.assertEqual(soup.find("h1").get_text(), "اکانت قانونی GTA VI & more")
        variations = json.loads(soup.find("form", class_="variations_form")["data-product_variations"])
        self.assertEqual(variations[0]["display_price"], 12999)
        self.assertEqual(fetcher.get("https://shop.ir/product/disc/").text, "<html>real page</html>")
        self.assertEqual(len([u for u in inner.urls if "wp-json" in u]), 1)

    def test_api_failure_falls_back_to_product_pages(self):
        inner = _Fetcher(_Response(fail=True))
        fetcher = WooStoreFetcher(inner, "https://shop.ir")
        self.assertEqual(fetcher.get("https://shop.ir/product/%d8%ac%db%8c-gta/").text, "<html>real page</html>")

    def test_a_catalog_change_during_the_sweep_falls_back_to_product_pages(self):
        class Paged(_Fetcher):
            def get(self, url, **kwargs):
                self.urls.append(url)
                if "wp-json" not in url:
                    return _Response(text="<html>real page</html>")
                total = "150" if kwargs["params"]["page"] == 1 else "151"
                return _Response([VARIATION], headers={"X-WP-TotalPages": "2", "X-WP-Total": total})

        fetcher = WooStoreFetcher(Paged(None), "https://shop.ir")
        self.assertEqual(fetcher.get("https://shop.ir/product/%d8%ac%db%8c-gta/").text, "<html>real page</html>")

    def test_page_key_ignores_case_encoding_and_slashes(self):
        self.assertEqual(page_key("https://a.ir/product/%D8%AC%DB%8C/"), page_key("https://a.ir/product/%d8%ac%db%8c"))


if __name__ == "__main__":
    unittest.main()


class GameoneStoreApiTests(unittest.TestCase):
    def test_disc_offers_come_from_the_category_listing(self):
        from gamexs_scraper.adapters.gameonestore import GameoneStoreAdapter

        product = {"name": "بازی GTA VI &#8211; PS5", "permalink": "https://gameonestore.com/product/gta-vi",
                   "prices": {"price": "4990000", "currency_minor_unit": 0}, "is_in_stock": False, "images": []}
        free = dict(product, prices={"price": "0"})
        inner = _Fetcher(_Response([product, free], headers={"X-WP-TotalPages": "1"}))
        [offer] = list(GameoneStoreAdapter(fetcher=inner).iter_listings())
        self.assertEqual((offer.raw_title, offer.price_toman, offer.in_stock, offer.source_url),
                         ("بازی GTA VI – PS5", 4990000, False, "https://gameonestore.com/product/gta-vi/"))

    def test_api_failure_falls_back_to_the_page_crawl(self):
        from gamexs_scraper.adapters.gameonestore import GameoneStoreAdapter

        adapter = GameoneStoreAdapter(fetcher=_Fetcher(_Response(fail=True)))
        self.assertIsNone(adapter._offers_from_store_api())
