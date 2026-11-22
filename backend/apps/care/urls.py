from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import CareLinkViewSet, ProfileListView

router = SimpleRouter()
router.register("care-links", CareLinkViewSet, basename="care-link")

urlpatterns = [
    path("profiles/", ProfileListView.as_view(), name="profiles"),
    *router.urls,
]
