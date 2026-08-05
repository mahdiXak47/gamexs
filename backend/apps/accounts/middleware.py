from django.http import JsonResponse
from django.middleware.csrf import CsrfViewMiddleware

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


class CookieCsrfMiddleware:
    """Re-apply Django CSRF validation to the cookie-authenticated DRF API.

    DRF marks its views ``csrf_exempt``, which makes Django's global
    ``CsrfViewMiddleware`` skip them entirely. That leaves the httpOnly-JWT
    cookie-auth writes without CSRF protection if ``SameSite`` is ever
    relaxed or the frontend/API split across origins.

    This middleware re-runs Django's CSRF check for non-safe ``/api/``
    requests, regardless of a view being ``csrf_exempt``. The token is
    bootstrapped by ``GET /api/auth/csrf/`` and echoed back by the frontend
    as an ``X-CSRFToken`` header.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method not in SAFE_METHODS and request.path.startswith("/api/"):
            csrf = CsrfViewMiddleware(self.get_response)
            reason = csrf.process_view(request, None, (), {})
            if reason:
                return JsonResponse(
                    {"detail": "درخواست نامعتبر است. صفحه را رفرش کنید و دوباره تلاش کنید."},
                    status=403,
                )
        return self.get_response(request)
