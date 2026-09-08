from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient


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

    def test_repeated_wishlist_additions_are_rate_limited(self):
        responses = [
            self.client.post("/api/wishlist/", {"game_id": game_id}, format="json")
            for game_id in range(1, 31)
        ]
        limited = self.client.post("/api/wishlist/", {"game_id": 31}, format="json")

        self.assertTrue(all(response.status_code == 201 for response in responses))
        self.assertEqual(limited.status_code, 429)
