import logging
import sys

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

_SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify"


class SMSService:
    def send_otp(self, phone_number: str, code: str) -> bool:
        backend = getattr(settings, "SMS_BACKEND", "console")
        if backend == "console":
            logger.info("[SMS console] OTP for %s: %s", phone_number, code)
            # flush immediately so it appears in dev server output
            print(f"[SMS] OTP for {phone_number}: {code}", flush=True)
            sys.stdout.flush()
            return True
        if backend == "smsir":
            return self._send_smsir(phone_number, code)
        logger.error("Unknown SMS_BACKEND: %s", backend)
        return False

    def _send_smsir(self, phone_number: str, code: str) -> bool:
        api_key = getattr(settings, "SMS_API_KEY", "")
        template_id = getattr(settings, "SMS_TEMPLATE_ID", None)

        if not api_key or not template_id:
            logger.error("SMS_API_KEY or SMS_TEMPLATE_ID not configured")
            return False

        payload = {
            "mobile": phone_number,
            "templateId": int(template_id),
            "parameters": [
                {"name": "Code", "value": code},
            ],
        }
        try:
            response = requests.post(
                _SMSIR_VERIFY_URL,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                },
                timeout=10,
            )
            data = response.json()
            if data.get("status") == 1:
                logger.info("SMS.ir OTP sent to %s", phone_number)
                return True
            logger.error("SMS.ir error for %s: status=%s message=%s", phone_number, data.get("status"), data.get("message"))
            return False
        except Exception as exc:
            logger.error("SMS.ir request failed for %s: %s", phone_number, exc)
            return False


sms_service = SMSService()
