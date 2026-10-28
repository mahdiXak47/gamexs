"""Click validity: is a recorded click a real, countable customer?

`classify` is pure (clicks in, verdicts out) so the rules are testable without
a database; `classify_range` runs it over outbound_clicks. Rules come from
settings.BILLING (environment). Staff-reviewed clicks keep their verdict.
"""

from __future__ import annotations

import datetime as dt
from collections import defaultdict, deque
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.common.jalali import TEHRAN


@dataclass(frozen=True)
class Click:
    id: int
    seller_id: int
    clicked_at: dt.datetime
    visitor_hash: str
    ip_address: str | None = None
    user_agent: str | None = None
    referrer: str | None = None
    listing_id: int | None = None
    reviewed: bool = False
    validity: str = "pending"

    @property
    def visitor(self) -> str:
        # IP + browser identifies a person across midnight; the daily visitor_hash
        # is the fallback once the 90-day cleanup has erased them.
        return f"ip:{self.ip_address}|{self.user_agent or ''}" if self.ip_address else f"hash:{self.visitor_hash}"


def classify(clicks: list[Click], rules: dict) -> dict[int, tuple[str, str | None]]:
    """{click id: (validity, reason)} for every click, in click order."""
    window = dt.timedelta(minutes=rules["DUPLICATE_WINDOW_MINUTES"])
    burst_window = dt.timedelta(seconds=rules["BURST_WINDOW_SECONDS"])
    last_valid: dict[tuple[str, int], dt.datetime] = {}
    per_day: dict[tuple[str, dt.date], int] = defaultdict(int)
    recent: dict[str, deque] = defaultdict(deque)
    verdicts: dict[int, tuple[str, str | None]] = {}

    for click in sorted(clicks, key=lambda c: (c.clicked_at, c.id)):
        visitor = click.visitor
        day = click.clicked_at.astimezone(TEHRAN).date()
        per_day[(visitor, day)] += 1
        times = recent[visitor]
        times.append(click.clicked_at)
        while times and click.clicked_at - times[0] > burst_window:
            times.popleft()

        if click.reviewed:
            verdict = (click.validity, "reviewed by staff")
        elif click.listing_id is None and not click.referrer:
            verdict = ("unverifiable", "listing removed and no referrer")
        elif per_day[(visitor, day)] > rules["MAX_CLICKS_PER_VISITOR_DAY"]:
            verdict = ("suspicious", f"more than {rules['MAX_CLICKS_PER_VISITOR_DAY']} clicks by this visitor today")
        elif len(times) >= rules["BURST_CLICKS"]:
            verdict = ("suspicious", f"{len(times)} clicks within {rules['BURST_WINDOW_SECONDS']}s")
        elif rules["REQUIRE_GAMEXS_REFERRER"] and not click.referrer:
            verdict = ("suspicious", "not opened from a GameXS page")
        elif (seen := last_valid.get((visitor, click.seller_id))) and click.clicked_at - seen < window:
            verdict = ("duplicate", f"repeat within {rules['DUPLICATE_WINDOW_MINUTES']} min")
        else:
            verdict = ("valid", None)

        if verdict[0] == "valid":
            last_valid[(visitor, click.seller_id)] = click.clicked_at
        verdicts[click.id] = verdict
    return verdicts


def classify_range(start: dt.datetime, end: dt.datetime, rules: dict | None = None, only_pending: bool = False) -> int:
    """Classify every click in [start, end). A day of history before `start` is
    read (not rewritten) so windows and daily counts carry over the boundary."""
    from .models import OutboundClick

    rules = rules or settings.BILLING
    rows = OutboundClick.objects.filter(clicked_at__gte=start - dt.timedelta(days=1), clicked_at__lt=end).values(
        "id", "seller_id", "clicked_at", "visitor_hash", "ip_address", "user_agent", "referrer", "listing_id", "reviewed_by", "validity"
    )
    clicks = [
        Click(
            id=r["id"], seller_id=r["seller_id"], clicked_at=r["clicked_at"], visitor_hash=r["visitor_hash"],
            ip_address=r["ip_address"], user_agent=r["user_agent"], referrer=r["referrer"], listing_id=r["listing_id"],
            reviewed=r["reviewed_by"] is not None, validity=r["validity"],
        )
        for r in rows
    ]
    current = {c.id: c.validity for c in clicks if c.clicked_at >= start and not c.reviewed}
    if only_pending:
        current = {k: v for k, v in current.items() if v == "pending"}
    verdicts = classify(clicks, rules)
    now = timezone.now()
    groups: dict[tuple[str, str | None], list[int]] = defaultdict(list)
    for click_id in current:
        groups[verdicts[click_id]].append(click_id)
    with transaction.atomic():
        for (validity, reason), ids in groups.items():
            OutboundClick.objects.filter(pk__in=ids).update(validity=validity, validity_reason=reason, classified_at=now)
    return len(current)
