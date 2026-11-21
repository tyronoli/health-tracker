from typing import Any, cast

from django.db.models import QuerySet
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer

from apps.accounts.models import User
from apps.care.permissions import check_object_access, get_target_profile

from . import scheduling, services
from .models import Medication, Schedule
from .serializers import MedicationSerializer, RefillSerializer, ScheduleSerializer


class MedicationViewSet(viewsets.ModelViewSet):
    serializer_class = MedicationSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self) -> QuerySet[Medication]:
        """Only used by the list endpoint; detail routes go through get_object()."""
        if self.action != "list":
            return Medication.objects.none()
        user = cast(User, self.request.user)
        profile = get_target_profile(user, self.request.query_params.get("profile"))
        queryset = Medication.objects.filter(owner=profile)

        active = self.request.query_params.get("active")
        if active is not None:
            if active not in ("true", "false"):
                raise ValidationError({"active": ["Must be 'true' or 'false'."]})
            queryset = queryset.filter(active=(active == "true"))
        return queryset

    def get_object(self) -> Medication:
        user = cast(User, self.request.user)
        medication = Medication.objects.select_related("owner").filter(pk=self.kwargs["pk"]).first()
        if medication is None:
            raise NotFound()  # same answer as "exists but isn't yours"
        write = self.request.method not in SAFE_METHODS
        check_object_access(user, medication.owner, write=write)
        return medication

    def create(self, request: Request) -> Response:
        user = cast(User, request.user)
        profile_id = request.data.get("profile") if isinstance(request.data, dict) else None
        owner = get_target_profile(user, profile_id, write=True)  # check access first
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=owner)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance: Medication) -> None:
        instance.active = False  # soft delete: keep the history
        instance.save(update_fields=["active", "updated_at"])

    @action(detail=True, methods=["post"])
    def refill(self, request: Request, pk: str | None = None) -> Response:
        medication = self.get_object()  # POST counts as a write
        serializer = RefillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        medication = services.refill(medication, serializer.validated_data["pills_added"])
        return Response(MedicationSerializer(medication).data)

    @action(detail=True, methods=["get", "post"], url_path="schedules")
    def schedules(self, request: Request, pk: str | None = None) -> Response:
        medication = self.get_object()  # GET needs read access, POST needs write access
        if request.method == "GET":
            return Response(ScheduleSerializer(medication.schedules.all(), many=True).data)
        serializer = ScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(medication=medication, tracking_started_at=scheduling.current_time())
        return Response(serializer.data, status=status.HTTP_201_CREATED)


TIMING_FIELDS = ("time_of_day", "days_of_week", "start_date", "end_date")


class ScheduleViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = ScheduleSerializer
    http_method_names = ["patch", "delete", "head", "options"]
    lookup_value_regex = "[0-9]+"

    def get_object(self) -> Schedule:
        user = cast(User, self.request.user)
        schedule = (
            Schedule.objects.select_related("medication__owner")
            .filter(pk=self.kwargs["pk"])
            .first()
        )
        if schedule is None:
            raise NotFound()
        check_object_access(user, schedule.medication.owner, write=True)  # every route here writes
        return schedule

    def perform_update(self, serializer: BaseSerializer[Any]) -> None:
        schedule = cast(Schedule, serializer.instance)
        data = serializer.validated_data
        retimed = any(f in data and data[f] != getattr(schedule, f) for f in TIMING_FIELDS)
        reactivated = data.get("active") is True and not schedule.active
        if retimed or reactivated:
            # Doses before this moment must never be auto-marked as missed (see 4b).
            serializer.save(tracking_started_at=scheduling.current_time())
        else:
            serializer.save()
