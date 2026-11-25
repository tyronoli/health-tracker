import pytest


@pytest.fixture
def make_appointment(db):
    def _make(owner, **overrides):
        from datetime import UTC, datetime

        from apps.appointments.models import Appointment

        data = {
            "title": "Check-up",
            "type": "checkup",
            "starts_at": datetime(2026, 11, 26, 2, 0, tzinfo=UTC),
        }
        data.update(overrides)
        return Appointment.objects.create(owner=owner, **data)

    return _make


@pytest.fixture
def freeze_now(monkeypatch):
    """Freeze 'now' for code that asks appointments.services.current_time()."""

    def _freeze(value):
        monkeypatch.setattr("apps.appointments.services.current_time", lambda: value)

    return _freeze
