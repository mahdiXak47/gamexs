from django.conf import settings
from django.db import models


class Ticket(models.Model):
    CATEGORY_PRE_PURCHASE = "pre_purchase"
    CATEGORY_POST_PURCHASE = "post_purchase"
    CATEGORY_ACCOUNT = "account"
    CATEGORY_GENERAL = "general"
    CATEGORY_CHOICES = [
        (CATEGORY_PRE_PURCHASE, "Before Purchase"),
        (CATEGORY_POST_PURCHASE, "After Purchase"),
        (CATEGORY_ACCOUNT, "Account"),
        (CATEGORY_GENERAL, "General"),
    ]

    STATUS_OPEN = "open"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_WAITING_USER = "waiting_user"
    STATUS_RESOLVED = "resolved"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_WAITING_USER, "Waiting for User"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_CLOSED, "Closed"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tickets")
    subject = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default=CATEGORY_GENERAL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    related_game_id = models.IntegerField(null=True, blank=True)
    related_order = models.ForeignKey(
        "orders.Order", null=True, blank=True, on_delete=models.SET_NULL, related_name="tickets"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tickets_ticket"
        ordering = ["-created_at"]

    def __str__(self):
        return f"#{self.pk} {self.subject[:40]}"


class TicketMessage(models.Model):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_staff_reply = models.BooleanField(default=False)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tickets_ticketmessage"
        ordering = ["created_at"]

    def __str__(self):
        return f"msg#{self.pk} on ticket#{self.ticket_id}"
