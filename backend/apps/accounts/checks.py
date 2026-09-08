from django.conf import settings
from django.core.checks import Error, Tags, register


@register(Tags.security)
def check_production_email_configuration(app_configs, **kwargs):
    """Prevent production from starting with silently unusable SMTP settings."""
    if getattr(settings, "DEBUG", True):
        return []
    if getattr(settings, "EMAIL_BACKEND", "") != "django.core.mail.backends.smtp.EmailBackend":
        return []
    if str(getattr(settings, "EMAIL_HOST", "")).strip():
        return []

    return [
        Error(
            "EMAIL_HOST must be configured when production uses the SMTP backend.",
            hint="Set EMAIL_HOST through the production secret/environment configuration.",
            id="accounts.E001",
        )
    ]
