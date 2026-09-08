"""Policy helpers for reliable per-seller scrape execution."""

from __future__ import annotations

from dataclasses import dataclass


DEFAULT_MAX_ATTEMPTS = 3
DEFAULT_RETRY_DELAY_SECONDS = 30
DEFAULT_MAX_GAME_COUNT_DROP = 0.5


@dataclass(frozen=True)
class GameCountResult:
    healthy: bool
    reason: str


def retry_delays(attempts: int, delay_seconds: int) -> list[int]:
    """Return one fixed delay for every retry after the first attempt."""
    if attempts < 1:
        raise ValueError("attempts must be positive")
    if delay_seconds < 0:
        raise ValueError("delay_seconds cannot be negative")
    return [delay_seconds] * (attempts - 1)


def evaluate_game_count(
    observed_games: int,
    previous_games: int | None,
    max_drop: float = DEFAULT_MAX_GAME_COUNT_DROP,
) -> GameCountResult:
    """Reject empty or unexpectedly incomplete seller snapshots.

    A result exactly at the configured boundary is accepted. The first run is
    accepted when it contains at least one game because there is no baseline
    for comparison yet.
    """
    if observed_games <= 0:
        return GameCountResult(False, "scrape returned zero games")
    if previous_games and observed_games < previous_games * (1 - max_drop):
        return GameCountResult(
            False,
            f"game count dropped from {previous_games} games to {observed_games}",
        )
    return GameCountResult(True, "game count is within the expected range")


def build_failure_alert(
    seller: str,
    attempts: int,
    reason: str,
    previous_success: str | None,
    observed_games: int | None,
) -> str:
    """Build a compact operator-facing alert for Telegram or another channel."""
    last_success = previous_success or "never"
    games = str(observed_games) if observed_games is not None else "unknown"
    return (
        "🚨 GameXS scraper alert\n"
        f"Shop: {seller}\n"
        f"Attempts: {attempts}\n"
        f"Observed games: {games}\n"
        f"Reason: {reason}\n"
        f"Last successful run: {last_success}\n"
        "Action: inspect the shop adapter, access, proxy, and source site."
    )
