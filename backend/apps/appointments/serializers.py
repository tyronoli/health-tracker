from django.utils import timezone
from rest_framework import serializers

from .models import Appointment


class AwareDateTimeField(serializers.DateTimeField):
    """A date and time that must say which timezone it is in.

    Without this, DRF would quietly treat "2026-11-26T09:30:00" as UTC, and a user in
    Manila would get an appointment eight hours off.
    """

    def enforce_timezone(self, value):
        if timezone.is_naive(value):
            raise serializers.ValidationError(
                "Include a timezone offset, for example "
                "2026-11-26T09:30:00+08:00 or 2026-11-26T01:30:00Z."
            )
        return super().enforce_timezone(value)


class AppointmentSerializer(serializers.ModelSerializer):
    starts_at = AwareDateTimeField()

    class Meta:
        model = Appointment
        fields = [
            "id",
            "owner",
            "title",
            "type",
            "provider_name",
            "location",
            "starts_at",
            "duration_minutes",
            "preparation",
            "notes",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "created_at", "updated_at"]
        extra_kwargs = {
            "preparation": {"max_length": 2000},
            "notes": {"max_length": 5000},
        }
