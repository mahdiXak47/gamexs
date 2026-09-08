import unittest

from gamexs_scraper.catalog_audit import audit_games


class CatalogAuditTests(unittest.TestCase):
    def test_reports_invariant_violations_and_review_candidates(self):
        games = [
            (1, 101, "Hades", "hades"),
            (2, None, "Deluxe Edition", "deluxe-edition"),
            (3, 102, "Hades", "hades-2"),
            (4, 101, "Hades Deluxe Edition", "hades-deluxe"),
            (5, 103, "بازی فارسی", "persian"),
        ]

        report = audit_games(games)

        self.assertEqual(report.total_games, 5)
        self.assertEqual(report.null_igdb_ids, 1)
        self.assertEqual(report.non_ascii_titles, 1)
        self.assertEqual(report.duplicate_igdb_groups, 1)
        self.assertEqual(report.special_without_igdb, 1)
        self.assertEqual(report.cross_igdb_title_collisions, 1)
        self.assertFalse(report.is_clean)

    def test_clean_catalog_has_no_review_candidates(self):
        report = audit_games([
            (1, 101, "Hades", "hades"),
            (2, 102, "Hades II", "hades-2"),
        ])

        self.assertTrue(report.is_clean)
        self.assertEqual(report.cross_igdb_title_collisions, 0)


if __name__ == "__main__":
    unittest.main()
