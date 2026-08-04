from __future__ import annotations

import os
from dataclasses import dataclass


DEFAULT_SELLER_PAIRS: tuple[tuple[str, ...], ...] = (
    ("pspro", "digikala"),
    ("gamario", "gameonestore"),
    ("gamecenter", "gameplayshop"),
    ("xgamesstore", "nakhlmarket"),
    ("parsconsole", "cdkeyshare"),
    ("persianconsole", "yungcenter"),
    ("technolife",),
)


@dataclass(frozen=True)
class TemporalSettings:
    address: str
    sellers_namespace: str
    metadata_namespace: str
    sellers_task_queue: str
    metadata_task_queue: str
    artifact_prefix: str
    psstore_workers: int
    max_activity_workers: int


def settings_from_env() -> TemporalSettings:
    return TemporalSettings(
        address=os.environ.get("TEMPORAL_ADDRESS", "localhost:7233"),
        sellers_namespace=os.environ.get("TEMPORAL_SELLERS_NAMESPACE", "gamexs-sellers"),
        metadata_namespace=os.environ.get("TEMPORAL_METADATA_NAMESPACE", "gamexs-metadata"),
        sellers_task_queue=os.environ.get("TEMPORAL_SELLERS_TASK_QUEUE", "gamexs-seller-scrapers"),
        metadata_task_queue=os.environ.get("TEMPORAL_METADATA_TASK_QUEUE", "gamexs-metadata"),
        artifact_prefix=os.environ.get("SCRAPER_RUN_ARTIFACT_PREFIX", "scraper-runs"),
        psstore_workers=int(os.environ.get("PSSTORE_WORKERS", "4")),
        max_activity_workers=int(os.environ.get("SCRAPER_MAX_ACTIVITY_WORKERS", "8")),
    )
