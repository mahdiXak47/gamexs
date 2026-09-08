from django.contrib import admin

from .models import PSNAccount


@admin.register(PSNAccount)
class PSNAccountAdmin(admin.ModelAdmin):
    list_display = ("nickname", "psn_id", "region", "user", "added_at")
    list_filter = ("region", "added_at")
    search_fields = ("nickname", "psn_id", "user__phone_number")
    readonly_fields = ("added_at",)
    ordering = ("-added_at",)
