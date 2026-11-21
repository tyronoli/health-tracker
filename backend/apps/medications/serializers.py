from rest_framework import serializers

from .models import Medication, Schedule


class MedicationSerializer(serializers.ModelSerializer):
    low_supply = serializers.BooleanField(read_only=True)

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "owner", "low_supply", "created_at", "updated_at"]


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
