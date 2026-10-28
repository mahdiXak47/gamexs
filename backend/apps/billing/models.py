"""CPC billing: stores pay per valid click GameXS sends them (docs/REVENUE_PROPOSAL.md).

Click validity (is this a real customer?) lives on outbound_clicks; billing
(free, discounted, charged, over the cap) lives here. Money is whole toman.
Issued invoices never change: corrections are new LedgerEntry rows.
Foreign keys to the scraper-owned `sellers` table carry no DB constraint, so
the test database (which has no scraper tables) can still build these tables.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.catalog.models import Seller

_SELLER = {"to": Seller, "on_delete": models.PROTECT, "db_constraint": False}


class OutboundClick(models.Model):
    """outbound_clicks (db/migrations/034, 042, 043), written by the frontend's /go page."""

    VALIDITY = [(v, v) for v in ("pending", "valid", "duplicate", "suspicious", "invalid", "unverifiable")]

    seller = models.ForeignKey(related_name="+", **_SELLER)
    listing_id = models.IntegerField(null=True)
    game_id = models.IntegerField()
    product_type = models.CharField(max_length=32)
    tier = models.CharField(max_length=32, null=True)
    price_toman = models.BigIntegerField(null=True)
    visitor_hash = models.TextField()
    referrer = models.TextField(null=True)
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(null=True)
    clicked_at = models.DateTimeField()
    validity = models.CharField(max_length=16, choices=VALIDITY, default="pending")
    validity_reason = models.TextField(null=True, blank=True)
    classified_at = models.DateTimeField(null=True)
    reviewed_by = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = "outbound_clicks"
        ordering = ["-clicked_at"]

    def __str__(self):
        return f"click {self.pk}"


class StoreAgreement(models.Model):
    """A store's commercial terms from `effective_from` on. A newer row replaces
    the older one for later clicks; stores without one pay BILLING_BASE_CPC_TOMAN."""

    STATUS = [("pilot", "Pilot"), ("active", "Active"), ("paused", "Paused"), ("ended", "Ended")]

    seller = models.ForeignKey(related_name="billing_agreements", **_SELLER)
    base_cpc_toman = models.PositiveIntegerField(null=True, blank=True, help_text="Empty = the global BILLING_BASE_CPC_TOMAN.")
    monthly_spend_cap_toman = models.PositiveBigIntegerField(null=True, blank=True, help_text="Empty = no cap.")
    status = models.CharField(max_length=8, choices=STATUS, default="pilot")
    effective_from = models.DateTimeField()
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["seller_id", "-effective_from"]
        constraints = [models.UniqueConstraint(fields=["seller", "effective_from"], name="billing_agreement_once_per_moment")]

    def __str__(self):
        return f"{self.seller_id} from {self.effective_from:%Y-%m-%d}"


class Campaign(models.Model):
    """A promotion. per_click: covers each valid click (the first `click_allowance`
    of them, if set) at `percent` off; 100% = free clicks. total: `percent` off
    an invoice's amount after per-click discounts."""

    PER_CLICK, TOTAL = "per_click", "total"
    METHODS = [(PER_CLICK, "Discount per click"), (TOTAL, "Discount on the invoice total")]

    name = models.CharField(max_length=200)
    sellers = models.ManyToManyField(Seller, related_name="+", db_constraint=False)
    method = models.CharField(max_length=10, choices=METHODS)
    percent = models.PositiveSmallIntegerField(help_text="10–100. 100 makes the covered clicks free.")
    click_allowance = models.PositiveIntegerField(null=True, blank=True, help_text="per_click only: clicks covered per store. Empty = every click in the dates.")
    discount_budget_toman = models.PositiveBigIntegerField(null=True, blank=True, help_text="Most discount this campaign may give per store. Empty = no limit.")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    exclusive = models.BooleanField(default=False, help_text="When it applies, no other campaign applies to the same invoice.")
    priority = models.IntegerField(default=0, help_text="Higher goes first.")

    class Meta:
        ordering = ["-priority", "starts_at"]
        constraints = [
            models.CheckConstraint(condition=Q(percent__gte=10, percent__lte=100), name="billing_campaign_percent_10_100"),
            models.CheckConstraint(condition=Q(ends_at__isnull=True) | Q(ends_at__gt=models.F("starts_at")), name="billing_campaign_dates"),
        ]

    def __str__(self):
        return self.name


class Invoice(models.Model):
    """One store, one Jalali month. Drafts are rebuilt freely; issued ones are frozen."""

    STATUS = [("draft", "Draft"), ("issued", "Issued"), ("paid", "Paid"), ("void", "Void")]
    FROZEN = (
        "seller_id", "period", "raw_clicks", "valid_clicks", "billable_clicks", "free_clicks", "discounted_clicks",
        "over_cap_clicks", "gross_toman", "per_click_discount_toman", "total_discount_toman", "payable_toman", "rules",
    )

    seller = models.ForeignKey(related_name="billing_invoices", **_SELLER)
    period = models.CharField(max_length=7, help_text="Jalali month, e.g. 1405-08.")
    status = models.CharField(max_length=6, choices=STATUS, default="draft")
    raw_clicks = models.PositiveIntegerField(default=0)
    valid_clicks = models.PositiveIntegerField(default=0)
    invalid_clicks = models.JSONField(default=dict, help_text="Count per validity other than valid.")
    billable_clicks = models.PositiveIntegerField(default=0)
    free_clicks = models.PositiveIntegerField(default=0)
    discounted_clicks = models.PositiveIntegerField(default=0)
    over_cap_clicks = models.PositiveIntegerField(default=0)
    gross_toman = models.BigIntegerField(default=0)
    per_click_discount_toman = models.BigIntegerField(default=0)
    total_discount_toman = models.BigIntegerField(default=0)
    total_campaign = models.ForeignKey(Campaign, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    payable_toman = models.BigIntegerField(default=0)
    rules = models.JSONField(default=dict, help_text="The BILLING settings the invoice was priced with.")
    created_at = models.DateTimeField(auto_now_add=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-period", "seller_id"]
        constraints = [
            models.UniqueConstraint(fields=["seller", "period"], condition=~Q(status="void"), name="billing_invoice_one_per_period"),
            models.CheckConstraint(condition=Q(payable_toman__gte=0), name="billing_invoice_payable_not_negative"),
        ]

    def __str__(self):
        return f"{self.seller_id} {self.period} ({self.status})"

    def save(self, *args, **kwargs):
        if self.pk:
            old = Invoice.objects.filter(pk=self.pk).values(*self.FROZEN, "status").first()
            if old and old["status"] != "draft" and any(old[f] != getattr(self, f) for f in self.FROZEN):
                raise ValidationError("An issued invoice cannot change; add an adjustment instead.")
        super().save(*args, **kwargs)


class InvoiceLine(models.Model):
    """Clicks priced the same way (rate, campaign, percent off), rounded once."""

    KIND = [("charged", "Charged"), ("free", "Free"), ("discounted", "Discounted"), ("over_cap", "Over spending cap")]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    kind = models.CharField(max_length=10, choices=KIND)
    campaign = models.ForeignKey(Campaign, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    clicks = models.PositiveIntegerField()
    base_rate_toman = models.PositiveIntegerField()
    percent_off = models.PositiveSmallIntegerField(default=0)
    gross_toman = models.BigIntegerField()
    discount_toman = models.BigIntegerField()
    amount_toman = models.BigIntegerField()

    class Meta:
        ordering = ["id"]
        constraints = [models.CheckConstraint(condition=Q(amount_toman__gte=0), name="billing_line_amount_not_negative")]


class ClickCharge(models.Model):
    """Which line each valid click was priced on. A click is on one live invoice at most."""

    click_id = models.BigIntegerField()
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="click_charges")
    line = models.ForeignKey(InvoiceLine, on_delete=models.CASCADE, related_name="click_charges")
    campaign = models.ForeignKey(Campaign, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    live = models.BooleanField(default=True, help_text="False once the invoice is void, so the click can be billed again.")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["click_id"], condition=Q(live=True), name="billing_click_billed_once")]


class LedgerEntry(models.Model):
    """Append-only money movements. Positive = the store owes GameXS, negative =
    GameXS owes / was paid. Balance = sum. Promo credit is kept apart from paid money."""

    KIND = [("charge", "Invoice charge"), ("payment", "Payment received"), ("adjustment", "Adjustment"), ("promo_credit", "Promotional credit")]

    seller = models.ForeignKey(related_name="billing_ledger", **_SELLER)
    kind = models.CharField(max_length=12, choices=KIND)
    amount_toman = models.BigIntegerField()
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.PROTECT, related_name="ledger_entries")
    note = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "ledger entries"

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Ledger entries are append-only; add a new adjustment instead.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Ledger entries are append-only.")


class BillingAudit(models.Model):
    """Before/after of every change to agreements, campaigns, adjustments and reviews."""

    model = models.CharField(max_length=64)
    object_id = models.CharField(max_length=64)
    action = models.CharField(max_length=16)
    before = models.JSONField(null=True)
    after = models.JSONField(null=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-at"]


class StoreMember(models.Model):
    """Gives a GameXS account read access to one store's reports in the store portal."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="store_membership")
    seller = models.ForeignKey(related_name="+", **_SELLER)

    def __str__(self):
        return f"{self.user} → {self.seller_id}"
