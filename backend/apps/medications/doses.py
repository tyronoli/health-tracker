from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.core.exceptions import Conflict

from . import refills, scheduling
from .models import DoseLog, Schedule

MAX_EARLY_LOGGING = timedelta(hours=24)
DEFAULT_LOOKBACK_DAYS = 3


def grace_period() -> timedelta:
    return timedelta(minutes=settings.MISSED_DOSE_GRACE_MINUTES)


# ---------- log and correct ----------


def log_dose(
    schedule: Schedule,
    *,
    scheduled_for: datetime,
    status: str,
    note: str,
    medication_id: int | None,
    now: datetime,
) -> DoseLog:
    medication = schedule.medication
    if medication_id is not None and medication_id != medication.pk:
        raise ValidationError({"medication": ["Does not belong to this schedule."]})
    if not (schedule.active and medication.active):
        raise ValidationError({"schedule": ["This schedule is not active."]})

    tz = scheduling.owner_zone(medication.owner)
    local_date = scheduled_for.astimezone(tz).date()
    matches = (
        schedule.start_date <= local_date
        and (schedule.end_date is None or local_date <= schedule.end_date)
        and local_date.weekday() in schedule.days_of_week
        and scheduling.scheduled_instant(schedule, local_date, tz) == scheduled_for
    )
    if not matches:
        raise ValidationError({"scheduled_for": ["Does not match a dose of this schedule."]})
    if scheduled_for > now + MAX_EARLY_LOGGING:
        raise ValidationError({"scheduled_for": ["Too far in the future."]})

    try:
        with transaction.atomic():
            log = DoseLog.objects.create(
                medication=medication,
                schedule=schedule,
                scheduled_for=scheduled_for,
                status=status,
                note=note,
                logged_at=now,
            )
            # Everything here is one transaction: a duplicate (IntegrityError above)
            # rolls back before any pills are touched.
            if status == DoseLog.Status.TAKEN:
                log.pills_used = refills.take_pills(medication.pk, schedule.pills_per_dose, now)
                log.save(update_fields=["pills_used"])
            return log
    except IntegrityError:
        raise Conflict("This dose has already been logged.", code="already_logged") from None


def correct_dose(log: DoseLog, *, status: str | None, note: str | None, now: datetime) -> DoseLog:
    with transaction.atomic():
        if status is not None and status != log.status:
            if log.status == DoseLog.Status.TAKEN:
                refills.return_pills(
                    log.medication_id, log.pills_used, now
                )  # exactly what was deducted
                log.pills_used = 0
            if status == DoseLog.Status.TAKEN and log.schedule is not None:
                log.pills_used = refills.take_pills(
                    log.medication_id, log.schedule.pills_per_dose, now
                )
            log.status = status
            log.logged_at = now
        if note is not None:
            log.note = note
        log.save(update_fields=["status", "note", "logged_at", "pills_used"])
    return log


# ---------- today ----------


def todays_doses(owner: User, now: datetime) -> dict[str, Any]:
    tz = scheduling.owner_zone(owner)
    local_date = now.astimezone(tz).date()
    due = scheduling.due_doses_for_date(owner, local_date)
    logs = {
        (log.schedule_id, log.scheduled_for): log
        for log in DoseLog.objects.filter(
            schedule__in=[d.schedule for d in due],
            scheduled_for__in=[d.scheduled_for for d in due],
        )
    }
    grace = grace_period()
    items = []
    for d in due:
        log = logs.get((d.schedule.pk, d.scheduled_for))
        if log is not None:
            status = log.status
        elif d.scheduled_for + grace <= now and d.scheduled_for >= d.schedule.tracking_started_at:
            status = DoseLog.Status.MISSED.value
        else:
            status = "pending"
        medication = d.schedule.medication
        items.append(
            {
                "schedule": d.schedule.pk,
                "medication": {
                    "id": medication.pk,
                    "name": medication.name,
                    "dosage": medication.dosage,
                },
                "scheduled_for": d.scheduled_for,
                "status": status,
                "dose_log_id": log.pk if log else None,
                "logged_at": log.logged_at if log else None,
                "pills_per_dose": d.schedule.pills_per_dose,
            }
        )
    return {"date": local_date.isoformat(), "timezone": str(tz), "doses": items}


# ---------- history ----------


def _parse_date(value: str | None, name: str) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({name: ["Use the format YYYY-MM-DD."]}) from None


def _local_midnight(day: date, tz: ZoneInfo) -> datetime:
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


def history(owner: User, params: Any) -> QuerySet[DoseLog]:
    queryset = DoseLog.objects.filter(medication__owner=owner)
    tz = scheduling.owner_zone(owner)

    start = _parse_date(params.get("from"), "from")
    end = _parse_date(params.get("to"), "to")
    if start is not None:
        queryset = queryset.filter(scheduled_for__gte=_local_midnight(start, tz))
    if end is not None:
        queryset = queryset.filter(scheduled_for__lt=_local_midnight(end + timedelta(days=1), tz))

    medication = params.get("medication")
    if medication is not None:
        try:
            queryset = queryset.filter(medication_id=int(medication))
        except ValueError:
            raise ValidationError({"medication": ["Must be a number."]}) from None

    status = params.get("status")
    if status is not None:
        if status not in DoseLog.Status.values:
            raise ValidationError({"status": ["Not a valid status."]})
        queryset = queryset.filter(status=status)
    return queryset


# ---------- the missed-dose job ----------


def mark_missed_doses(
    now: datetime, *, lookback_days: int = DEFAULT_LOOKBACK_DAYS, owner: User | None = None
) -> int:
    """Write 'missed' logs for unlogged doses whose grace period is over. Safe to repeat."""
    grace = grace_period()
    if owner is not None:
        owners = [owner]
    else:
        owners = list(
            User.objects.filter(
                is_active=True,
                medications__active=True,
                medications__schedules__active=True,
            ).distinct()
        )

    created = 0
    for person in owners:
        today = scheduling.local_today(person, now)
        candidates = []
        for offset in range(lookback_days + 1):
            for due in scheduling.due_doses_for_date(person, today - timedelta(days=offset)):
                if (
                    due.scheduled_for + grace <= now
                    and due.scheduled_for >= due.schedule.tracking_started_at
                ):
                    candidates.append(due)
        if not candidates:
            continue

        existing = set(
            DoseLog.objects.filter(
                schedule__in=[c.schedule for c in candidates],
                scheduled_for__in=[c.scheduled_for for c in candidates],
            ).values_list("schedule_id", "scheduled_for")
        )
        new_logs = [
            DoseLog(
                medication_id=c.schedule.medication_id,
                schedule=c.schedule,
                scheduled_for=c.scheduled_for,
                status=DoseLog.Status.MISSED,
                logged_at=now,
            )
            for c in candidates
            if (c.schedule.pk, c.scheduled_for) not in existing
        ]
        # ignore_conflicts makes a second, simultaneous run harmless.
        DoseLog.objects.bulk_create(new_logs, ignore_conflicts=True)
        created += len(new_logs)
    return created
