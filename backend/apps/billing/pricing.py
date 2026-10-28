"""Discount engine: price one store's valid clicks for one billing period.

Pure: the same inputs always give the same invoice, so an invoice can be
re-derived during a dispute. Order (owner decision, 2026-10-29):
  1. Each click takes the first per-click campaign (priority desc, then start)
     that is running at the click and still has allowance and budget.
  2. Clicks that would push the period's charges past the spending cap are
     recorded as over_cap and not charged.
  3. One total-amount campaign (the highest priority) then takes its percent
     off what is left, up to its remaining budget.
  An `exclusive` campaign running in the period is then the only campaign used.
Clicks priced the same way form one line, rounded once, half up, to toman.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

PER_CLICK, TOTAL = "per_click", "total"


@dataclass
class Terms:
    """A store agreement: rate (None = the default rate) and cap from `effective_from` on."""

    effective_from: dt.datetime
    base_cpc_toman: int | None
    monthly_spend_cap_toman: int | None


@dataclass
class CampaignState:
    id: int
    method: str
    percent: int
    starts_at: dt.datetime
    ends_at: dt.datetime | None = None
    click_allowance: int | None = None
    discount_budget_toman: int | None = None
    exclusive: bool = False
    priority: int = 0
    used_clicks: int = 0  # by this store on earlier live invoices
    used_discount: Decimal = Decimal(0)

    def running_at(self, moment: dt.datetime) -> bool:
        return self.starts_at <= moment and (self.ends_at is None or moment < self.ends_at)

    def overlaps(self, start: dt.datetime, end: dt.datetime) -> bool:
        return self.starts_at < end and (self.ends_at is None or self.ends_at > start)

    def budget_left(self) -> Decimal | None:
        return None if self.discount_budget_toman is None else Decimal(self.discount_budget_toman) - self.used_discount


@dataclass
class Line:
    kind: str  # charged | free | discounted | over_cap
    campaign_id: int | None
    base_rate_toman: int
    percent_off: int
    click_ids: list[int] = field(default_factory=list)
    gross_toman: int = 0
    discount_toman: int = 0
    amount_toman: int = 0


@dataclass
class Priced:
    lines: list[Line]
    gross_toman: int
    per_click_discount_toman: int
    subtotal_toman: int
    total_campaign_id: int | None
    total_discount_toman: int
    payable_toman: int

    def count(self, *kinds: str) -> int:
        return sum(len(line.click_ids) for line in self.lines if line.kind in kinds)


def _round(amount: Decimal) -> int:
    return int(amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _terms_at(terms: list[Terms], moment: dt.datetime) -> Terms | None:
    current = [t for t in terms if t.effective_from <= moment]
    return max(current, key=lambda t: t.effective_from) if current else None


def price_period(
    clicks: list[tuple[int, dt.datetime]],
    terms: list[Terms],
    campaigns: list[CampaignState],
    default_cpc_toman: int,
    period_start: dt.datetime,
    period_end: dt.datetime,
) -> Priced:
    """`clicks` are the store's billable (valid) clicks in the period as (id, clicked_at)."""
    running = sorted(
        (c for c in campaigns if c.overlaps(period_start, period_end)), key=lambda c: (-c.priority, c.starts_at, c.id)
    )
    exclusive = next((c for c in running if c.exclusive), None)
    if exclusive:
        running = [exclusive]
    per_click = [c for c in running if c.method == PER_CLICK]
    totals = [c for c in running if c.method == TOTAL]

    last_terms = _terms_at(terms, period_end - dt.timedelta(microseconds=1))
    cap = last_terms.monthly_spend_cap_toman if last_terms else None

    groups: dict[tuple, Line] = {}
    exact_charges = Decimal(0)
    for click_id, clicked_at in sorted(clicks, key=lambda c: (c[1], c[0])):
        at = _terms_at(terms, clicked_at)
        base = at.base_cpc_toman if at and at.base_cpc_toman is not None else default_cpc_toman

        campaign = None
        for c in per_click:
            discount = Decimal(base * c.percent) / 100
            left = c.budget_left()
            if c.running_at(clicked_at) and (c.click_allowance is None or c.used_clicks < c.click_allowance) and (left is None or left >= discount):
                campaign = c
                break
        percent = campaign.percent if campaign else 0
        charge = Decimal(base * (100 - percent)) / 100

        if cap is not None and charge and exact_charges + charge > cap:
            key = ("over_cap", None, base, 0)
        else:
            exact_charges += charge
            if campaign:
                campaign.used_clicks += 1
                campaign.used_discount += Decimal(base * percent) / 100
            kind = "charged" if not campaign else "free" if percent == 100 else "discounted"
            key = (kind, campaign.id if campaign else None, base, percent)
        groups.setdefault(key, Line(*key)).click_ids.append(click_id)

    for line in groups.values():
        if line.kind == "over_cap":
            continue
        line.gross_toman = line.base_rate_toman * len(line.click_ids)
        line.amount_toman = _round(Decimal(line.gross_toman * (100 - line.percent_off)) / 100)
        line.discount_toman = line.gross_toman - line.amount_toman

    lines = list(groups.values())
    gross = sum(line.gross_toman for line in lines)
    subtotal = sum(line.amount_toman for line in lines)

    total_campaign, total_discount = None, 0
    for c in totals:
        left = c.budget_left()
        if left is not None and left <= 0:
            continue
        exact = Decimal(subtotal * c.percent) / 100
        total_campaign, total_discount = c, _round(min(exact, left) if left is not None else exact)
        c.used_discount += total_discount
        break

    return Priced(
        lines=lines,
        gross_toman=gross,
        per_click_discount_toman=gross - subtotal,
        subtotal_toman=subtotal,
        total_campaign_id=total_campaign.id if total_campaign else None,
        total_discount_toman=total_discount,
        payable_toman=max(0, subtotal - total_discount),
    )
