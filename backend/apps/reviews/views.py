from django.db.models import Avg
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import GameReview
from .serializers import GameReviewSubmitSerializer, serialize_review


class GameReviewListCreateView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, game_id):
        approved = (
            GameReview.objects
            .filter(game_id=game_id, status=GameReview.STATUS_APPROVED)
            .select_related("user")
            .order_by("-created_at")
        )
        aggregate = approved.aggregate(average_rating=Avg("rating"))
        current_user_review = None

        if request.user and request.user.is_authenticated:
            own = (
                GameReview.objects
                .filter(game_id=game_id, user=request.user)
                .select_related("user")
                .first()
            )
            if own:
                current_user_review = serialize_review(own, include_status=True)

        return Response({
            "approved_count": approved.count(),
            "average_rating": aggregate["average_rating"],
            "reviews": [serialize_review(review) for review in approved],
            "current_user_review": current_user_review,
        })

    def post(self, request, game_id):
        if not request.user or not request.user.is_authenticated:
            return Response({"detail": "برای ثبت دیدگاه ابتدا وارد شوید."}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = GameReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        review, created = GameReview.objects.update_or_create(
            user=request.user,
            game_id=game_id,
            defaults={
                "rating": serializer.validated_data["rating"],
                "body": serializer.validated_data["body"],
                "status": GameReview.STATUS_PENDING,
                "approved_at": None,
            },
        )
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK

        return Response(serialize_review(review, include_status=True), status=response_status)
