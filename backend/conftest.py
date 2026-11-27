import pytest

PASSWORD = "Tr0ub4dor&3-fake"


@pytest.fixture
def make_user(db):
    def _make(email: str, **kwargs):
        from apps.accounts.models import User

        return User.objects.create_user(email=email, password=PASSWORD, **kwargs)

    return _make


@pytest.fixture
def alex(make_user):
    return make_user("alex@example.com", display_name="Alex")


@pytest.fixture
def mum(make_user):
    return make_user("mum@example.com", display_name="Mum")


@pytest.fixture
def stranger(make_user):
    return make_user("stranger@example.com", display_name="Stranger")


@pytest.fixture
def make_link(db):
    def _make(caregiver, recipient, status="active", permission="view"):
        from apps.care.models import CareLink

        return CareLink.objects.create(
            caregiver=caregiver, recipient=recipient, status=status, permission=permission
        )

    return _make


@pytest.fixture
def client_for():
    from rest_framework.test import APIClient

    def _client(user):
        client = APIClient()
        client.force_login(user)
        return client

    return _client


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
def make_dose_log(db):
    def _make(schedule, scheduled_for, status="taken", **overrides):
        from apps.medications.models import DoseLog

        return DoseLog.objects.create(
            medication=schedule.medication,
            schedule=schedule,
            scheduled_for=scheduled_for,
            status=status,
            **overrides,
        )

    return _make