from typing import ClassVar

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class UserManager(BaseUserManager["User"]):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email).strip().lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None  # type: ignore[assignment]
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=100, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    objects = UserManager()  # type: ignore[assignment, misc]

    def __str__(self) -> str:
        return self.email


class NotificationSettings(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_settings"
    )
    email_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    # How long before an appointment the reminder is sent (5 minutes to 7 days).
    appointment_reminder_minutes = models.PositiveIntegerField(
        default=1440, validators=[MinValueValidator(5), MaxValueValidator(7 * 24 * 60)]
    )
    # How long after its time an unlogged dose waits before it counts as missed
    # (5 minutes to 12 hours).
    missed_dose_grace_minutes = models.PositiveIntegerField(
        default=60, validators=[MinValueValidator(5), MaxValueValidator(12 * 60)]
    )

    def __str__(self) -> str:
        return f"Notification settings for {self.user}"

    @classmethod
    def for_user(cls, user: "User") -> "NotificationSettings":
        """The saved settings, or the defaults (not saved) if the user never changed anything."""
        try:
            return user.notification_settings
        except cls.DoesNotExist:
            return cls(user=user)
