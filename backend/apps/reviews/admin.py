from django.contrib import admin
from django.utils import timezone

from .models import GameReview


@admin.register(GameReview)
class GameReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "game_id", "user", "rating", "status", "created_at", "approved_at")
    list_filter = ("status", "rating", "created_at")
    search_fields = ("body", "user__phone_number", "user__first_name", "user__last_name")
    readonly_fields = ("created_at", "updated_at", "approved_at")
    actions = ("approve_reviews", "reject_reviews", "mark_pending")

    @admin.action(description="Approve selected reviews")
    def approve_reviews(self, request, queryset):
        queryset.update(status=GameReview.STATUS_APPROVED, approved_at=timezone.now())

    @admin.action(description="Reject selected reviews")
    def reject_reviews(self, request, queryset):
        queryset.update(status=GameReview.STATUS_REJECTED, approved_at=None)

    @admin.action(description="Mark selected reviews pending")
    def mark_pending(self, request, queryset):
        queryset.update(status=GameReview.STATUS_PENDING, approved_at=None)
