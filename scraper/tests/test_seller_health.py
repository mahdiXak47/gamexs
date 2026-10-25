import unittest
from unittest.mock import patch

from gamexs_scraper.seller_health import (
    DEFAULT_MAX_ATTEMPTS,
    DEFAULT_RETRY_DELAY_SECONDS,
    build_failure_alert,
    evaluate_game_count,
    retry_delays,
)
from gamexs_scraper.telegram import send_telegram_alert


class SellerHealthPolicyTests(unittest.TestCase):
    def test_uses_three_attempts_with_a_thirty_second_delay_for_each_retry(self):
        self.assertEqual(DEFAULT_MAX_ATTEMPTS, 3)
        self.assertEqual(DEFAULT_RETRY_DELAY_SECONDS, 30)
        self.assertEqual(retry_delays(3, 30), [30, 30])

    def test_rejects_empty_result(self):
        result = evaluate_game_count(observed_games=0, previous_games=117)

        self.assertFalse(result.healthy)
        self.assertIn("zero", result.reason.lower())

    def test_rejects_drop_greater_than_fifty_percent(self):
        result = evaluate_game_count(observed_games=49, previous_games=100)

        self.assertFalse(result.healthy)
        self.assertIn("drop", result.reason.lower())

    def test_accepts_exactly_half_and_new_sellers_with_games(self):
        self.assertTrue(evaluate_game_count(50, 100).healthy)
        self.assertTrue(evaluate_game_count(12, None).healthy)

    def test_failure_alert_contains_operator_details(self):
        alert = build_failure_alert(
            seller="pspro",
            attempts=3,
            reason="result dropped from 100 games to 20",
            previous_success="2026-09-08T01:00:00+00:00",
            observed_games=20,
        )

        self.assertIn("pspro", alert)
        self.assertIn("3", alert)
        self.assertIn("100 games to 20", alert)
        self.assertIn("2026-09-08", alert)

    def test_telegram_alert_is_disabled_until_credentials_are_configured(self):
        with patch("gamexs_scraper.telegram.request.urlopen") as urlopen:
            self.assertFalse(send_telegram_alert("test", environ={}))
            urlopen.assert_not_called()

    def test_telegram_alert_posts_to_configured_bot(self):
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b'{"ok": true}'

        environment = {"TELEGRAM_BOT_TOKEN": "token", "TELEGRAM_CHAT_ID": "chat"}
        with patch("gamexs_scraper.telegram.request.urlopen", return_value=Response()) as urlopen:
            self.assertTrue(send_telegram_alert("test", environ=environment))
            request = urlopen.call_args.args[0]
            self.assertEqual(request.full_url, "https://api.telegram.org/bottoken/sendMessage")
            self.assertIn(b'"chat_id": "chat"', request.data)


    def test_empty_stock_is_healthy_only_when_products_were_seen(self):
        empty = evaluate_game_count(0, 28, products_seen=125)
        self.assertTrue(empty.healthy)
        self.assertTrue(empty.empty_stock)
        self.assertFalse(evaluate_game_count(0, 28, products_seen=0).healthy)
        self.assertFalse(evaluate_game_count(0, 28).healthy)
        self.assertFalse(evaluate_game_count(5, 28, products_seen=125).empty_stock)


if __name__ == "__main__":
    unittest.main()
