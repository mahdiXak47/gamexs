import csv
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from gamexs_scraper.seller_runner import count_csv_games, count_jsonl_records, run_seller


class SellerRunnerTests(unittest.TestCase):
    def test_counts_data_rows_without_counting_the_csv_header(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "pspro.csv"
            with path.open("w", newline="", encoding="utf-8") as output:
                writer = csv.writer(output)
                writer.writerow(["game", "account capacity 1"])
                writer.writerow(["Game A", 100])
                writer.writerow(["Game B", 200])

            self.assertEqual(count_csv_games(path), 2)

    def test_empty_csv_has_zero_games(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "empty.csv"
            path.write_text("game,account capacity 1\n", encoding="utf-8")

            self.assertEqual(count_csv_games(path), 0)

    def test_counts_non_empty_upera_jsonl_records(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "offers.jsonl"
            path.write_text('{"game": "A"}\n\n{"game": "B"}\n', encoding="utf-8")

            self.assertEqual(count_jsonl_records(path), 2)

    def test_retries_failed_scrape_twice_with_fixed_thirty_second_delays(self):
        store = Mock()
        store.seller_baseline.return_value = (7, 100, "2026-09-08T01:00:00+00:00")
        store.start_run.return_value = 11
        store.start_attempt.side_effect = [21, 22, 23]
        store.updated_counts.return_value = (98, 120)

        export_failures = iter([1, 1, 0])

        def run_command(command, **_kwargs):
            if any("export_csv" in item for item in command):
                csv_path = Path(command[command.index("-o") + 1])
                if next(export_failures):
                    return Mock(returncode=1)
                csv_path.write_text("game,account capacity 1\n" + "Game A,100\n" * 98, encoding="utf-8")
            return Mock(returncode=0)

        sleeps = []
        with tempfile.TemporaryDirectory() as directory, patch(
            "gamexs_scraper.seller_runner.ScrapeRunStore", return_value=store
        ), patch("gamexs_scraper.seller_runner.subprocess.run", side_effect=run_command):
            result = run_seller("pspro", "postgresql://example", directory, sleep_fn=sleeps.append)

        self.assertEqual(result, 0)
        self.assertEqual(sleeps, [30, 30])
        self.assertEqual(store.start_attempt.call_count, 3)
        store.finish_run.assert_called_once()


if __name__ == "__main__":
    unittest.main()
