from django.db import models


class DoseReminder(models.Model):
    """Remembers that a reminder was sent for one dose, so it is never sent twice.

    Doses are calculated from schedules and have no row of their own until they are
    logged, so the dose's identity (schedule + exact time) is what we record here.
    """

    schedule = models.ForeignKey(
        "medications.Schedule", on_delete=models.CASCADE, related_name="reminders"
    )
    scheduled_for = models.DateTimeField()
    email_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "scheduled_for"], name="dose_reminder_unique_per_dose"
            ),
        ]

    def __str__(self) -> str:
        return f"Reminder for {self.schedule_id} at {self.scheduled_for:%Y-%m-%d %H:%M}"
