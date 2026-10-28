import logging
import sys

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

_SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify"


def jalali_date(year: int, month: int, day: int) -> str:
    """Gregorian -> Solar Hijri (the calendar Iranian users read), as YYYY/MM/DD."""
    days = 365 * (year - 1600) + (year - 1597) // 4 - (year - 1501) // 100 + (year - 1201) // 400
    days += sum((31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)[: month - 1]) + day - 80
    if month > 2 and (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)):
        days += 1
    jy = 979 + 33 * (days // 12053)
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days >= 366:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    jm = days // 31 + 1 if days < 186 else (days - 186) // 30 + 7
    jd = days % 31 + 1 if days < 186 else (days - 186) % 30 + 1
    return f"{jy}/{jm:02d}/{jd:02d}"


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
        # Strip inline .env comments (e.g. "key123 #production" → "key123")
        api_key = str(getattr(settings, "SMS_API_KEY", "")).split("#")[0].strip()
        template_id = str(getattr(settings, "SMS_TEMPLATE_ID", "")).split("#")[0].strip()

        if not api_key or not template_id:
            logger.error("SMS_API_KEY or SMS_TEMPLATE_ID not configured")
            return False

        now = timezone.localtime()
        payload = {
            "mobile": phone_number,
            "templateId": int(template_id),
            # Names must match the template's #CODE# #DATE# #TIME# exactly.
            "parameters": [
                {"name": "CODE", "value": code},
                {"name": "DATE", "value": jalali_date(now.year, now.month, now.day)},
                {"name": "TIME", "value": now.strftime("%H:%M")},
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
                print(f"[SMS.ir] OTP sent to {phone_number}", flush=True)
                return True
            logger.error("SMS.ir error for %s: status=%s message=%s", phone_number, data.get("status"), data.get("message"))
            print(f"[SMS.ir] ERROR for {phone_number}: HTTP {response.status_code} | {data}", flush=True)
            return False
        except Exception as exc:
            logger.error("SMS.ir request failed for %s: %s", phone_number, exc)
            print(f"[SMS.ir] EXCEPTION for {phone_number}: {exc}", flush=True)
            return False


sms_service = SMSService()
