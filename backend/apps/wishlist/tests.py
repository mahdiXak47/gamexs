from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from unittest.mock import patch


class WishlistMutationThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            phone_number="09123456789",
            password="pass12345",
            is_active=True,
            is_phone_verified=True,
        )
        self.client.force_authenticate(self.user)

    def tearDown(self):
        cache.clear()

    @patch("apps.wishlist.views.PS5Game.objects.filter")
    def test_repeated_wishlist_additions_are_rate_limited(self, catalog_filter):
        catalog_filter.return_value.exists.return_value = True
        game_ids = range(1, 32)
        responses = [
            self.client.post("/api/wishlist/", {"game_id": game_id}, format="json")
            for game_id in list(game_ids)[:30]
        ]
        limited = self.client.post("/api/wishlist/", {"game_id": 31}, format="json")

        self.assertTrue(all(response.status_code == 201 for response in responses))
        self.assertEqual(limited.status_code, 429)

    @patch("apps.wishlist.views.PS5Game.objects.filter")
    def test_unknown_game_is_rejected(self, catalog_filter):
        catalog_filter.return_value.exists.return_value = False

        response = self.client.post("/api/wishlist/", {"game_id": 100000}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("وجود ندارد", response.json()["detail"])

    @patch("apps.wishlist.views.PS5Game.objects.filter")
    def test_target_price_must_be_positive(self, catalog_filter):
        catalog_filter.return_value.exists.return_value = True
        response = self.client.post(
            "/api/wishlist/",
            {"game_id": 1, "target_price_toman": 0},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
