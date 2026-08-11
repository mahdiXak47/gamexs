from rest_framework import serializers

from .models import GameReview


class GameReviewSubmitSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    body = serializers.CharField(max_length=5000, trim_whitespace=True)

    def validate_body(self, value):
        if not value.strip():
            raise serializers.ValidationError("متن دیدگاه الزامی است.")
        return value.strip()


def user_display_name(user):
    name = getattr(user, "full_name", "").strip()
    if name:
        return name
    phone = getattr(user, "phone_number", "")
    if len(phone) >= 7:
        return f"{phone[:4]}***{phone[-4:]}"
    return "کاربر GameXS"


def serialize_review(review: GameReview, include_status=False):
    data = {
        "id": review.pk,
        "game_id": review.game_id,
        "rating": review.rating,
        "body": review.body,
        "author_name": user_display_name(review.user),
        "created_at": review.created_at.isoformat(),
        "updated_at": review.updated_at.isoformat(),
    }
    if include_status:
        data["status"] = review.status
    return data
