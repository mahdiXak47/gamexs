import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_verification_email(user, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    try:
        send_mail(
            subject="تایید ایمیل GameXS",
            message=f"برای تایید ایمیل خود روی لینک زیر کلیک کنید:\n{link}",
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@gamexs.ir"),
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.error("Failed to send verification email to %s: %s", user.email, exc)
