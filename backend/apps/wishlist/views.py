from django.db import connection
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WishlistItem


class WishlistView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT w.id, w.game_id, w.target_price_toman, w.added_at,
                       g.title AS game_title, g.slug AS game_slug, g.cover_url
                FROM wishlist_wishlistitem w
                LEFT JOIN ps5_games g ON g.id = w.game_id
                WHERE w.user_id = %s
                ORDER BY w.added_at DESC
            """, [request.user.id])
            columns = [col[0] for col in cursor.description]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for row in rows:
            added_at = row.get("added_at")
            if added_at and hasattr(added_at, "isoformat"):
                row["added_at"] = added_at.isoformat()
            target = row.get("target_price_toman")
            if target is not None:
                row["target_price_toman"] = float(target)

        return Response(rows)

    def post(self, request):
        game_id = request.data.get("game_id")
        target_price = request.data.get("target_price_toman")

        if not game_id:
            return Response({"detail": "game_id الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

        item, created = WishlistItem.objects.get_or_create(
            user=request.user,
            game_id=game_id,
            defaults={"target_price_toman": target_price},
        )
        if not created and target_price is not None:
            item.target_price_toman = target_price
            item.save(update_fields=["target_price_toman"])

        return Response(
            {"id": item.pk, "game_id": item.game_id, "target_price_toman": item.target_price_toman},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WishlistItemView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            item = WishlistItem.objects.get(pk=pk, user=request.user)
        except WishlistItem.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
