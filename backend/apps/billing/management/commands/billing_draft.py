from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.billing.invoicing import draft_period
from apps.common.jalali import period_of, previous_period


class Command(BaseCommand):
    help = "Classify a Jalali month's clicks and (re)build draft invoices for every store that got clicks."

    def add_arguments(self, parser):
        parser.add_argument("--period", help="Jalali month, e.g. 1405-08 (default: last month)")

    def handle(self, *args, period=None, **options):
        period = period or previous_period(period_of(timezone.now()))
        for invoice in draft_period(period):
            self.stdout.write(f"{period} seller {invoice.seller_id}: {invoice.valid_clicks} valid, payable {invoice.payable_toman} toman")
        self.stdout.write(f"drafted {period}")
