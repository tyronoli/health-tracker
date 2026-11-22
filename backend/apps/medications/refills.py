from datetime import datetime

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import MAX_PILLS, Medication


def next_alert_state(
    *, was_low: bool, is_low: bool, current: datetime | None, now: datetime
) -> datetime | None:
    """Raise the alert on a downward crossing, clear it when back above, else leave it."""
    if not is_low:
        return None
    if not was_low:
        return now
    return current


def _set_stock(medication: Medication, new_total: int, now: datetime) -> None:
    was_low = medication.low_supply
    medication.pills_remaining = new_total
    medication.low_supply_alert_raised_at = next_alert_state(
        was_low=was_low,
        is_low=medication.low_supply,
        current=medication.low_supply_alert_raised_at,
        now=now,
    )
    medication.save(update_fields=["pills_remaining", "low_supply_alert_raised_at", "updated_at"])


def take_pills(medication_id: int, amount: int, now: datetime) -> int:
    """Deduct up to `amount` pills (never below zero). Returns what was actually deducted."""
    with transaction.atomic():
        medication = Medication.objects.select_for_update().get(pk=medication_id)
        used = min(amount, medication.pills_remaining)
        if used:
            _set_stock(medication, medication.pills_remaining - used, now)
        return used


def return_pills(medication_id: int, amount: int, now: datetime) -> None:
    if amount <= 0:
        return
    with transaction.atomic():
        medication = Medication.objects.select_for_update().get(pk=medication_id)
        _set_stock(medication, min(MAX_PILLS, medication.pills_remaining + amount), now)


def refill(medication: Medication, pills_added: int, now: datetime) -> Medication:
    with transaction.atomic():
        # Lock the row so two changes at the same moment can't overwrite each other.
        locked = Medication.objects.select_for_update().get(pk=medication.pk)
        new_total = locked.pills_remaining + pills_added
        if new_total > MAX_PILLS:
            raise ValidationError({"pills_added": [f"Total pills cannot exceed {MAX_PILLS}."]})
        _set_stock(locked, new_total, now)
    return locked


def days_supply_left(medication: Medication, now: datetime) -> int | None:
    """Whole days the current supply lasts at the usual rate; None if it can't be estimated."""
    from . import scheduling  # imported here to keep the module graph simple

    if not medication.active:
        return None
    today = scheduling.local_today(medication.owner, now)
    pills_per_week = sum(
        s.pills_per_dose * len(s.days_of_week)
        for s in medication.schedules.all()
        if s.active and s.start_date <= today and (s.end_date is None or s.end_date >= today)
    )
    if pills_per_week == 0:
        return None
    return medication.pills_remaining * 7 // pills_per_week
