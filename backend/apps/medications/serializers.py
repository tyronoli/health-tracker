from rest_framework import serializers

from . import refills, scheduling
from .models import DoseLog, Medication, Schedule


class MedicationSerializer(serializers.ModelSerializer):
    low_supply = serializers.BooleanField(read_only=True)
    days_supply_left = serializers.SerializerMethodField()

    class Meta:
        model = Medication
        fields = [
            "id",
            "owner",
            "name",
            "dosage",
            "instructions",
            "pills_remaining",
            "refill_threshold",
            "active",
            "low_supply",
            "days_supply_left",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "low_supply",
            "days_supply_left",
            "created_at",
            "updated_at",
        ]

    def get_days_supply_left(self, obj: Medication) -> int | None:
        return refills.days_supply_left(obj, scheduling.current_time())


class RefillSerializer(serializers.Serializer):
    pills_added = serializers.IntegerField(min_value=1, max_value=10_000)


class ScheduleSerializer(serializers.ModelSerializer):
    time_of_day = serializers.TimeField(format="%H:%M", input_formats=["%H:%M", "%H:%M:%S"])
    days_of_week = serializers.ListField(
        child=serializers.IntegerField(min_value=0, max_value=6),
        allow_empty=False,
        max_length=7,
    )

    class Meta:
        model = Schedule
        fields = [
            "id",
            "medication",
            "time_of_day",
            "days_of_week",
            "start_date",
            "end_date",
            "pills_per_dose",
            "active",
        ]
        read_only_fields = ["id", "medication"]

    def validate_time_of_day(self, value):
        return value.replace(second=0, microsecond=0)

    def validate_days_of_week(self, value: list[int]) -> list[int]:
        return sorted(set(value))

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": ["End date cannot be before the start date."]}
            )
        return attrs


class DoseLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DoseLog
        fields = ["id", "medication", "schedule", "scheduled_for", "status", "logged_at", "note"]
        read_only_fields = fields


EDITABLE_STATUSES = ["taken", "skipped"]  # "missed" is only ever set by the system


class DoseCreateSerializer(serializers.Serializer):
    schedule = serializers.IntegerField()
    scheduled_for = serializers.DateTimeField()
    status = serializers.ChoiceField(choices=EDITABLE_STATUSES)
    note = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")
    medication = serializers.IntegerField(required=False)


class DoseUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=EDITABLE_STATUSES, required=False)
    note = serializers.CharField(max_length=500, allow_blank=True, required=False)
