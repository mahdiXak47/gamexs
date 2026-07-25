from django.conf import settings
from django.db import models


class CartItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cart_items")
    game_id = models.IntegerField()
    listing_id = models.IntegerField(null=True, blank=True)
    product_type = models.CharField(max_length=50)
    tier = models.CharField(max_length=50, null=True, blank=True)
    price_toman = models.IntegerField()
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "orders_cartitem"
        unique_together = [("user", "game_id", "product_type", "tier")]
        ordering = ["-added_at"]

    def __str__(self):
        return f"cart / {self.user} / game#{self.game_id}"


class Order(models.Model):
    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_PROCESSING = "processing"
    STATUS_DELIVERED = "delivered"
    STATUS_CANCELLED = "cancelled"
    STATUS_REFUNDED = "refunded"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_DELIVERED, "Delivered"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_REFUNDED, "Refunded"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders")
    game_id = models.IntegerField()
    seller_id = models.IntegerField(null=True, blank=True)
    listing_id = models.IntegerField(null=True, blank=True)
    product_type = models.CharField(max_length=50)
    tier = models.CharField(max_length=50, null=True, blank=True)
    price_toman = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    delivery_email = models.EmailField(blank=True)
    delivery_password = models.CharField(max_length=200, blank=True)
    delivery_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "orders_order"
        indexes = [
            models.Index(fields=["user", "status"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"order#{self.pk} / {self.user} / {self.status}"
