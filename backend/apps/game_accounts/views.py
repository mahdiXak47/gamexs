from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PSNAccount


class PSNAccountListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        accounts = PSNAccount.objects.filter(user=request.user).values(
            "id", "nickname", "psn_id", "region", "added_at"
        )
        return Response(list(accounts))

    def post(self, request):
        nickname = request.data.get("nickname", "").strip()
        psn_id = request.data.get("psn_id", "").strip()
        region = request.data.get("region", PSNAccount.REGION_IR)

        if not nickname or not psn_id:
            return Response({"detail": "nickname و psn_id الزامی هستند."}, status=status.HTTP_400_BAD_REQUEST)

        valid_regions = [r[0] for r in PSNAccount.REGION_CHOICES]
        if region not in valid_regions:
            return Response({"detail": "منطقه نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

        account = PSNAccount.objects.create(
            user=request.user, nickname=nickname, psn_id=psn_id, region=region
        )
        return Response(
            {"id": account.pk, "nickname": account.nickname, "psn_id": account.psn_id, "region": account.region},
            status=status.HTTP_201_CREATED,
        )


class PSNAccountDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_object(self, request, pk):
        try:
            return PSNAccount.objects.get(pk=pk, user=request.user)
        except PSNAccount.DoesNotExist:
            return None

    def patch(self, request, pk):
        account = self._get_object(request, pk)
        if not account:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if "nickname" in request.data:
            account.nickname = request.data["nickname"].strip()
        if "psn_id" in request.data:
            account.psn_id = request.data["psn_id"].strip()
        if "region" in request.data:
            region = request.data["region"]
            valid_regions = [r[0] for r in PSNAccount.REGION_CHOICES]
            if region not in valid_regions:
                return Response({"detail": "منطقه نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)
            account.region = region
        account.save()
        return Response({"id": account.pk, "nickname": account.nickname, "psn_id": account.psn_id, "region": account.region})

    def delete(self, request, pk):
        account = self._get_object(request, pk)
        if not account:
            return Response(status=status.HTTP_404_NOT_FOUND)
        account.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
