from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from .admin import TicketMessageAdmin
from .models import Ticket, TicketMessage


class TicketMessageAdminTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.customer = user_model.objects.create_user(
            phone_number="09123456789",
            password="pass12345",
            is_active=True,
        )
        self.staff = user_model.objects.create_user(
            phone_number="09987654321",
            password="pass12345",
            is_active=True,
            is_staff=True,
        )
        self.ticket = Ticket.objects.create(
            user=self.customer,
            subject="پرسش پشتیبانی",
            status=Ticket.STATUS_OPEN,
        )
        self.request = RequestFactory().post("/admin/apps/tickets/ticketmessage/add/")
        self.request.user = self.staff
        self.admin = TicketMessageAdmin(TicketMessage, AdminSite())

    def test_new_admin_message_is_staff_reply_and_waits_for_customer(self):
        message = TicketMessage(ticket=self.ticket, body="پاسخ پشتیبانی")

        self.admin.save_model(self.request, message, form=None, change=False)

        message.refresh_from_db()
        self.ticket.refresh_from_db()
        self.assertEqual(message.sender_id, self.staff.id)
        self.assertTrue(message.is_staff_reply)
        self.assertEqual(self.ticket.status, Ticket.STATUS_WAITING_USER)

    def test_editing_customer_message_does_not_relabel_it_as_staff(self):
        message = TicketMessage.objects.create(
            ticket=self.ticket,
            sender=self.customer,
            is_staff_reply=False,
            body="پیام مشتری",
        )

        self.admin.save_model(self.request, message, form=None, change=True)

        message.refresh_from_db()
        self.assertEqual(message.sender_id, self.customer.id)
        self.assertFalse(message.is_staff_reply)
