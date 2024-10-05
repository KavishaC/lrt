from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("get_directions", views.get_directions, name="get_directions"),
]