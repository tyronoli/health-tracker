from rest_framework import serializers

from apps.accounts.models import User

from .models import CareLink


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "display_name", "email"]
        read_only_fields = fields


class CareLinkSerializer(serializers.ModelSerializer):
    caregiver = UserSummarySerializer(read_only=True)
    recipient = UserSummarySerializer(read_only=True)

    class Meta:
        model = CareLink
        fields = [
            "id",
            "caregiver",
            "recipient",
            "permission",
            "status",
            "created_at",
            "responded_at",
        ]
        read_only_fields = fields


class InviteSerializer(serializers.Serializer):
    email = serializers.EmailField()
    permission = serializers.ChoiceField(
        choices=CareLink.Permission.choices, default=CareLink.Permission.VIEW
    )


class AcceptSerializer(serializers.Serializer):
    permission = serializers.ChoiceField(choices=CareLink.Permission.choices, required=False)


class PermissionSerializer(serializers.Serializer):
    permission = serializers.ChoiceField(choices=CareLink.Permission.choices)
