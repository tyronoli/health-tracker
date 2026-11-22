from dataclasses import dataclass
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import User

from .models import Schedule


def current_time() -> datetime:
    """The one place that asks 'what time is it?'. Tests replace it to freeze time.

    Always call it as `scheduling.current_time()` so the replacement takes effect.
    """
    return timezone.now()


def owner_zone(owner: User) -> ZoneInfo:
    try:
        return ZoneInfo(owner.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")  # timezones are validated on write; this is a safety net


def local_today(owner: User, now: datetime) -> date:
    return now.astimezone(owner_zone(owner)).date()


def scheduled_instant(schedule: Schedule, local_date: date, tz: ZoneInfo) -> datetime:
    """Local wall-clock time on a local date -> a UTC instant.

    zoneinfo's default (fold=0) gives the rules we want for daylight saving:
    a skipped time is shifted forward, and a repeated time uses its first occurrence.
    """
    local = datetime.combine(local_date, schedule.time_of_day, tzinfo=tz)
    return local.astimezone(UTC)


@dataclass(frozen=True)
class DueDose:
    schedule: Schedule
    scheduled_for: datetime  # UTC


def due_doses_for_date(owner: User, local_date: date) -> list[DueDose]:
    """Every dose the owner should take on a given local date, earliest first."""
    tz = owner_zone(owner)
    schedules = (
        Schedule.objects.filter(
            medication__owner=owner,
            medication__active=True,
            active=True,
            start_date__lte=local_date,
            days_of_week__contains=[local_date.weekday()],
        )
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=local_date))
        .select_related("medication")
    )
    due = [DueDose(s, scheduled_instant(s, local_date, tz)) for s in schedules]
    due.sort(key=lambda d: (d.scheduled_for, d.schedule.medication.name, d.schedule.pk))
    return due
