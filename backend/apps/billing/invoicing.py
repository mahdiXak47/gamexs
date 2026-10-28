"""Postpaid invoices: one per store per Jalali month.

draft_period() classifies the month's clicks and (re)builds a draft invoice for
every store that received clicks; issue() freezes a draft and books the charge;
mark_paid() / void() / add_adjustment() only ever add ledger entries.
Draft months in order: a campaign's allowance and budget used by earlier,
non-void invoices are carried into later ones.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.common.jalali import period_bounds

from .classify import classify_range
from .models import Campaign, ClickCharge, Invoice, InvoiceLine, LedgerEntry, OutboundClick, StoreAgreement
from .pricing import CampaignState, Terms, price_period


def _campaign_states(seller_id: int, period: str) -> list[CampaignState]:
    earlier = {"invoice__seller_id": seller_id, "invoice__period__lt": period}
    states = []
    for c in Campaign.objects.filter(is_active=True, sellers__id=seller_id):
        if c.method == Campaign.PER_CLICK:
            used_clicks = ClickCharge.objects.filter(campaign=c, live=True, **earlier).count()
            used = InvoiceLine.objects.filter(campaign=c, **earlier).exclude(invoice__status="void").aggregate(s=Sum("discount_toman"))["s"]
        else:
            used_clicks = 0
            used = (
                Invoice.objects.filter(total_campaign=c, seller_id=seller_id, period__lt=period)
                .exclude(status="void").aggregate(s=Sum("total_discount_toman"))["s"]
            )
        states.append(CampaignState(
            id=c.id, method=c.method, percent=c.percent, starts_at=c.starts_at, ends_at=c.ends_at,
            click_allowance=c.click_allowance, discount_budget_toman=c.discount_budget_toman,
            exclusive=c.exclusive, priority=c.priority, used_clicks=used_clicks, used_discount=Decimal(used or 0),
        ))
    return states


def _terms(seller_id: int) -> list[Terms]:
    return [
        Terms(a.effective_from, a.base_cpc_toman, a.monthly_spend_cap_toman)
        for a in StoreAgreement.objects.filter(seller_id=seller_id)
    ]


@transaction.atomic
def draft_invoice(seller_id: int, period: str) -> Invoice | None:
    """Rebuild one store's draft for `period` (clicks must already be classified).
    Returns None when that month is already issued, paid or has no clicks."""
    rules = settings.BILLING
    start, end = period_bounds(period)
    if Invoice.objects.filter(seller_id=seller_id, period=period).exclude(status__in=("draft", "void")).exists():
        return None
    Invoice.objects.filter(seller_id=seller_id, period=period, status="draft").delete()

    in_period = OutboundClick.objects.filter(seller_id=seller_id, clicked_at__gte=start, clicked_at__lt=end)
    by_validity = Counter(in_period.values_list("validity", flat=True))
    if not by_validity:
        return None
    billable = ["valid", "suspicious"] if rules["SUSPICIOUS_BILLABLE"] else ["valid"]
    already_billed = ClickCharge.objects.filter(live=True).values("click_id")
    clicks = list(in_period.filter(validity__in=billable).exclude(id__in=already_billed).values_list("id", "clicked_at"))

    priced = price_period(clicks, _terms(seller_id), _campaign_states(seller_id, period), rules["BASE_CPC_TOMAN"], start, end)
    invoice = Invoice.objects.create(
        seller_id=seller_id,
        period=period,
        raw_clicks=sum(by_validity.values()),
        valid_clicks=by_validity.get("valid", 0),
        invalid_clicks={k: v for k, v in by_validity.items() if k != "valid"},
        billable_clicks=priced.count("charged", "discounted"),
        free_clicks=priced.count("free"),
        discounted_clicks=priced.count("discounted"),
        over_cap_clicks=priced.count("over_cap"),
        gross_toman=priced.gross_toman,
        per_click_discount_toman=priced.per_click_discount_toman,
        total_discount_toman=priced.total_discount_toman,
        total_campaign_id=priced.total_campaign_id,
        payable_toman=priced.payable_toman,
        rules=dict(rules),
    )
    for line in priced.lines:
        row = InvoiceLine.objects.create(
            invoice=invoice, kind=line.kind, campaign_id=line.campaign_id, clicks=len(line.click_ids),
            base_rate_toman=line.base_rate_toman, percent_off=line.percent_off,
            gross_toman=line.gross_toman, discount_toman=line.discount_toman, amount_toman=line.amount_toman,
        )
        ClickCharge.objects.bulk_create(
            ClickCharge(click_id=click_id, invoice=invoice, line=row, campaign_id=line.campaign_id) for click_id in line.click_ids
        )
    return invoice


def draft_period(period: str) -> list[Invoice]:
    """Classify the month's clicks, then draft every store that received any."""
    start, end = period_bounds(period)
    classify_range(start, end)
    seller_ids = OutboundClick.objects.filter(clicked_at__gte=start, clicked_at__lt=end).order_by().values_list("seller_id", flat=True).distinct()
    return [invoice for seller_id in seller_ids if (invoice := draft_invoice(seller_id, period))]


@transaction.atomic
def issue(invoice: Invoice, user=None) -> Invoice:
    if invoice.status != "draft":
        raise ValueError(f"only a draft can be issued (this one is {invoice.status})")
    invoice.status, invoice.issued_at = "issued", timezone.now()
    invoice.save()
    LedgerEntry.objects.create(seller_id=invoice.seller_id, kind="charge", amount_toman=invoice.payable_toman,
                               invoice=invoice, note=f"Invoice {invoice.period}", created_by=user)
    return invoice


@transaction.atomic
def mark_paid(invoice: Invoice, user=None, note: str = "") -> Invoice:
    if invoice.status != "issued":
        raise ValueError(f"only an issued invoice can be paid (this one is {invoice.status})")
    invoice.status, invoice.paid_at = "paid", timezone.now()
    invoice.save()
    LedgerEntry.objects.create(seller_id=invoice.seller_id, kind="payment", amount_toman=-invoice.payable_toman,
                               invoice=invoice, note=note or f"Payment for invoice {invoice.period}", created_by=user)
    return invoice


@transaction.atomic
def void(invoice: Invoice, user=None, note: str = "") -> Invoice:
    """Cancel an invoice; its clicks become billable again. A booked charge is
    reversed with an adjustment; a payment already received stays as credit."""
    if invoice.status == "void":
        return invoice
    if invoice.status in ("issued", "paid"):
        LedgerEntry.objects.create(seller_id=invoice.seller_id, kind="adjustment", amount_toman=-invoice.payable_toman,
                                   invoice=invoice, note=note or f"Invoice {invoice.period} voided", created_by=user)
    invoice.status = "void"
    invoice.save()
    invoice.click_charges.update(live=False)
    return invoice


def add_adjustment(seller_id: int, amount_toman: int, note: str, user=None, kind: str = "adjustment", invoice=None) -> LedgerEntry:
    if not note.strip():
        raise ValueError("an adjustment needs a note saying why")
    return LedgerEntry.objects.create(seller_id=seller_id, kind=kind, amount_toman=amount_toman, note=note, invoice=invoice, created_by=user)


def balance(seller_id: int) -> dict:
    """What the store owes (positive) or has in credit (negative); promo credit apart."""
    rows = dict(LedgerEntry.objects.filter(seller_id=seller_id).values_list("kind").annotate(s=Sum("amount_toman")))
    promo = rows.pop("promo_credit", 0) or 0
    return {"owed_toman": sum(v or 0 for v in rows.values()), "promo_credit_toman": -promo}
