from django.contrib import admin

from .models import WishlistItem


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "game_id", "target_price_toman", "added_at")
    list_filter = ("added_at",)
    search_fields = ("user__phone_number", "game_id")
    readonly_fields = ("added_at",)
    ordering = ("-added_at",)
