from django.urls import path

from . import views

urlpatterns = [
    path("games/<int:game_id>/", views.GameReviewListCreateView.as_view(), name="game-reviews"),
]
