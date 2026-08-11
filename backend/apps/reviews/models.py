from django.conf import settings
from django.db import models


class GameReview(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="game_reviews")
    game_id = models.IntegerField()
    rating = models.PositiveSmallIntegerField()
    body = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "reviews_gamereview"
        unique_together = [("user", "game_id")]
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["game_id", "status", "-created_at"]),
            models.Index(fields=["user", "game_id"]),
        ]

    def __str__(self):
        return f"game#{self.game_id} / {self.user} / {self.rating}"
