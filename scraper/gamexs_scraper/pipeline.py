"""Pipeline run/step bookkeeping read by the admin panel (migration 033).

scrape_all.sh drives it:

    export GAMEXS_PIPELINE_RUN_ID=$(python -m gamexs_scraper.pipeline start pspro digikala … psstore)
    python -m gamexs_scraper.pipeline step pspro -- python -m gamexs_scraper.seller_runner pspro
    python -m gamexs_scraper.pipeline skip cleanup "seller failures"
    python -m gamexs_scraper.pipeline finish failed "pspro/digikala"

`step` runs the command, passes its output through unchanged, and records
status, exit code, a heartbeat and the last log lines. Code inside a step calls
report_progress() for done/total counts.

Bookkeeping is best-effort: every DB error is printed and ignored, so a
monitoring problem never fails or blocks a scrape.
"""
from __future__ import annotations

import collections
import os
import subprocess
import sys
import threading
import time

import psycopg

RUN_ENV = "GAMEXS_PIPELINE_RUN_ID"
STEP_ENV = "GAMEXS_PIPELINE_STEP_ID"
FLUSH_SECONDS = 10
LOG_LINES = 200


def _connect() -> psycopg.Connection | None:
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    try:
        # Keepalives + statement timeout: a silently dropped TCP connection must
        # fail fast instead of hanging a best-effort bookkeeping write forever
        # (on 2026-10-22 a run's steps froze at 11:25 while the cycle went on).
        # ponytail: a dead connection still loses the rest of that run's
        # bookkeeping; reconnect per write if this recurs.
        return psycopg.connect(
            url, autocommit=True, connect_timeout=5,
            keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=3,
            options="-c statement_timeout=15000",
        )
    except psycopg.Error as exc:
        print(f"[pipeline] bookkeeping disabled: {exc}", file=sys.stderr, flush=True)
        return None


def _execute(conn: psycopg.Connection | None, sql: str, params: tuple = ()) -> tuple | None:
    if conn is None:
        return None
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone() if cur.description else None
    except psycopg.Error as exc:
        print(f"[pipeline] bookkeeping write failed: {exc}", file=sys.stderr, flush=True)
        return None


def start(step_names: list[str]) -> int | None:
    conn = _connect()
    # A pod restart kills a run without finishing it; close those out first.
    _execute(conn, "UPDATE pipeline_steps SET status = 'abandoned', completed_at = now() WHERE status IN ('running', 'queued')")
    _execute(conn, "UPDATE pipeline_runs SET status = 'abandoned', completed_at = now() WHERE status = 'running'")
    row = _execute(conn, "INSERT INTO pipeline_runs (status) VALUES ('running') RETURNING id")
    if not row:
        return None
    run_id = int(row[0])
    for position, name in enumerate(step_names):
        _execute(
            conn,
            "INSERT INTO pipeline_steps (pipeline_run_id, name, position, status) VALUES (%s, %s, %s, 'queued')",
            (run_id, name, position),
        )
    return run_id


def finish(status: str, summary: str | None) -> None:
    run_id = os.environ.get(RUN_ENV)
    if run_id:
        _execute(
            _connect(),
            "UPDATE pipeline_runs SET status = %s, summary = %s, completed_at = now() WHERE id = %s",
            (status, summary or None, int(run_id)),
        )


def skip(name: str, message: str) -> None:
    run_id = os.environ.get(RUN_ENV)
    if run_id:
        _execute(
            _connect(),
            "UPDATE pipeline_steps SET status = 'skipped', message = %s, completed_at = now() "
            "WHERE pipeline_run_id = %s AND name = %s",
            (message, int(run_id), name),
        )


def run_step(name: str, command: list[str]) -> int:
    run_id = os.environ.get(RUN_ENV)
    conn = _connect() if run_id else None
    step_id = None
    if conn is not None:
        # Expected total = what the last successful run of this step reached;
        # report_progress() overrides it when the step knows the real total.
        row = _execute(
            conn,
            """
            UPDATE pipeline_steps
            SET status = 'running', started_at = now(), heartbeat_at = now(),
                progress_done = 0,
                progress_total = (
                    SELECT progress_done FROM pipeline_steps prev
                    WHERE prev.name = %s AND prev.status = 'succeeded' AND prev.progress_done > 0
                    ORDER BY prev.completed_at DESC LIMIT 1
                )
            WHERE pipeline_run_id = %s AND name = %s
            RETURNING id
            """,
            (name, int(run_id), name),
        )
        step_id = row[0] if row else None

    env = dict(os.environ)
    if step_id is not None:
        env[STEP_ENV] = str(step_id)

    tail: collections.deque[str] = collections.deque(maxlen=LOG_LINES)
    lock = threading.Lock()
    done = threading.Event()

    def flush() -> None:
        with lock:
            text = "".join(tail)
        _execute(
            conn,
            "UPDATE pipeline_steps SET log_tail = %s, heartbeat_at = now() WHERE id = %s",
            (text, step_id),
        )

    def heartbeat() -> None:
        while not done.wait(FLUSH_SECONDS):
            flush()

    proc = subprocess.Popen(command, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    beater = threading.Thread(target=heartbeat, daemon=True) if step_id is not None else None
    if beater:
        beater.start()
    assert proc.stdout is not None
    for line in proc.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
        with lock:
            # Carriage-return progress lines (\r[ 12/300]) would bloat the tail.
            tail.append(line.rsplit("\r", 1)[-1])
    code = proc.wait()
    done.set()
    if step_id is not None:
        flush()
        _execute(
            conn,
            "UPDATE pipeline_steps SET status = %s, exit_code = %s, completed_at = now() WHERE id = %s",
            ("succeeded" if code == 0 else "failed", code, step_id),
        )
    if code != 0 and os.environ.get("SENTRY_DSN"):
        import sentry_sdk  # initialised by the package when SENTRY_DSN is set

        with sentry_sdk.new_scope() as scope:
            scope.set_tag("pipeline_step", name)
            scope.set_context("step", {"exit_code": code, "log_tail": "".join(tail)[-4000:]})
            scope.fingerprint = ["pipeline-step-failed", name]
            sentry_sdk.capture_message(f"pipeline step {name} failed (exit {code})", level="error")
        sentry_sdk.flush(timeout=5)
    return code


_last_report = 0.0
_progress_conn: psycopg.Connection | None = None


def report_progress(done: int, total: int | None = None, message: str | None = None, force: bool = False) -> None:
    """Record done/total for the current step; throttled, no-op outside a pipeline step."""
    global _last_report, _progress_conn
    step_id = os.environ.get(STEP_ENV)
    now = time.monotonic()
    if not step_id or (not force and now - _last_report < 5):
        return
    _last_report = now
    if _progress_conn is None or _progress_conn.closed:
        _progress_conn = _connect()
    _execute(
        _progress_conn,
        """
        UPDATE pipeline_steps
        SET progress_done = %s,
            progress_total = COALESCE(%s, progress_total),
            message = COALESCE(%s, message),
            heartbeat_at = now()
        WHERE id = %s
        """,
        (done, total, message, int(step_id)),
    )


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__, file=sys.stderr)
        return 2
    command, args = argv[0], argv[1:]
    if command == "start":
        run_id = start(args)
        print(run_id or "")
        return 0
    if command == "step" and len(args) >= 3 and args[1] == "--":
        return run_step(args[0], args[2:])
    if command == "skip" and args:
        skip(args[0], " ".join(args[1:]))
        return 0
    if command == "finish" and args:
        finish(args[0], " ".join(args[1:]))
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
