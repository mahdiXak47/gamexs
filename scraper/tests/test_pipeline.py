import os
import sys
import unittest
from unittest.mock import patch

from gamexs_scraper import pipeline


class PipelineWithoutDatabaseTests(unittest.TestCase):
    """Bookkeeping is best-effort: no DB must never change what a step does."""

    def setUp(self):
        env = {k: v for k, v in os.environ.items() if k not in ("DATABASE_URL", pipeline.RUN_ENV, pipeline.STEP_ENV)}
        self.env = patch.dict(os.environ, env, clear=True)
        self.env.start()

    def tearDown(self):
        self.env.stop()

    def test_step_returns_the_command_exit_code(self):
        self.assertEqual(pipeline.main(["step", "x", "--", sys.executable, "-c", "raise SystemExit(3)"]), 3)
        self.assertEqual(pipeline.main(["step", "x", "--", sys.executable, "-c", "pass"]), 0)

    def test_start_prints_empty_run_id_and_succeeds(self):
        self.assertIsNone(pipeline.start(["a", "b"]))

    def test_report_progress_is_a_no_op_outside_a_step(self):
        pipeline.report_progress(1, 2, "x", force=True)


if __name__ == "__main__":
    unittest.main()
