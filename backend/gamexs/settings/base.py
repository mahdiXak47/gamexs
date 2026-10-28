from datetime import timedelta
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY", default="django-insecure-change-me-in-production")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.catalog",
    "apps.orders",
    "apps.wishlist",
    "apps.game_accounts",
    "apps.tickets",
    "apps.reviews",
    "apps.billing",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "apps.accounts.middleware.CookieCsrfMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "gamexs.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "gamexs.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="gamexs"),
        "USER": config("POSTGRES_USER", default="gamexs"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="gamexs"),
        "HOST": config("POSTGRES_HOST", default="localhost"),
        "PORT": config("POSTGRES_PORT", default="5434"),
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {
        "wishlist": config("WISHLIST_RATE_LIMIT", default="30/minute"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

JWT_ACCESS_COOKIE_NAME = config("JWT_ACCESS_COOKIE_NAME", default="gx_access")
JWT_REFRESH_COOKIE_NAME = config("JWT_REFRESH_COOKIE_NAME", default="gx_refresh")
JWT_COOKIE_SECURE = config("JWT_COOKIE_SECURE", default=False, cast=bool)
JWT_COOKIE_SAMESITE = config("JWT_COOKIE_SAMESITE", default="Lax")

CORS_ALLOW_CREDENTIALS = True

# Origins allowed to send cookie-authenticated (cross-origin) requests.
CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:3000,http://localhost:8000,https://gamexs.ir,https://api.gamexs.ir,https://www.gamexs.ir",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

# OTP
OTP_EXPIRY_SECONDS = 120
OTP_MAX_ATTEMPTS = 5
OTP_TOKEN_EXPIRY_SECONDS = 300  # JWT wrapping the phone+purpose between step 1 and 2

# Email verification
EMAIL_VERIFICATION_EXPIRY_HOURS = 24
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000")

# SMS
SMS_BACKEND = config("SMS_BACKEND", default="console")  # 'console' | 'smsir'
SMS_API_KEY = config("SMS_API_KEY", default="")
SMS_SENDER = config("SMS_SENDER", default="")
SMS_TEMPLATE_ID = config("SMS_TEMPLATE_ID", default="")


# CPC billing (apps.billing). Global rules and the default price per click come
# from the environment so they can change without a release; per-store rates,
# spending caps and promotional campaigns are rows edited in Django admin.
# Every invoice stores the rules it was priced with (Invoice.rules).
BILLING = {
    # Price of one valid click in toman, for stores without their own agreement.
    "BASE_CPC_TOMAN": config("BILLING_BASE_CPC_TOMAN", default=0, cast=int),
    # A repeat click by the same visitor on the same store within this window is a duplicate.
    "DUPLICATE_WINDOW_MINUTES": config("BILLING_DUPLICATE_WINDOW_MINUTES", default=30, cast=int),
    # Clicks by one visitor in one Tehran day beyond this count are suspicious.
    "MAX_CLICKS_PER_VISITOR_DAY": config("BILLING_MAX_CLICKS_PER_VISITOR_DAY", default=20, cast=int),
    # This many clicks by one visitor within BURST_WINDOW_SECONDS is a burst (suspicious).
    "BURST_CLICKS": config("BILLING_BURST_CLICKS", default=5, cast=int),
    "BURST_WINDOW_SECONDS": config("BILLING_BURST_WINDOW_SECONDS", default=60, cast=int),
    # Clicks that did not come from a GameXS page (no referrer) are suspicious.
    "REQUIRE_GAMEXS_REFERRER": config("BILLING_REQUIRE_GAMEXS_REFERRER", default=False, cast=bool),
    # Suspicious clicks are held out of invoices until staff review them, unless this is on.
    "SUSPICIOUS_BILLABLE": config("BILLING_SUSPICIOUS_BILLABLE", default=False, cast=bool),
}
