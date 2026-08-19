import unittest

from psstore_search import SearchProduct, SearchUnavailable, choose_product, search_products


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body

    def raise_for_status(self):
        raise RuntimeError(f"HTTP {self.status_code}")


class FakeSession:
    def __init__(self, response):
        self.response = response

    def post(self, *args, **kwargs):
        return self.response


class SearchProductsTests(unittest.TestCase):
    def test_reads_nested_products_from_concept_results(self):
        response = FakeResponse(200, {
            "data": {"universalSearch": {"results": [{
                "__typename": "Concept",
                "id": "10009909",
                "name": "Assassin's Creed Shadows",
                "products": [{
                    "id": "DELUXE",
                    "name": "Assassin's Creed Shadows Digital Deluxe Edition",
                    "storeDisplayClassification": "FULL_GAME",
                    "platforms": ["PS5"],
                }],
            }]}}
        })
        products = search_products(FakeSession(response), "Assassin's Creed Shadows", retries=1)
        self.assertEqual(products[0].product_id, "DELUXE")
        self.assertEqual(products[0].concept_id, "10009909")

    def test_fails_closed_when_response_shape_changes(self):
        with self.assertRaises(SearchUnavailable):
            search_products(FakeSession(FakeResponse(200, {"data": {}})), "Example", retries=1)


class ChooseProductTests(unittest.TestCase):
    def test_matches_exact_deluxe_edition(self):
        products = [
            SearchProduct("STANDARD", "Assassin's Creed Shadows"),
            SearchProduct("DELUXE", "Assassin's Creed Shadows Digital Deluxe Edition"),
        ]
        result = choose_product("Assassins Creed Shadows Digital Deluxe Edition", products)
        self.assertEqual(result.product.product_id, "DELUXE")

    def test_does_not_assign_standard_product_to_deluxe_game(self):
        result = choose_product(
            "Black Myth Wukong Deluxe Edition",
            [SearchProduct("STANDARD", "Black Myth: Wukong")],
        )
        self.assertIsNone(result.product)

    def test_does_not_assign_deluxe_product_to_standard_game(self):
        result = choose_product(
            "Black Myth Wukong",
            [SearchProduct("DELUXE", "Black Myth: Wukong Deluxe Edition")],
        )
        self.assertIsNone(result.product)

    def test_rejects_non_playstation_platform(self):
        result = choose_product(
            "Example Game",
            [SearchProduct("PC", "Example Game", platforms=("PC",))],
        )
        self.assertIsNone(result.product)

    def test_rejects_equally_ranked_products(self):
        products = [
            SearchProduct("A", "Example Game", platforms=("PS4",)),
            SearchProduct("B", "Example Game", platforms=("PS5",)),
        ]
        result = choose_product("Example Game", products)
        self.assertIsNone(result.product)
        self.assertIn("ambiguous", result.reason)


if __name__ == "__main__":
    unittest.main()
