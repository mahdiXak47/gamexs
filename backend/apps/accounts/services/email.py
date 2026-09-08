import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_verification_email(user, token: str) -> bool:
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    try:
        sent = send_mail(
            subject="تایید ایمیل GameXS",
            message=f"برای تایید ایمیل خود روی لینک زیر کلیک کنید:\n{link}",
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@gamexs.ir"),
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.exception("Failed to send verification email to %s: %s", user.email, exc)
        return False
    return sent == 1
