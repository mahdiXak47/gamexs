import datetime as dt

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.billing.classify import classify_range
from apps.common.jalali import period_bounds


class Command(BaseCommand):
    help = "Classify outbound clicks as valid / duplicate / suspicious / unverifiable (rules: BILLING_* env)."

    def add_arguments(self, parser):
        parser.add_argument("--period", help="Jalali month, e.g. 1405-08 (re-classifies every unreviewed click in it)")
        parser.add_argument("--days", type=int, default=2, help="without --period: pending clicks of the last N days")

    def handle(self, *args, period=None, days=2, **options):
        if period:
            start, end = period_bounds(period)
            n = classify_range(start, end)
        else:
            end = timezone.now() + dt.timedelta(minutes=1)
            n = classify_range(end - dt.timedelta(days=days), end, only_pending=True)
        self.stdout.write(f"classified {n} clicks")
