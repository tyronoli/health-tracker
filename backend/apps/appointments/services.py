from datetime import datetime, timedelta

from django.db.models import QuerySet
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.core.timeutils import local_midnight, owner_zone, parse_date_param

from .models import Appointment


def current_time() -> datetime:
    """The one place that asks 'what time is it?', so tests can freeze it.

    Always call it as `services.current_time()` so the replacement takes effect.
    """
    return timezone.now()


def filter_appointments(owner: User, params, now: datetime) -> QuerySet[Appointment]:
    """Apply the list filters: from/to dates, type, status and upcoming."""
    queryset = Appointment.objects.filter(owner=owner)

    # Dates are the owner's local dates, not the caller's.
    tz = owner_zone(owner)
    start = parse_date_param(params.get("from"), "from")
    end = parse_date_param(params.get("to"), "to")
    if start is not None:
        queryset = queryset.filter(starts_at__gte=local_midnight(start, tz))
    if end is not None:
        queryset = queryset.filter(starts_at__lt=local_midnight(end + timedelta(days=1), tz))

    type_value = params.get("type")
    if type_value is not None:
        if type_value not in Appointment.Type.values:
            raise ValidationError({"type": ["Not a valid type."]})
        queryset = queryset.filter(type=type_value)

    status_value = params.get("status")
    if status_value is not None:
        if status_value not in Appointment.Status.values:
            raise ValidationError({"status": ["Not a valid status."]})
        queryset = queryset.filter(status=status_value)

    upcoming = params.get("upcoming")
    if upcoming is None:
        return queryset.order_by("starts_at", "id")
    if upcoming == "true":
        return queryset.filter(starts_at__gte=now, status=Appointment.Status.SCHEDULED).order_by(
            "starts_at", "id"
        )
    if upcoming == "false":
        return queryset.filter(starts_at__lt=now).order_by("-starts_at", "-id")
    raise ValidationError({"upcoming": ["Must be 'true' or 'false'."]})
