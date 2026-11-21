from rest_framework.routers import SimpleRouter

from .views import MedicationViewSet, ScheduleViewSet

router = SimpleRouter()
router.register("medications", MedicationViewSet, basename="medication")
router.register("schedules", ScheduleViewSet, basename="schedule")

urlpatterns = router.urls
