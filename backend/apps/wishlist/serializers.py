from rest_framework import serializers


class WishlistCreateSerializer(serializers.Serializer):
    game_id = serializers.IntegerField(min_value=1)
    target_price_toman = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )
