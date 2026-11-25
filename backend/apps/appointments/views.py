from typing import cast

from django.db.models import QuerySet
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.permissions import SAFE_METHODS
from rest_framework.request import Request
from rest_framework.response import Response

from apps.accounts.models import User
from apps.care.permissions import check_object_access, get_target_profile

from . import services
from .models import Appointment
from .serializers import AppointmentSerializer


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self) -> QuerySet[Appointment]:
        """Only used by the list endpoint; detail routes go through get_object()."""
        if self.action != "list":
            return Appointment.objects.none()
        user = cast(User, self.request.user)
        owner = get_target_profile(user, self.request.query_params.get("profile"))
        return services.filter_appointments(
            owner, self.request.query_params, services.current_time()
        )

    def get_object(self) -> Appointment:
        user = cast(User, self.request.user)
        appointment = (
            Appointment.objects.select_related("owner").filter(pk=self.kwargs["pk"]).first()
        )
        if appointment is None:
            raise NotFound()  # same answer as "exists but isn't yours"
        write = self.request.method not in SAFE_METHODS
        check_object_access(user, appointment.owner, write=write)
        return appointment

    def create(self, request: Request) -> Response:
        user = cast(User, request.user)
        profile_id = request.data.get("profile") if isinstance(request.data, dict) else None
        owner = get_target_profile(user, profile_id, write=True)  # check access first
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=owner)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
