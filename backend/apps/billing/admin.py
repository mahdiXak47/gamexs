from django import forms
from django.contrib import admin, messages
from django.core.serializers.json import DjangoJSONEncoder
from django.forms.models import model_to_dict
from django.shortcuts import redirect, render
from django.urls import path
from django.utils import timezone
import json

from apps.common.jalali import period_of, previous_period

from . import invoicing
from .models import (
    BillingAudit, Campaign, ClickCharge, Invoice, InvoiceLine, LedgerEntry, OutboundClick, StoreAgreement, StoreMember,
)


def _snapshot(obj) -> dict:
    data = model_to_dict(obj)
    return json.loads(json.dumps(data, cls=DjangoJSONEncoder, default=lambda v: getattr(v, "pk", str(v))))


def audit(request, obj, action: str, before: dict | None) -> None:
    BillingAudit.objects.create(
        model=obj._meta.model_name, object_id=str(obj.pk), action=action, before=before,
        after=_snapshot(obj) if action != "delete" else None, user=request.user,
    )


class AuditedAdmin(admin.ModelAdmin):
    """Every change to commercial terms leaves a before/after row (disputes, proposal §9)."""

    def save_model(self, request, obj, form, change):
        before = _snapshot(type(obj).objects.get(pk=obj.pk)) if change else None
        super().save_model(request, obj, form, change)
        self._pending_audit = (obj, "change" if change else "add", before)

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)  # M2M (campaign stores) is saved here
        obj, action, before = self._pending_audit
        audit(request, obj, action, before)

    def delete_model(self, request, obj):
        before = _snapshot(obj)
        super().delete_model(request, obj)
        BillingAudit.objects.create(model=obj._meta.model_name, object_id=str(before.get("id")), action="delete", before=before, user=request.user)


@admin.register(StoreAgreement)
class StoreAgreementAdmin(AuditedAdmin):
    list_display = ("seller", "status", "base_cpc_toman", "monthly_spend_cap_toman", "effective_from")
    list_filter = ("status", "seller")
    autocomplete_fields = ("seller",)


@admin.register(Campaign)
class CampaignAdmin(AuditedAdmin):
    list_display = ("name", "method", "percent", "click_allowance", "discount_budget_toman", "starts_at", "ends_at", "is_active", "exclusive", "priority")
    list_filter = ("method", "is_active", "exclusive")
    filter_horizontal = ("sellers",)
    search_fields = ("name",)


class PeriodForm(forms.Form):
    period = forms.RegexField(regex=r"^1[34]\d\d-(0[1-9]|1[0-2])$", help_text="Jalali month, e.g. 1405-08")


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    can_delete = False
    fields = ("kind", "campaign", "clicks", "base_rate_toman", "percent_off", "gross_toman", "discount_toman", "amount_toman")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("period", "seller", "status", "raw_clicks", "valid_clicks", "free_clicks", "discounted_clicks", "billable_clicks", "payable_toman")
    list_filter = ("status", "period", "seller")
    inlines = [InvoiceLineInline]
    actions = ("issue_selected", "mark_paid_selected", "void_selected")
    change_list_template = "admin/billing/invoice/change_list.html"

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in Invoice._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_urls(self):
        return [path("draft/", self.admin_site.admin_view(self.draft_view), name="billing_invoice_draft"), *super().get_urls()]

    def draft_view(self, request):
        """Classify a month's clicks and (re)build its draft invoices."""
        form = PeriodForm(request.POST or None, initial={"period": previous_period(period_of(timezone.now()))})
        if request.method == "POST" and form.is_valid():
            drafted = invoicing.draft_period(form.cleaned_data["period"])
            self.message_user(request, f"Drafted {len(drafted)} invoice(s) for {form.cleaned_data['period']}.")
            return redirect("admin:billing_invoice_changelist")
        return render(request, "admin/billing/invoice/draft.html", {**self.admin_site.each_context(request), "form": form, "title": "Draft invoices"})

    def _each(self, request, queryset, action, verb):
        done = 0
        for invoice in queryset:
            try:
                action(invoice, user=request.user)
                done += 1
            except ValueError as error:
                self.message_user(request, f"{invoice}: {error}", messages.WARNING)
        self.message_user(request, f"{verb} {done} invoice(s).")

    @admin.action(description="Issue selected drafts (freezes them and books the charge)")
    def issue_selected(self, request, queryset):
        self._each(request, queryset, invoicing.issue, "Issued")

    @admin.action(description="Mark selected invoices paid")
    def mark_paid_selected(self, request, queryset):
        self._each(request, queryset, invoicing.mark_paid, "Marked paid")

    @admin.action(description="Void selected invoices (their clicks can be billed again)")
    def void_selected(self, request, queryset):
        self._each(request, queryset, invoicing.void, "Voided")


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    """Add-only: payments, adjustments and promo credit. Positive = the store owes."""

    list_display = ("created_at", "seller", "kind", "amount_toman", "invoice", "note", "created_by")
    list_filter = ("kind", "seller")
    fields = ("seller", "kind", "amount_toman", "invoice", "note")
    autocomplete_fields = ("seller",)

    def has_change_permission(self, request, obj=None):
        return obj is None

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.created_by = request.user
        super().save_model(request, obj, form, change)
        audit(request, obj, "add", None)


@admin.register(OutboundClick)
class OutboundClickAdmin(admin.ModelAdmin):
    """Review suspicious clicks; a reviewed click keeps its verdict when re-classified."""

    list_display = ("id", "clicked_at", "seller", "validity", "validity_reason", "referrer", "reviewed_by")
    list_filter = ("validity", "seller")
    date_hierarchy = "clicked_at"
    actions = ("mark_valid", "mark_invalid")
    list_per_page = 100

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in OutboundClick._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def _review(self, request, queryset, validity):
        billed = set(ClickCharge.objects.filter(live=True, click_id__in=queryset.values("id")).exclude(invoice__status="draft").values_list("click_id", flat=True))
        for click in queryset.exclude(id__in=billed):
            before = _snapshot(click)
            OutboundClick.objects.filter(pk=click.pk).update(validity=validity, validity_reason=f"reviewed: {validity}", reviewed_by=request.user.pk, classified_at=timezone.now())
            click.refresh_from_db()
            audit(request, click, "review", before)
        if billed:
            self.message_user(request, f"{len(billed)} click(s) are on an issued invoice; void it first.", messages.WARNING)

    @admin.action(description="Confirm as valid (billable)")
    def mark_valid(self, request, queryset):
        self._review(request, queryset, "valid")

    @admin.action(description="Mark as invalid (never billed)")
    def mark_invalid(self, request, queryset):
        self._review(request, queryset, "invalid")


@admin.register(StoreMember)
class StoreMemberAdmin(AuditedAdmin):
    list_display = ("user", "seller")
    autocomplete_fields = ("user", "seller")


@admin.register(BillingAudit)
class BillingAuditAdmin(admin.ModelAdmin):
    list_display = ("at", "model", "object_id", "action", "user")
    list_filter = ("model", "action")

    def get_readonly_fields(self, request, obj=None):
        return [f.name for f in BillingAudit._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
