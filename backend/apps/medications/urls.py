from rest_framework.routers import SimpleRouter

from .views import DoseViewSet, MedicationViewSet, ScheduleViewSet

router = SimpleRouter()
router.register("medications", MedicationViewSet, basename="medication")
router.register("schedules", ScheduleViewSet, basename="schedule")
router.register("doses", DoseViewSet, basename="dose")

urlpatterns = router.urls
