from django.urls import path

from . import views

urlpatterns = [
    path("", views.TicketListView.as_view(), name="tickets"),
    path("<int:pk>/", views.TicketDetailView.as_view(), name="ticket-detail"),
    path("<int:pk>/messages/", views.TicketDetailView.as_view(), name="ticket-messages"),
]
