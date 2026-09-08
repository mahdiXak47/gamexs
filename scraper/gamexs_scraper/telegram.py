"""Optional Telegram delivery for scraper operator alerts."""

from __future__ import annotations

import json
import logging
import os
import argparse
from urllib import request

logger = logging.getLogger(__name__)


def send_telegram_alert(message: str, environ: dict[str, str] | None = None) -> bool:
    """Send an alert when Telegram credentials are configured.

    Missing credentials deliberately disable delivery so local runs and
    pre-secret deployments remain usable. The bot token is never logged.
    """
    values = os.environ if environ is None else environ
    token = values.get("TELEGRAM_BOT_TOKEN")
    chat_id = values.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.warning("Telegram alert skipped: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured")
        return False

    api_base = values.get("TELEGRAM_API_BASE_URL", "https://api.telegram.org").rstrip("/")
    endpoint = f"{api_base}/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": message}, ensure_ascii=False).encode("utf-8")
    http_request = request.Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(http_request, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
        if response.status != 200 or not body.get("ok"):
            logger.error("Telegram alert failed with HTTP status %s", response.status)
            return False
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        logger.error("Telegram alert request failed: %s", exc)
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a GameXS Telegram alert when configured")
    parser.add_argument("--message", required=True)
    args = parser.parse_args()
    return 0 if send_telegram_alert(args.message) else 1


if __name__ == "__main__":
    raise SystemExit(main())
