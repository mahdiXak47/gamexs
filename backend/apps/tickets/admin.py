from django.contrib import admin

from .models import Ticket, TicketMessage


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "user", "category", "status", "created_at", "updated_at")
    list_filter = ("category", "status", "created_at")
    search_fields = ("subject", "user__phone_number")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "ticket", "sender", "is_staff_reply", "created_at")
    list_filter = ("is_staff_reply", "created_at")
    search_fields = ("body", "sender__phone_number", "ticket__subject")
    readonly_fields = ("sender", "is_staff_reply", "created_at")
    ordering = ("-created_at",)

    def save_model(self, request, obj, form, change):
        if not change:
            obj.sender = request.user
            obj.is_staff_reply = True

        super().save_model(request, obj, form, change)

        if obj.is_staff_reply and obj.ticket.status in {
            Ticket.STATUS_OPEN,
            Ticket.STATUS_IN_PROGRESS,
            Ticket.STATUS_WAITING_USER,
        }:
            obj.ticket.status = Ticket.STATUS_WAITING_USER
            obj.ticket.save(update_fields=("status", "updated_at"))
