import pytest


@pytest.fixture
def make_medication(db):
    def _make(owner, **overrides):
        from apps.medications.models import Medication

        data = {
            "name": "Metformin",
            "dosage": "500 mg",
            "pills_remaining": 30,
            "refill_threshold": 10,
        }
        data.update(overrides)
        return Medication.objects.create(owner=owner, **data)

    return _make


@pytest.fixture
def make_schedule(db):
    def _make(medication, **overrides):
        from datetime import UTC, date, datetime, time

        from apps.medications.models import Schedule

        data = {
            "time_of_day": time(8, 0),
            "days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "start_date": date(2026, 1, 1),
            "tracking_started_at": datetime(2020, 1, 1, tzinfo=UTC),
        }
        data.update(overrides)
        return Schedule.objects.create(medication=medication, **data)

    return _make


@pytest.fixture
def freeze_now(monkeypatch):
    """Freeze 'now' for code that asks scheduling.current_time()."""

    def _freeze(value):
        monkeypatch.setattr("apps.medications.scheduling.current_time", lambda: value)

    return _freeze
