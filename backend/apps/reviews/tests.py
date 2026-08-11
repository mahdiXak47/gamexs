from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import GameReview


class GameReviewApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            phone_number="09123456789",
            password="pass12345",
            is_active=True,
            is_phone_verified=True,
        )
        self.game_id = 42
        self.url = reverse("game-reviews", kwargs={"game_id": self.game_id})

    def test_unauthenticated_post_rejected(self):
        response = self.client.post(self.url, {"rating": 5, "body": "Great"})
        self.assertEqual(response.status_code, 401)

    def test_authenticated_user_creates_pending_review(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(self.url, {"rating": 5, "body": "خیلی خوب بود"}, format="json")

        self.assertEqual(response.status_code, 201)
        review = GameReview.objects.get(user=self.user, game_id=self.game_id)
        self.assertEqual(review.status, GameReview.STATUS_PENDING)
        self.assertEqual(review.rating, 5)

    def test_invalid_rating_rejected(self):
        self.client.force_authenticate(self.user)
        response = self.client.post(self.url, {"rating": 6, "body": "Bad rating"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_get_only_returns_approved_public_reviews(self):
        other_user = get_user_model().objects.create_user(phone_number="09987654321", password="pass12345", is_active=True)
        GameReview.objects.create(user=self.user, game_id=self.game_id, rating=5, body="Visible", status=GameReview.STATUS_APPROVED)
        GameReview.objects.create(user=other_user, game_id=self.game_id, rating=3, body="Hidden", status=GameReview.STATUS_PENDING)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approved_count"], 1)
        self.assertEqual(len(response.data["reviews"]), 1)
        self.assertEqual(response.data["reviews"][0]["body"], "Visible")

    def test_resubmitting_updates_existing_review_and_resets_pending(self):
        GameReview.objects.create(user=self.user, game_id=self.game_id, rating=4, body="Old", status=GameReview.STATUS_APPROVED)
        self.client.force_authenticate(self.user)

        response = self.client.post(self.url, {"rating": 2, "body": "Updated"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(GameReview.objects.filter(user=self.user, game_id=self.game_id).count(), 1)
        review = GameReview.objects.get(user=self.user, game_id=self.game_id)
        self.assertEqual(review.status, GameReview.STATUS_PENDING)
        self.assertEqual(review.body, "Updated")
