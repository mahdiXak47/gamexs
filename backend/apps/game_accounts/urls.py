from django.urls import path

from . import views

urlpatterns = [
    path("psn/", views.PSNAccountListView.as_view(), name="psn-accounts"),
    path("psn/<int:pk>/", views.PSNAccountDetailView.as_view(), name="psn-account-detail"),
]
