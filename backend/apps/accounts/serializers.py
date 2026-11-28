from functools import lru_cache
from zoneinfo import available_timezones

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from rest_framework import serializers

from apps.core.exceptions import InvalidCredentials

from .models import NotificationSettings, User


@lru_cache(maxsize=1)
def _valid_timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def check_timezone(value: str) -> str:
    if value not in _valid_timezones():
        raise serializers.ValidationError("Unknown timezone.")
    return value


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "display_name", "timezone"]
        read_only_fields = ["id", "email"]

    def validate_timezone(self, value: str) -> str:
        return check_timezone(value)


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = User
        fields = ["id", "email", "password", "display_name", "timezone"]
        read_only_fields = ["id"]

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_timezone(self, value: str) -> str:
        return check_timezone(value)

    def validate(self, attrs):
        if User.objects.filter(email__iexact=attrs["email"]).exists():
            raise serializers.ValidationError("Could not create the account.")
        candidate = User(email=attrs["email"], display_name=attrs.get("display_name", ""))
        try:
            validate_password(attrs["password"], candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)}) from exc
        return attrs

    def create(self, validated_data):
        try:
            return User.objects.create_user(**validated_data)
        except IntegrityError as exc:  # two sign-ups with the same email at once
            raise serializers.ValidationError("Could not create the account.") from exc


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        user = authenticate(
            self.context.get("request"),
            username=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if user is None:
            raise InvalidCredentials()
        attrs["user"] = user
        return attrs


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = [
            "email_enabled",
            "push_enabled",
            "appointment_reminder_minutes",
            "missed_dose_grace_minutes",
        ]
