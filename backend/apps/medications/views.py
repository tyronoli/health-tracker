from typing import Any, cast

from django.db.models import F, QuerySet
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import BaseSerializer
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.care.permissions import check_object_access, get_target_profile

from . import doses, refills, scheduling
from .models import DoseLog, Medication, Schedule
from .serializers import (
    DoseCreateSerializer,
    DoseLogSerializer,
    DoseUpdateSerializer,
    MedicationSerializer,
    RefillSerializer,
    ScheduleSerializer,
)


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
        queryset = (
            Medication.objects.filter(owner=profile)
            .select_related("owner")
            .prefetch_related("schedules")
        )

        active = self.request.query_params.get("active")
        if active is not None:
            if active not in ("true", "false"):
                raise ValidationError({"active": ["Must be 'true' or 'false'."]})
            queryset = queryset.filter(active=(active == "true"))
        return queryset

    def get_object(self) -> Medication:
        user = cast(User, self.request.user)
        medication = (
            Medication.objects.select_related("owner")
            .prefetch_related("schedules")
            .filter(pk=self.kwargs["pk"])
            .first()
        )
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

    def perform_update(self, serializer: BaseSerializer[Any]) -> None:
        medication = cast(Medication, serializer.instance)
        data = serializer.validated_data
        pills = data.get("pills_remaining", medication.pills_remaining)
        threshold = data.get("refill_threshold", medication.refill_threshold)
        serializer.save(
            low_supply_alert_raised_at=refills.next_alert_state(
                was_low=medication.low_supply,
                is_low=pills <= threshold,
                current=medication.low_supply_alert_raised_at,
                now=scheduling.current_time(),
            )
        )

    @action(detail=True, methods=["post"])
    def refill(self, request: Request, pk: str | None = None) -> Response:
        medication = self.get_object()
        serializer = RefillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        medication = refills.refill(
            medication, serializer.validated_data["pills_added"], scheduling.current_time()
        )
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
        # Freeze history under the old rules before they change.
        doses.mark_missed_doses(scheduling.current_time(), owner=schedule.medication.owner)
        data = serializer.validated_data
        retimed = any(f in data and data[f] != getattr(schedule, f) for f in TIMING_FIELDS)
        reactivated = data.get("active") is True and not schedule.active
        if retimed or reactivated:
            serializer.save(tracking_started_at=scheduling.current_time())
        else:
            serializer.save()

    def perform_destroy(self, instance: Schedule) -> None:
        doses.mark_missed_doses(scheduling.current_time(), owner=instance.medication.owner)
        instance.delete()


class DoseViewSet(viewsets.GenericViewSet):
    http_method_names = ["get", "post", "patch", "head", "options"]
    lookup_value_regex = "[0-9]+"

    def list(self, request: Request) -> Response:
        user = cast(User, request.user)
        profile = get_target_profile(user, request.query_params.get("profile"))
        queryset = doses.history(profile, request.query_params)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(DoseLogSerializer(page, many=True).data)

    @action(detail=False, methods=["get"])
    def today(self, request: Request) -> Response:
        user = cast(User, request.user)
        profile = get_target_profile(user, request.query_params.get("profile"))
        return Response(doses.todays_doses(profile, scheduling.current_time()))

    def create(self, request: Request) -> Response:
        user = cast(User, request.user)
        serializer = DoseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        schedule = (
            Schedule.objects.select_related("medication__owner").filter(pk=data["schedule"]).first()
        )
        if schedule is None:
            raise NotFound()
        # The owner comes from the schedule itself, never from a request field.
        check_object_access(user, schedule.medication.owner, write=True)

        log = doses.log_dose(
            schedule,
            scheduled_for=data["scheduled_for"],
            status=data["status"],
            note=data.get("note", ""),
            medication_id=data.get("medication"),
            now=scheduling.current_time(),
        )
        return Response(DoseLogSerializer(log).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        user = cast(User, request.user)
        log = (
            DoseLog.objects.select_related("medication__owner").filter(pk=self.kwargs["pk"]).first()
        )
        if log is None:
            raise NotFound()
        check_object_access(user, log.medication.owner, write=True)

        serializer = DoseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        log = doses.correct_dose(
            log,
            status=serializer.validated_data.get("status"),
            note=serializer.validated_data.get("note"),
            now=scheduling.current_time(),
        )
        return Response(DoseLogSerializer(log).data)


class LowSupplyView(APIView):
    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        profile = get_target_profile(user, request.query_params.get("profile"))
        medications = (
            Medication.objects.filter(
                owner=profile, active=True, pills_remaining__lte=F("refill_threshold")
            )
            .select_related("owner")
            .prefetch_related("schedules")
            .order_by("pills_remaining", "name", "id")
        )
        return Response(MedicationSerializer(medications, many=True).data)
