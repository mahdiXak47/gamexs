import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class SMSService:
    def send_otp(self, phone_number: str, code: str) -> bool:
        backend = getattr(settings, "SMS_BACKEND", "console")
        if backend == "console":
            logger.info("[SMS console] OTP for %s: %s", phone_number, code)
            print(f"[SMS] OTP for {phone_number}: {code}")
            return True
        if backend == "kavenegar":
            return self._send_kavenegar(phone_number, code)
        logger.error("Unknown SMS_BACKEND: %s", backend)
        return False

    def _send_kavenegar(self, phone_number: str, code: str) -> bool:
        try:
            import kavenegar  # type: ignore

            api = kavenegar.KavenegarAPI(settings.SMS_API_KEY)
            api.verify_lookup(
                {
                    "receptor": phone_number,
                    "token": code,
                    "template": "gamexs-otp",
                }
            )
            return True
        except Exception as exc:
            logger.error("Kavenegar error for %s: %s", phone_number, exc)
            return False


sms_service = SMSService()
