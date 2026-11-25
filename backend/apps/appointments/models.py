# Create your models here.
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Appointment(models.Model):
    class Type(models.TextChoices):
        CHECKUP = "checkup", "Check-up"
        CONSULTATION = "consultation", "Consultation"
        IMAGING = "imaging", "Imaging (X-ray, CT, MRI, PET)"
        LAB_TEST = "lab_test", "Lab test"
        PROCEDURE = "procedure", "Procedure"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appointments"
    )
    title = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.OTHER)
    provider_name = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200, blank=True)
    starts_at = models.DateTimeField()  # always stored in UTC
    duration_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(24 * 60)],
    )
    preparation = models.TextField(blank=True)  # what the clinic told you to do beforehand
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.SCHEDULED)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["starts_at", "id"]
        indexes = [models.Index(fields=["owner", "starts_at"])]

    def __str__(self) -> str:
        return f"{self.title} ({self.owner}) {self.starts_at:%Y-%m-%d %H:%M}"
