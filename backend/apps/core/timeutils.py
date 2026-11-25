from datetime import UTC, date, datetime, time
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework.exceptions import ValidationError

if TYPE_CHECKING:
    from apps.accounts.models import User


def owner_zone(owner: "User") -> ZoneInfo:
    try:
        return ZoneInfo(owner.timezone)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")  # timezones are validated on write; this is a safety net


def local_midnight(day: date, tz: ZoneInfo) -> datetime:
    """Midnight at the start of a local date, as a UTC instant."""
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


def parse_date_param(value: str | None, name: str) -> date | None:
    """Read a YYYY-MM-DD query parameter. A bad value becomes a 400 naming the parameter."""
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValidationError({name: ["Use the format YYYY-MM-DD."]}) from None
