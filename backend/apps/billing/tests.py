import datetime as dt
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from apps.common.jalali import TEHRAN, period_bounds, period_of, previous_period, to_gregorian, to_jalali

from . import invoicing
from .classify import Click, classify
from .models import Campaign, ClickCharge, Invoice, LedgerEntry, OutboundClick, StoreAgreement, StoreMember
from .pricing import CampaignState, Terms, price_period

START, END = period_bounds("1405-08")


def at(day: int, minute: int = 0) -> dt.datetime:
    return START + dt.timedelta(days=day, minutes=minute)


def clicks(n: int, day: int = 1) -> list[tuple[int, dt.datetime]]:
    return [(i + 1, at(day, i)) for i in range(n)]


def campaign(id=1, method="per_click", percent=100, **kw) -> CampaignState:
    return CampaignState(id=id, method=method, percent=percent, starts_at=kw.pop("starts_at", START), **kw)


def price(items, terms=(), campaigns=(), default=1000):
    return price_period(list(items), list(terms), list(campaigns), default, START, END)


class PricingMatrixTests(SimpleTestCase):
    def test_no_campaign_charges_base_rate(self):
        p = price(clicks(3))
        self.assertEqual((p.gross_toman, p.payable_toman, p.count("charged")), (3000, 3000, 3))

    def test_first_n_clicks_free_then_base_rate(self):
        p = price(clicks(5), campaigns=[campaign(click_allowance=3)])
        self.assertEqual((p.count("free"), p.count("charged"), p.payable_toman), (3, 2, 2000))

    def test_ten_and_fifty_percent_per_click(self):
        self.assertEqual(price(clicks(2), campaigns=[campaign(percent=10)]).payable_toman, 1800)
        p = price(clicks(2), campaigns=[campaign(percent=50)])
        self.assertEqual((p.payable_toman, p.per_click_discount_toman, p.count("discounted")), (1000, 1000, 2))

    def test_allowance_used_on_earlier_invoices_carries_over(self):
        p = price(clicks(4), campaigns=[campaign(click_allowance=3, used_clicks=2)])
        self.assertEqual((p.count("free"), p.count("charged")), (1, 3))

    def test_higher_priority_campaign_first(self):
        low, high = campaign(1, percent=20, priority=0), campaign(2, percent=50, priority=5, click_allowance=1)
        p = price(clicks(2), campaigns=[low, high])
        self.assertEqual(sorted((l.campaign_id, len(l.click_ids)) for l in p.lines), [(1, 1), (2, 1)])

    def test_exclusive_campaign_blocks_the_others(self):
        free = campaign(1, click_allowance=10)
        exclusive_half = campaign(2, percent=50, exclusive=True)
        invoice_off = campaign(3, method="total", percent=30)
        p = price(clicks(2), campaigns=[free, exclusive_half, invoice_off])
        self.assertEqual((p.payable_toman, p.total_campaign_id), (1000, None))

    def test_per_click_then_total_in_that_order(self):
        p = price(clicks(4), campaigns=[campaign(1, click_allowance=2), campaign(2, method="total", percent=50)])
        self.assertEqual((p.subtotal_toman, p.total_discount_toman, p.payable_toman), (2000, 1000, 1000))

    def test_total_discount_capped_by_its_budget(self):
        p = price(clicks(10), campaigns=[campaign(method="total", percent=50, discount_budget_toman=1200, used_discount=Decimal(1000))])
        self.assertEqual((p.total_discount_toman, p.payable_toman), (200, 9800))

    def test_per_click_budget_runs_out(self):
        p = price(clicks(3), campaigns=[campaign(percent=50, discount_budget_toman=1000)])
        self.assertEqual((p.count("discounted"), p.count("charged")), (2, 1))

    def test_spending_cap_leaves_over_cap_clicks_unbilled(self):
        p = price(clicks(5), terms=[Terms(START, None, 3000)])
        self.assertEqual((p.count("charged"), p.count("over_cap"), p.payable_toman), (3, 2, 3000))

    def test_free_clicks_never_count_against_the_cap(self):
        p = price(clicks(5), terms=[Terms(START, None, 1000)], campaigns=[campaign(click_allowance=4)])
        self.assertEqual((p.count("free"), p.count("charged"), p.count("over_cap")), (4, 1, 0))

    def test_rate_change_mid_month(self):
        p = price([(1, at(1)), (2, at(20))], terms=[Terms(START, 1000, None), Terms(at(10), 1500, None)])
        self.assertEqual((p.payable_toman, len(p.lines)), (2500, 2))

    def test_campaign_only_covers_clicks_in_its_dates(self):
        p = price([(1, at(1)), (2, at(20))], campaigns=[campaign(starts_at=at(10))])
        self.assertEqual((p.count("free"), p.count("charged")), (1, 1))

    def test_rounding_half_up_once_per_line(self):
        p = price(clicks(3), campaigns=[campaign(percent=15)], default=333)  # 3 × 333 × 0.85 = 849.15
        self.assertEqual(p.payable_toman, 849)
        p = price(clicks(1), campaigns=[campaign(percent=50)], default=333)  # 166.5
        self.assertEqual(p.payable_toman, 167)

    def test_payable_never_below_zero(self):
        p = price(clicks(2), campaigns=[campaign(method="total", percent=100)])
        self.assertEqual(p.payable_toman, 0)

    def test_same_inputs_same_invoice(self):
        def run():
            p = price(clicks(7), terms=[Terms(START, 900, 5000)], campaigns=[campaign(1, percent=40, click_allowance=3), campaign(2, method="total", percent=10)])
            return [(l.kind, l.campaign_id, l.click_ids, l.amount_toman) for l in p.lines], p.payable_toman

        self.assertEqual(run(), run())


RULES = {
    "DUPLICATE_WINDOW_MINUTES": 30, "MAX_CLICKS_PER_VISITOR_DAY": 5, "BURST_CLICKS": 4,
    "BURST_WINDOW_SECONDS": 60, "REQUIRE_GAMEXS_REFERRER": False, "SUSPICIOUS_BILLABLE": False,
}


def click(id, minutes, seller=1, ip="1.1.1.1", **kw):
    kw.setdefault("referrer", "/games/x")
    kw.setdefault("listing_id", 1)
    return Click(id=id, seller_id=seller, clicked_at=at(1, minutes), visitor_hash=f"h{kw.pop('hash', '')}", ip_address=ip, user_agent="UA", **kw)


class ClassificationTests(SimpleTestCase):
    def test_duplicate_window(self):
        v = classify([click(1, 0), click(2, 10), click(3, 45), click(4, 50, seller=2)], RULES)
        self.assertEqual([v[i][0] for i in (1, 2, 3, 4)], ["valid", "duplicate", "valid", "valid"])

    def test_same_ip_and_browser_across_midnight_is_one_visitor(self):
        late = Click(1, 1, START + dt.timedelta(minutes=-5), "day1", "2.2.2.2", "UA", "/g", 1)
        early = Click(2, 1, START + dt.timedelta(minutes=5), "day2", "2.2.2.2", "UA", "/g", 1)
        self.assertEqual(classify([late, early], RULES)[2][0], "duplicate")

    def test_hash_fallback_when_ip_was_erased(self):
        v = classify([click(1, 0, ip=None, hash="a"), click(2, 5, ip=None, hash="a"), click(3, 6, ip=None, hash="b")], RULES)
        self.assertEqual([v[i][0] for i in (1, 2, 3)], ["valid", "duplicate", "valid"])

    def test_burst_is_suspicious(self):
        burst = [click(i, 0, seller=i) for i in range(1, 5)]
        self.assertEqual(classify(burst, RULES)[4][0], "suspicious")

    def test_daily_cap_is_suspicious(self):
        day = [click(i, i * 60, seller=i) for i in range(1, 7)]
        self.assertEqual([v for _, (v, _) in sorted(classify(day, RULES).items())][-1], "suspicious")

    def test_referrer_rule_only_when_enabled(self):
        no_ref = [click(1, 0, referrer=None)]
        self.assertEqual(classify(no_ref, RULES)[1][0], "valid")
        self.assertEqual(classify(no_ref, {**RULES, "REQUIRE_GAMEXS_REFERRER": True})[1][0], "suspicious")

    def test_removed_listing_without_referrer_is_unverifiable(self):
        self.assertEqual(classify([click(1, 0, referrer=None, listing_id=None)], RULES)[1][0], "unverifiable")

    def test_reviewed_click_keeps_its_verdict(self):
        v = classify([click(1, 0), click(2, 1, reviewed=True, validity="valid")], RULES)
        self.assertEqual(v[2][0], "valid")


class JalaliTests(SimpleTestCase):
    def test_round_trip_and_periods(self):
        day = dt.date(2020, 1, 1)
        for i in range(0, 3000, 7):
            d = day + dt.timedelta(days=i)
            self.assertEqual(to_gregorian(*to_jalali(d.year, d.month, d.day)), d)
        self.assertEqual(to_gregorian(1405, 1, 1), dt.date(2026, 3, 21))
        self.assertEqual(period_bounds("1405-08")[0].date(), dt.date(2026, 10, 23))
        self.assertEqual(period_of(dt.datetime(2026, 10, 22, 21, 0, tzinfo=dt.timezone.utc)), "1405-08")  # 00:30 Tehran
        self.assertEqual(previous_period("1405-01"), "1404-12")


def make_tables():
    """The scraper owns sellers/outbound_clicks; the test database needs a stand-in."""
    with connection.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sellers (id SERIAL PRIMARY KEY, slug TEXT, name TEXT, domain TEXT, is_active BOOLEAN DEFAULT true);
            CREATE TABLE IF NOT EXISTS outbound_clicks (
                id BIGSERIAL PRIMARY KEY, listing_id INT, game_id INT NOT NULL DEFAULT 1, seller_id INT NOT NULL,
                product_type TEXT NOT NULL DEFAULT 'ACCOUNT_GAME', tier TEXT, price_toman BIGINT, visitor_hash TEXT NOT NULL,
                referrer TEXT, ip_address INET, user_agent TEXT, clicked_at TIMESTAMPTZ NOT NULL,
                validity TEXT NOT NULL DEFAULT 'pending', validity_reason TEXT, classified_at TIMESTAMPTZ, reviewed_by INT);
            INSERT INTO sellers (id, slug, name, domain) VALUES (1, 'shop', 'Shop', 'shop.ir'), (2, 'other', 'Other', 'other.ir');
        """)


def add_clicks(n, seller=1, day=1):
    for i in range(n):
        OutboundClick.objects.create(seller_id=seller, game_id=1, product_type="ACCOUNT_GAME", visitor_hash=f"v{seller}-{day}-{i}",
                                     ip_address=f"10.0.{seller}.{i + 1}", user_agent="UA", referrer="/games/x", listing_id=1, clicked_at=at(day, i))


@override_settings(BILLING={**RULES, "BASE_CPC_TOMAN": 1000})
class InvoiceFlowTests(TestCase):
    def setUp(self):
        make_tables()

    def test_draft_issue_pay_and_carry_over_allowance(self):
        promo = Campaign.objects.create(name="first 3 free", method="per_click", percent=100, click_allowance=3, starts_at=START - dt.timedelta(days=60))
        promo.sellers.add(1)
        add_clicks(2)
        prev_start, _ = period_bounds("1405-07")
        OutboundClick.objects.create(seller_id=1, game_id=1, product_type="ACCOUNT_GAME", visitor_hash="old", ip_address="9.9.9.9",
                                     user_agent="UA", referrer="/g", listing_id=1, clicked_at=prev_start + dt.timedelta(days=2))
        [previous] = invoicing.draft_period("1405-07")
        self.assertEqual((previous.free_clicks, previous.payable_toman), (1, 0))
        add_clicks(1, day=2)  # third click of this month; first two of this month + the earlier one use up the 3 free
        [current] = invoicing.draft_period("1405-08")
        self.assertEqual((current.valid_clicks, current.free_clicks, current.billable_clicks, current.payable_toman), (3, 2, 1, 1000))

        invoicing.issue(current)
        invoicing.mark_paid(current)
        self.assertEqual(invoicing.balance(1)["owed_toman"], 0)
        self.assertEqual(LedgerEntry.objects.filter(seller_id=1).count(), 2)

    def test_issued_invoice_is_frozen_and_redraft_skips_it(self):
        add_clicks(2)
        [invoice] = invoicing.draft_period("1405-08")
        invoicing.issue(invoice)
        invoice.payable_toman = 1
        with self.assertRaises(ValidationError):
            invoice.save()
        add_clicks(1, day=3)
        self.assertEqual(invoicing.draft_period("1405-08"), [])

    def test_void_lets_clicks_be_billed_again(self):
        add_clicks(2)
        [invoice] = invoicing.draft_period("1405-08")
        invoicing.issue(invoice)
        invoicing.void(invoice)
        self.assertEqual(invoicing.balance(1)["owed_toman"], 0)
        [again] = invoicing.draft_period("1405-08")
        self.assertEqual(again.payable_toman, 2000)

    def test_store_agreement_rate_and_duplicates(self):
        StoreAgreement.objects.create(seller_id=1, base_cpc_toman=700, effective_from=START)
        add_clicks(2)
        OutboundClick.objects.create(seller_id=1, game_id=1, product_type="ACCOUNT_GAME", visitor_hash="dup", ip_address="10.0.1.1",
                                     user_agent="UA", referrer="/g", listing_id=1, clicked_at=at(1, 5))
        [invoice] = invoicing.draft_period("1405-08")
        self.assertEqual((invoice.valid_clicks, invoice.invalid_clicks, invoice.payable_toman), (2, {"duplicate": 1}, 1400))

    def test_suspicious_held_until_reviewed(self):
        for i in range(5):  # one visitor, five clicks in a minute -> burst from the 4th
            OutboundClick.objects.create(seller_id=1, game_id=1, product_type="ACCOUNT_GAME", visitor_hash="b", ip_address="7.7.7.7",
                                         user_agent="UA", referrer="/g", listing_id=1, clicked_at=at(1) + dt.timedelta(seconds=i))
        [invoice] = invoicing.draft_period("1405-08")
        self.assertEqual(invoice.invalid_clicks.get("suspicious"), 2)
        self.assertEqual(invoice.payable_toman, 1000)  # 1 valid, the rest duplicates or held

    def test_database_guards(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Campaign.objects.create(name="x", method="per_click", percent=5, starts_at=START)
        add_clicks(1)
        [invoice] = invoicing.draft_period("1405-08")
        charge = ClickCharge.objects.get(invoice=invoice)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ClickCharge.objects.create(click_id=charge.click_id, invoice=invoice, line=charge.line)
        entry = invoicing.add_adjustment(1, -500, "goodwill")
        with self.assertRaises(ValidationError):
            entry.save()
        with self.assertRaises(ValueError):
            invoicing.add_adjustment(1, 100, " ")


class StoreProfileTests(TestCase):
    def setUp(self):
        make_tables()

    def test_profile_reports_store_membership(self):
        from apps.accounts.models import User

        user = User.objects.create_user(phone_number="09120000009", password="pass-word-123", is_active=True)
        client = APIClient()
        client.force_authenticate(user)
        self.assertIsNone(client.get("/api/profile/").json()["store"])
        StoreMember.objects.create(user=user, seller_id=2)
        self.assertEqual(client.get("/api/profile/").json()["store"], {"id": 2})
