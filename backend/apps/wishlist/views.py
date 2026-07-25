from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import WishlistItem


class WishlistView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = WishlistItem.objects.filter(user=request.user).values(
            "id", "game_id", "target_price_toman", "added_at"
        )
        return Response(list(items))

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
