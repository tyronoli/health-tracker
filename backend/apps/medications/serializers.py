from rest_framework import serializers

from .models import Medication


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
