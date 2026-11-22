from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

MAX_PILLS = 100_000


class Medication(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="medications"
    )
    name = models.CharField(max_length=200)
    dosage = models.CharField(max_length=100, blank=True)
    instructions = models.TextField(blank=True)
    pills_remaining = models.PositiveIntegerField(
        default=0, validators=[MaxValueValidator(MAX_PILLS)]
    )
    refill_threshold = models.PositiveIntegerField(
        default=0, validators=[MaxValueValidator(MAX_PILLS)]
    )
    active = models.BooleanField(default=True)
    low_supply_alert_raised_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        indexes = [models.Index(fields=["owner", "active"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.owner})"

    @property
    def low_supply(self) -> bool:
        return self.pills_remaining <= self.refill_threshold


class Schedule(models.Model):
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name="schedules")
    time_of_day = models.TimeField()  # the owner's local wall-clock time
    days_of_week = ArrayField(
        models.PositiveSmallIntegerField(validators=[MaxValueValidator(6)]), size=7
    )  # Monday = 0 ... Sunday = 6
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    pills_per_dose = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(100)]
    )
    active = models.BooleanField(default=True)
    tracking_started_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["time_of_day", "id"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_date__isnull=True) | Q(end_date__gte=F("start_date")),
                name="schedule_end_not_before_start",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.medication.name} at {self.time_of_day:%H:%M}"


class DoseLog(models.Model):
    class Status(models.TextChoices):
        TAKEN = "taken", "Taken"
        SKIPPED = "skipped", "Skipped"
        MISSED = "missed", "Missed"

    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name="dose_logs")
    schedule = models.ForeignKey(
        Schedule, on_delete=models.SET_NULL, null=True, blank=True, related_name="dose_logs"
    )
    scheduled_for = models.DateTimeField()  # the exact instant, stored in UTC
    status = models.CharField(max_length=10, choices=Status.choices)
    logged_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=500, blank=True)
    pills_used = models.PositiveSmallIntegerField(default=0)  # what this log deducted

    class Meta:
        ordering = ["-scheduled_for", "-id"]
        indexes = [models.Index(fields=["medication", "scheduled_for"])]
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "scheduled_for"],
                condition=Q(schedule__isnull=False),
                name="dose_log_unique_per_schedule_time",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.medication.name} {self.scheduled_for:%Y-%m-%d %H:%M} {self.status}"
