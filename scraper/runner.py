"""Run the GameXS scrape pipeline on a configurable recurring interval.

The pipeline itself remains one-shot and is responsible for its own failure
reporting. This process supplies the long-lived scheduling contract needed by
the production scraper Deployment.
"""

from __future__ import annotations

import os
from pathlib import Path
import signal
import subprocess
import sys
from threading import Event


DEFAULT_INTERVAL_SECONDS = 24 * 60 * 60
INTERVAL_ENV = "SCRAPER_INTERVAL_SECONDS"
PIPELINE_SCRIPT = Path(__file__).with_name("scrape_all.sh")


def interval_seconds(environ: dict[str, str] | None = None) -> int:
    """Return a positive run interval from environment configuration."""
    values = os.environ if environ is None else environ
    raw_value = values.get(INTERVAL_ENV, str(DEFAULT_INTERVAL_SECONDS))
    try:
        value = int(raw_value)
    except ValueError as exc:
        raise ValueError(f"{INTERVAL_ENV} must be a positive integer") from exc
    if value <= 0:
        raise ValueError(f"{INTERVAL_ENV} must be a positive integer")
    return value


def _terminate_process_group(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except (AttributeError, ProcessLookupError, PermissionError):
        process.terminate()


def main() -> int:
    try:
        interval = interval_seconds()
    except ValueError as exc:
        print(f"runner configuration error: {exc}", file=sys.stderr)
        return 2

    stop_event = Event()
    process: subprocess.Popen[bytes] | None = None

    def stop(_signum: int, _frame: object) -> None:
        stop_event.set()
        if process is not None:
            print("shutdown requested; stopping current scrape", flush=True)
            _terminate_process_group(process)

    previous_handlers = {
        signum: signal.getsignal(signum)
        for signum in (signal.SIGINT, signal.SIGTERM)
    }
    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)

    try:
        while not stop_event.is_set():
            print("starting scheduled scrape", flush=True)
            process = subprocess.Popen(
                ["bash", str(PIPELINE_SCRIPT)],
                cwd=PIPELINE_SCRIPT.parent,
                start_new_session=True,
            )
            return_code = process.wait()
            process = None

            if stop_event.is_set():
                break
            if return_code == 0:
                print("scrape completed successfully", flush=True)
            else:
                print(f"scrape failed with exit code {return_code}; retrying later", flush=True)

            print(f"waiting {interval} seconds before the next scrape", flush=True)
            stop_event.wait(interval)
    finally:
        if process is not None:
            _terminate_process_group(process)
            process.wait()
        for signum, handler in previous_handlers.items():
            signal.signal(signum, handler)

    print("scraper runner stopped", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
