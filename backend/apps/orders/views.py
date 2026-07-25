from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CartItem, Order


class CartView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = list(
            CartItem.objects.filter(user=request.user).values(
                "id", "game_id", "listing_id", "product_type", "tier", "price_toman", "added_at"
            )
        )
        total = sum(i["price_toman"] for i in items)
        return Response({"items": items, "total_toman": total})


class CartItemView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        game_id = request.data.get("game_id")
        product_type = request.data.get("product_type", "").strip()
        tier = request.data.get("tier") or None
        price_toman = request.data.get("price_toman")
        listing_id = request.data.get("listing_id")

        if not game_id or not product_type or price_toman is None:
            return Response(
                {"detail": "game_id, product_type و price_toman الزامی هستند."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item, created = CartItem.objects.update_or_create(
            user=request.user,
            game_id=game_id,
            product_type=product_type,
            tier=tier,
            defaults={"price_toman": price_toman, "listing_id": listing_id},
        )
        return Response(
            {"id": item.pk, "game_id": item.game_id, "price_toman": item.price_toman},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        try:
            item = CartItem.objects.get(pk=pk, user=request.user)
        except CartItem.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartClearView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        CartItem.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        orders = list(
            Order.objects.filter(user=request.user).values(
                "id", "game_id", "seller_id", "product_type", "tier",
                "price_toman", "status", "created_at", "delivered_at"
            )
        )
        return Response(orders)

    def post(self, request):
        """Place an order from the current cart (one item at a time for now)."""
        game_id = request.data.get("game_id")
        product_type = request.data.get("product_type", "").strip()
        tier = request.data.get("tier") or None
        price_toman = request.data.get("price_toman")
        seller_id = request.data.get("seller_id")
        listing_id = request.data.get("listing_id")

        if not game_id or not product_type or price_toman is None:
            return Response(
                {"detail": "game_id, product_type و price_toman الزامی هستند."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = Order.objects.create(
            user=request.user,
            game_id=game_id,
            seller_id=seller_id,
            listing_id=listing_id,
            product_type=product_type,
            tier=tier,
            price_toman=price_toman,
            status=Order.STATUS_PENDING,
        )
        CartItem.objects.filter(
            user=request.user, game_id=game_id, product_type=product_type, tier=tier
        ).delete()

        return Response({"id": order.pk, "status": order.status}, status=status.HTTP_201_CREATED)


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            order = Order.objects.get(pk=pk, user=request.user)
        except Order.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        data = {
            "id": order.pk,
            "game_id": order.game_id,
            "seller_id": order.seller_id,
            "listing_id": order.listing_id,
            "product_type": order.product_type,
            "tier": order.tier,
            "price_toman": order.price_toman,
            "status": order.status,
            "delivery_email": order.delivery_email,
            "delivery_notes": order.delivery_notes,
            "created_at": order.created_at,
            "delivered_at": order.delivered_at,
        }
        return Response(data)
