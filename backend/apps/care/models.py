from django.conf import settings
from django.db import models
from django.db.models import F, Q


class CareLink(models.Model):
    class Permission(models.TextChoices):
        VIEW = "view", "View"
        EDIT = "edit", "Edit"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        DECLINED = "declined", "Declined"
        REVOKED = "revoked", "Revoked"

    caregiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="care_links_as_caregiver",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="care_links_as_recipient",
    )
    permission = models.CharField(
        max_length=10, choices=Permission.choices, default=Permission.VIEW
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=~Q(caregiver=F("recipient")), name="care_link_not_self"
            ),
            models.UniqueConstraint(
                fields=["caregiver", "recipient"],
                condition=Q(status__in=["pending", "active"]),
                name="care_link_unique_open",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.caregiver} -> {self.recipient} ({self.status}, {self.permission})"
