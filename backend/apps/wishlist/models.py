from django.conf import settings
from django.db import models


class WishlistItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wishlist_items")
    game_id = models.IntegerField()
    target_price_toman = models.IntegerField(null=True, blank=True)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wishlist_wishlistitem"
        unique_together = [("user", "game_id")]
        ordering = ["-added_at"]

    def __str__(self):
        return f"{self.user} / game#{self.game_id}"
