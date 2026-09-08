from django.contrib import admin

from .models import CartItem, Order


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "game_id", "product_type", "tier", "price_toman", "added_at")
    list_filter = ("product_type", "tier", "added_at")
    search_fields = ("user__phone_number", "game_id")
    readonly_fields = ("added_at",)
    ordering = ("-added_at",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "game_id", "product_type", "tier", "price_toman", "status", "created_at")
    list_filter = ("status", "product_type", "tier", "created_at")
    search_fields = ("user__phone_number", "game_id", "delivery_email")
    readonly_fields = ("created_at", "updated_at", "delivered_at")
    ordering = ("-created_at",)
