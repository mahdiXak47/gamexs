from unittest.mock import patch

from django.test import Client, TestCase, override_settings
from django.contrib import admin
from django.core.checks import Tags, run_checks
from django.urls import reverse
from rest_framework.test import APIClient

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


class EmailDeliveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            phone_number="09123456789",
            password="pass12345",
            email="existing@example.com",
            is_active=True,
            is_phone_verified=True,
        )
        self.client.force_authenticate(self.user)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    @patch("apps.accounts.services.email.send_mail", return_value=1)
    def test_complete_profile_reports_success_when_email_is_accepted(self, send_mail):
        response = self.client.post(
            reverse("auth-complete-profile"),
            {"first_name": "Test", "last_name": "User", "email": "test@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"email_sent": True})
        send_mail.assert_called_once()

    @patch("apps.accounts.services.email.send_mail", side_effect=OSError("SMTP unavailable"))
    def test_complete_profile_reports_delivery_failure(self, send_mail):
        response = self.client.post(
            reverse("auth-complete-profile"),
            {"first_name": "Test", "last_name": "User", "email": "test@example.com"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["email_sent"])
        self.assertTrue(EmailVerificationToken.objects.filter(user=self.user).exists())
        send_mail.assert_called_once()

    @patch("apps.accounts.services.email.send_mail", side_effect=OSError("SMTP unavailable"))
    def test_resend_verification_reports_delivery_failure(self, send_mail):
        response = self.client.post(reverse("auth-resend-verification"))

        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["email_sent"])
        self.assertTrue(EmailVerificationToken.objects.filter(user=self.user).exists())
        send_mail.assert_called_once()


class ProductionConfigurationChecksTests(TestCase):
    @override_settings(
        DEBUG=False,
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="",
    )
    def test_production_email_host_is_required_for_smtp(self):
        errors = run_checks(tags=[Tags.security])

        self.assertTrue(any(error.id == "accounts.E001" for error in errors))

    @override_settings(
        DEBUG=False,
        EMAIL_BACKEND="django.core.mail.backends.smtp.EmailBackend",
        EMAIL_HOST="smtp.example.com",
    )
    def test_configured_production_email_host_passes_custom_check(self):
        errors = run_checks(tags=[Tags.security])

        self.assertFalse(any(error.id == "accounts.E001" for error in errors))


class ProfileStaffFlagTests(TestCase):
    def test_profile_exposes_is_staff_but_does_not_let_users_set_it(self):
        user = User.objects.create_user(phone_number="09120000001", password="pass-1234")
        client = APIClient()
        client.force_authenticate(user)

        self.assertIs(client.get(reverse("profile")).data["is_staff"], False)

        client.patch(reverse("profile"), {"is_staff": True}, format="json")
        user.refresh_from_db()
        self.assertFalse(user.is_staff)


class SignupSmsFailureTests(TestCase):
    URL = "/api/auth/signup/"
    BODY = {"phone_number": "09120000001", "password": "pass-word-123"}

    def test_failed_sms_returns_503_and_the_number_can_retry(self):
        client = APIClient()
        with patch("apps.accounts.views.sms_service.send_otp", return_value=False):
            self.assertEqual(client.post(self.URL, self.BODY, format="json").status_code, 503)
        with patch("apps.accounts.views.sms_service.send_otp", return_value=True):
            response = client.post(self.URL, self.BODY, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(User.objects.filter(phone_number=self.BODY["phone_number"]).count(), 1)

    def test_jalali_date(self):
        from .services.sms import jalali_date

        self.assertEqual(jalali_date(2026, 3, 21), "1405/01/01")
        self.assertEqual(jalali_date(2025, 3, 20), "1403/12/30")
