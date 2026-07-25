from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Ticket, TicketMessage


class TicketListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tickets = list(
            Ticket.objects.filter(user=request.user).values(
                "id", "subject", "category", "status", "related_game_id", "created_at", "updated_at"
            )
        )
        return Response(tickets)

    def post(self, request):
        subject = request.data.get("subject", "").strip()
        category = request.data.get("category", Ticket.CATEGORY_GENERAL)
        body = request.data.get("body", "").strip()
        related_game_id = request.data.get("related_game_id")

        if not subject or not body:
            return Response({"detail": "subject و body الزامی هستند."}, status=status.HTTP_400_BAD_REQUEST)

        valid_categories = [c[0] for c in Ticket.CATEGORY_CHOICES]
        if category not in valid_categories:
            return Response({"detail": "دسته بندی نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

        ticket = Ticket.objects.create(
            user=request.user,
            subject=subject,
            category=category,
            related_game_id=related_game_id or None,
        )
        TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            is_staff_reply=False,
            body=body,
        )
        return Response({"id": ticket.pk, "subject": ticket.subject, "status": ticket.status},
                        status=status.HTTP_201_CREATED)


class TicketDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_ticket(self, request, pk):
        try:
            return Ticket.objects.get(pk=pk, user=request.user)
        except Ticket.DoesNotExist:
            return None

    def get(self, request, pk):
        ticket = self._get_ticket(request, pk)
        if not ticket:
            return Response(status=status.HTTP_404_NOT_FOUND)

        messages = list(
            ticket.messages.values("id", "sender_id", "is_staff_reply", "body", "created_at")
        )
        return Response({
            "id": ticket.pk,
            "subject": ticket.subject,
            "category": ticket.category,
            "status": ticket.status,
            "related_game_id": ticket.related_game_id,
            "created_at": ticket.created_at,
            "updated_at": ticket.updated_at,
            "messages": messages,
        })

    def post(self, request, pk):
        ticket = self._get_ticket(request, pk)
        if not ticket:
            return Response(status=status.HTTP_404_NOT_FOUND)

        body = request.data.get("body", "").strip()
        if not body:
            return Response({"detail": "body الزامی است."}, status=status.HTTP_400_BAD_REQUEST)

        if ticket.status == Ticket.STATUS_CLOSED:
            return Response({"detail": "تیکت بسته شده است."}, status=status.HTTP_400_BAD_REQUEST)

        msg = TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            is_staff_reply=False,
            body=body,
        )
        if ticket.status == Ticket.STATUS_WAITING_USER:
            ticket.status = Ticket.STATUS_IN_PROGRESS
            ticket.save(update_fields=["status", "updated_at"])

        return Response({"id": msg.pk, "body": msg.body, "created_at": msg.created_at},
                        status=status.HTTP_201_CREATED)
