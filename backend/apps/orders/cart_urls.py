from django.urls import path

from . import views

urlpatterns = [
    path("", views.CartView.as_view(), name="cart"),
    path("items/", views.CartItemView.as_view(), name="cart-add-item"),
    path("items/<int:pk>/", views.CartItemView.as_view(), name="cart-remove-item"),
    path("clear/", views.CartClearView.as_view(), name="cart-clear"),
]
