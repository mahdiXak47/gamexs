from django.test import Client, TestCase
from django.contrib import admin

from .models import EmailVerificationToken, OTPCode, User
from apps.game_accounts.models import PSNAccount
from apps.orders.models import CartItem, Order
from apps.tickets.models import Ticket, TicketMessage
from apps.wishlist.models import WishlistItem


class CsrfProtectionTests(TestCase):
    def setUp(self):
        # enforce_csrf_checks=True so the Django test client does NOT set
        # _dont_enforce_csrf_checks, letting our CookieCsrfMiddleware run its
        # real check (matches production behavior).
        self.client = Client(enforce_csrf_checks=True)

    def test_csrf_bootstrap_sets_cookie_and_returns_token(self):
        resp = self.client.get("/api/auth/csrf/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("csrfToken", resp.json())
        self.assertIn("csrftoken", resp.cookies)

    def test_unsafe_request_without_csrf_token_is_rejected(self):
        # No csrftoken cookie and no X-CSRFToken header -> the custom
        # CookieCsrfMiddleware must reject before the view runs.
        resp = self.client.post(
            "/api/auth/signup/", data={}, content_type="application/json"
        )
        self.assertEqual(resp.status_code, 403)

    def test_unsafe_request_with_csrf_token_passes_middleware(self):
        # Bootstraps the csrftoken cookie, then a POST echoing it back as
        # X-CSRFToken must pass the CSRF check (reaching view validation).
        bootstrap = self.client.get("/api/auth/csrf/")
        token = bootstrap.json()["csrfToken"]
        resp = self.client.post(
            "/api/auth/signup/",
            data={},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        # Not a CSRF rejection; now it's the serializer/validation layer.
        self.assertNotEqual(resp.status_code, 403)

    def test_authenticated_unsafe_request_is_csrf_gated(self):
        # CSRF must be enforced on authenticated writes even when no session
        # auth is in play. Bootstrap token, then hit an authenticated endpoint.
        bootstrap = self.client.get("/api/auth/csrf/")
        token = bootstrap.json()["csrfToken"]

        without_csrf = self.client.post(
            "/api/wishlist/", data={}, content_type="application/json"
        )
        self.assertEqual(without_csrf.status_code, 403)

        with_csrf = self.client.post(
            "/api/wishlist/",
            data={},
            content_type="application/json",
            HTTP_X_CSRFTOKEN=token,
        )
        # Passed CSRF; 401 because there is no valid auth (not a CSRF 403).
        self.assertNotEqual(with_csrf.status_code, 403)


class AdminRegistrationTests(TestCase):
    def test_user_facing_models_are_registered_in_admin(self):
        for model in (
            User,
            OTPCode,
            EmailVerificationToken,
            CartItem,
            Order,
            Ticket,
            TicketMessage,
            WishlistItem,
            PSNAccount,
        ):
            with self.subTest(model=model.__name__):
                self.assertIn(model, admin.site._registry)
