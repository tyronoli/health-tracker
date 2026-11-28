import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.core.mail import send_mail

from apps.accounts.models import NotificationSettings, User
from apps.medications import scheduling
from apps.medications.models import DoseLog
from apps.medications.scheduling import DueDose

from .models import DoseReminder

logger = logging.getLogger(__name__)

# A reminder is still worth sending this long after the dose time. After that it is noise.
CATCH_UP = timedelta(minutes=30)


def due_for_reminder(owner: User, now: datetime) -> list[DueDose]:
    """Doses whose time has just passed, that nobody has logged yet."""
    today = scheduling.local_today(owner, now)
    candidates: list[DueDose] = []
    for day in (today - timedelta(days=1), today):  # yesterday too, for a dose just before midnight
        for due in scheduling.due_doses_for_date(owner, day):
            recent = now - CATCH_UP < due.scheduled_for <= now
            if recent and due.scheduled_for >= due.schedule.tracking_started_at:
                candidates.append(due)
    if not candidates:
        return []

    logged = set(
        DoseLog.objects.filter(
            schedule__in=[c.schedule for c in candidates],
            scheduled_for__in=[c.scheduled_for for c in candidates],
        ).values_list("schedule_id", "scheduled_for")
    )
    return [c for c in candidates if (c.schedule.pk, c.scheduled_for) not in logged]


def _claim(due: DueDose, now: datetime) -> DoseReminder | None:
    """Take the right to send this reminder. Only one caller can win, even across workers."""
    reminder, _ = DoseReminder.objects.get_or_create(
        schedule=due.schedule, scheduled_for=due.scheduled_for
    )
    won = DoseReminder.objects.filter(pk=reminder.pk, email_sent_at__isnull=True).update(
        email_sent_at=now
    )
    return reminder if won else None


def _release(reminders: list[DoseReminder]) -> None:
    DoseReminder.objects.filter(pk__in=[r.pk for r in reminders]).update(email_sent_at=None)


def _compose(owner: User, doses: list[DueDose]) -> tuple[str, str]:
    tz = scheduling.owner_zone(owner)
    lines = []
    for dose in doses:
        medication = dose.schedule.medication
        name = f"{medication.name} {medication.dosage}".strip()
        pills = dose.schedule.pills_per_dose
        time_text = dose.scheduled_for.astimezone(tz).strftime("%H:%M")
        lines.append(f"- {name}: {pills} {'pill' if pills == 1 else 'pills'} at {time_text}")

    if len(doses) == 1:
        subject = f"Time to take {doses[0].schedule.medication.name}"
    else:
        subject = f"Time to take {len(doses)} medications"

    body = (
        f"Hi {owner.display_name or 'there'},\n\n"
        "It's time for:\n" + "\n".join(lines) + f"\n\nLog it here: {settings.SITE_URL}/\n\n"
        "This is a reminder from your Health Tracker. It is not medical advice.\n"
    )
    return subject, body


def send_dose_reminders(now: datetime) -> int:
    """Email everyone whose dose time has just passed. Returns how many emails were sent."""
    owners = User.objects.filter(
        is_active=True, medications__active=True, medications__schedules__active=True
    ).distinct()

    sent = 0
    for owner in owners:
        if not NotificationSettings.for_user(owner).email_enabled or not owner.email:
            continue

        claimed = [(due, _claim(due, now)) for due in due_for_reminder(owner, now)]
        won = [(due, reminder) for due, reminder in claimed if reminder is not None]
        if not won:
            continue

        subject, body = _compose(owner, [due for due, _ in won])
        try:
            send_mail(
                subject, body, settings.DEFAULT_FROM_EMAIL, [owner.email], fail_silently=False
            )
        except Exception:
            # Give the claims back so the next run can try again. Log ids only, never content.
            logger.exception("Could not send a dose reminder email to user %s", owner.pk)
            _release([reminder for _, reminder in won])
            continue
        sent += 1
    return sent
