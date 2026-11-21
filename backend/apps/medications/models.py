from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models

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
