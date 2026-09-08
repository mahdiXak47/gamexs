import unittest
from datetime import datetime, timezone
from unittest.mock import Mock

from gamexs_scraper.catalog_merge import merge_game_relations


class CatalogMergeTests(unittest.TestCase):
    def test_reconciles_duplicate_listing_history_and_moves_free_aliases(self):
        cursor = Mock()
        cursor.fetchall.side_effect = [
            [(
                11,
                3,
                "https://seller.example/game",
                "DISC",
                None,
                True,
                datetime(2026, 1, 1, tzinfo=timezone.utc),
                datetime(2026, 2, 1, tzinfo=timezone.utc),
            )],
            [(31, 167, "example game")],
        ]
        cursor.fetchone.side_effect = [(21,), None]

        result = merge_game_relations(cursor, source_game_id=1, target_game_id=2)

        self.assertEqual(result, (0, 1, 1))
        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("INSERT INTO price_history" in statement for statement in statements))
        self.assertTrue(any("DELETE FROM listings" in statement for statement in statements))
        self.assertTrue(any("UPDATE ps5_game_aliases SET game_id" in statement for statement in statements))


if __name__ == "__main__":
    unittest.main()
