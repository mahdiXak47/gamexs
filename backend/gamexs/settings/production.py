from decouple import config

from .base import *  # noqa: F401, F403

DEBUG = False

# base.py falls back to a key that is public in the repo; it signs every JWT,
# so production must never start with it.
from django.core.exceptions import ImproperlyConfigured

if not SECRET_KEY or SECRET_KEY.startswith("django-insecure"):  # noqa: F405
    raise ImproperlyConfigured("SECRET_KEY must be set to a random value in production")

# Gunicorn already records access logs, but Django's default production
# logging sends request exceptions to email only. Keep admin/API tracebacks in
# the container logs so 500s can be diagnosed from Kubernetes.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="https://gamexs.ir",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

EMAIL_HOST = config("EMAIL_HOST", default="")
# No SMTP provider yet: fall back to logging emails to stdout until EMAIL_HOST is set.
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend",
)
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@gamexs.ir")

# TLS is terminated by the ingress/nginx proxy; Django trusts the forwarded header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
JWT_COOKIE_SECURE = True

# WhiteNoise serves Django admin static files directly from gunicorn.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.accounts.middleware.CookieCsrfMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Error reporting (sentry.hamravesh.com, project gamexs-backend). Off unless
# SENTRY_DSN is set. send_default_pii=False: no user data, IPs or request bodies.
SENTRY_DSN = config("SENTRY_DSN", default="")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=config("SENTRY_ENVIRONMENT", default="production"),
        send_default_pii=False,
        traces_sample_rate=config("SENTRY_TRACES_SAMPLE_RATE", default=0.0, cast=float),
    )
