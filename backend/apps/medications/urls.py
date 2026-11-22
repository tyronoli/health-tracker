from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DoseViewSet, LowSupplyView, MedicationViewSet, ScheduleViewSet

router = SimpleRouter()
router.register("medications", MedicationViewSet, basename="medication")
router.register("schedules", ScheduleViewSet, basename="schedule")
router.register("doses", DoseViewSet, basename="dose")

urlpatterns = [
    path("refills/low-supply/", LowSupplyView.as_view(), name="low-supply"),
    *router.urls,
]
