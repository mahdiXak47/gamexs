"""Tiny signed token that links OTP step-1 (phone+purpose) to step-2 (verify).

We use simplejwt's low-level Token class so the token is signed with SECRET_KEY
and has a short TTL (OTP_TOKEN_EXPIRY_SECONDS, default 5 min).
"""

from django.conf import settings
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import Token


class OTPStepToken(Token):
    token_type = "otp_step"
    lifetime_attr = "OTP_TOKEN_EXPIRY_SECONDS"

    @classmethod
    def get_token_backend(cls):
        from rest_framework_simplejwt.backends import TokenBackend
        from datetime import timedelta
        return TokenBackend(
            algorithm="HS256",
            signing_key=settings.SECRET_KEY,
        )


def create_otp_token(phone_number: str, purpose: str) -> str:
    from datetime import timedelta
    import jwt
    import time

    expiry = getattr(settings, "OTP_TOKEN_EXPIRY_SECONDS", 300)
    payload = {
        "phone": phone_number,
        "purpose": purpose,
        "exp": int(time.time()) + expiry,
        "type": "otp_step",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_otp_token(token: str) -> dict:
    import jwt

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "otp_step":
            raise ValueError("Invalid token type")
        return {"phone_number": payload["phone"], "purpose": payload["purpose"]}
    except jwt.ExpiredSignatureError:
        raise ValueError("OTP token expired")
    except Exception:
        raise ValueError("Invalid OTP token")
