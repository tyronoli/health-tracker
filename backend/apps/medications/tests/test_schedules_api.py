from datetime import UTC, datetime

import pytest
from rest_framework.test import APIClient

from apps.core.testing import matrix, prepare
from apps.medications.models import Schedule

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 17, 3, 0, tzinfo=UTC)
PAYLOAD = {
    "time_of_day": "08:00",
    "days_of_week": [0, 1, 2, 3, 4, 5, 6],
    "start_date": "2026-11-17",
}


def list_url(med):
    return f"/api/medications/{med.id}/schedules/"


def detail_url(schedule):
    return f"/api/schedules/{schedule.id}/"


# ---------- create ----------


def test_create_schedule(client_for, make_medication, freeze_now, alex):
    freeze_now(NOW)
    med = make_medication(alex)
    resp = client_for(alex).post(list_url(med), PAYLOAD, format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["medication"] == med.id
    assert body["time_of_day"] == "08:00"
    assert body["pills_per_dose"] == 1
    assert body["active"] is True
    assert body["end_date"] is None
    assert Schedule.objects.get().tracking_started_at == NOW


def test_create_normalizes_days_and_time(client_for, make_medication, alex):
    med = make_medication(alex)
    payload = {**PAYLOAD, "days_of_week": [3, 1, 1], "time_of_day": "08:00:30"}
    body = client_for(alex).post(list_url(med), payload, format="json").json()
    assert body["days_of_week"] == [1, 3]
    assert body["time_of_day"] == "08:00"


@pytest.mark.parametrize(
    "override",
    [
        {"days_of_week": []},
        {"days_of_week": [7]},
        {"days_of_week": [-1]},
        {"days_of_week": ["mon"]},
        {"time_of_day": "25:00"},
        {"time_of_day": "8am"},
        {"start_date": "not-a-date"},
        {"start_date": "2026-11-17", "end_date": "2026-11-16"},
        {"pills_per_dose": 0},
        {"pills_per_dose": 101},
    ],
)
def test_create_validates_input(client_for, make_medication, alex, override):
    med = make_medication(alex)
    resp = client_for(alex).post(list_url(med), {**PAYLOAD, **override}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"
    assert Schedule.objects.count() == 0


def test_start_date_is_required(client_for, make_medication, alex):
    med = make_medication(alex)
    payload = {k: v for k, v in PAYLOAD.items() if k != "start_date"}
    assert client_for(alex).post(list_url(med), payload, format="json").status_code == 400


def test_medication_in_body_is_ignored(client_for, make_medication, alex, stranger):
    mine = make_medication(alex)
    theirs = make_medication(stranger)
    resp = client_for(alex).post(
        list_url(mine), {**PAYLOAD, "medication": theirs.id}, format="json"
    )
    assert resp.status_code == 201
    assert Schedule.objects.get().medication == mine


# ---------- list ----------


def test_list_returns_this_medications_schedules_in_time_order(
    client_for, make_medication, make_schedule, alex
):
    from datetime import time

    med = make_medication(alex)
    other = make_medication(alex, name="Other")
    make_schedule(med, time_of_day=time(20, 0))
    make_schedule(med, time_of_day=time(8, 0))
    make_schedule(other, time_of_day=time(12, 0))
    body = client_for(alex).get(list_url(med)).json()
    assert [s["time_of_day"] for s in body] == ["08:00", "20:00"]


def test_inactive_medications_still_list_their_schedules(
    client_for, make_medication, make_schedule, alex
):
    med = make_medication(alex, active=False)
    make_schedule(med)
    assert len(client_for(alex).get(list_url(med)).json()) == 1


# ---------- update ----------


def test_update_schedule(client_for, make_medication, make_schedule, alex):
    schedule = make_schedule(make_medication(alex))
    resp = client_for(alex).patch(detail_url(schedule), {"pills_per_dose": 2}, format="json")
    assert resp.status_code == 200
    schedule.refresh_from_db()
    assert schedule.pills_per_dose == 2


def test_medication_cannot_be_changed(client_for, make_medication, make_schedule, alex):
    schedule = make_schedule(make_medication(alex))
    other = make_medication(alex, name="Other")
    client_for(alex).patch(detail_url(schedule), {"medication": other.id}, format="json")
    schedule.refresh_from_db()
    assert schedule.medication != other


def test_end_date_is_checked_against_the_stored_start_date(
    client_for, make_medication, make_schedule, alex
):
    from datetime import date

    schedule = make_schedule(make_medication(alex), start_date=date(2026, 11, 17))
    resp = client_for(alex).patch(detail_url(schedule), {"end_date": "2026-11-01"}, format="json")
    assert resp.status_code == 400


@pytest.mark.parametrize(
    "change,restarts",
    [
        ({"time_of_day": "09:00"}, True),
        ({"days_of_week": [0]}, True),
        ({"start_date": "2026-12-01"}, True),
        ({"end_date": "2027-01-01"}, True),
        ({"pills_per_dose": 2}, False),
        ({"time_of_day": "08:00"}, False),  # same value
        ({"days_of_week": [6, 5, 4, 3, 2, 1, 0]}, False),  # same days, different order
    ],
)
def test_only_timing_changes_restart_tracking(
    client_for, make_medication, make_schedule, freeze_now, alex, change, restarts
):
    freeze_now(NOW)
    schedule = make_schedule(make_medication(alex))
    before = schedule.tracking_started_at
    assert client_for(alex).patch(detail_url(schedule), change, format="json").status_code == 200
    schedule.refresh_from_db()
    assert schedule.tracking_started_at == (NOW if restarts else before)


def test_reactivating_restarts_tracking_but_pausing_does_not(
    client_for, make_medication, make_schedule, freeze_now, alex
):
    freeze_now(NOW)
    schedule = make_schedule(make_medication(alex), active=False)
    before = schedule.tracking_started_at
    client_for(alex).patch(detail_url(schedule), {"active": True}, format="json")
    schedule.refresh_from_db()
    assert schedule.tracking_started_at == NOW

    schedule.tracking_started_at = before
    schedule.save()
    client_for(alex).patch(detail_url(schedule), {"active": False}, format="json")
    schedule.refresh_from_db()
    assert schedule.tracking_started_at == before


# ---------- delete ----------


def test_delete_removes_the_schedule(client_for, make_medication, make_schedule, alex):
    schedule = make_schedule(make_medication(alex))
    assert client_for(alex).delete(detail_url(schedule)).status_code == 204
    assert Schedule.objects.count() == 0


# ---------- authentication and missing objects ----------


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/medications/1/schedules/"),
        ("post", "/api/medications/1/schedules/"),
        ("patch", "/api/schedules/1/"),
        ("delete", "/api/schedules/1/"),
    ],
)
def test_everything_requires_login(method, path):
    assert getattr(APIClient(), method)(path).status_code == 401


def test_missing_and_forbidden_look_identical(
    client_for, make_medication, make_schedule, alex, stranger
):
    schedule = make_schedule(make_medication(alex))
    api = client_for(stranger)
    real = api.patch(detail_url(schedule), {"pills_per_dose": 5}, format="json")
    missing = api.patch("/api/schedules/999999/", {"pills_per_dose": 5}, format="json")
    assert real.status_code == missing.status_code == 404
    assert real.json() == missing.json()


# ---------- the caregiver matrix (alex cares for mum) ----------


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 200, 200))
def test_caregiver_list_schedules(
    client_for, make_link, make_medication, make_schedule, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    med = make_medication(mum)
    make_schedule(med)
    assert client_for(alex).get(list_url(med)).status_code == expected


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 201))
def test_caregiver_create_schedule(
    client_for, make_link, make_medication, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    med = make_medication(mum)
    resp = client_for(alex).post(list_url(med), PAYLOAD, format="json")
    assert resp.status_code == expected
    assert Schedule.objects.count() == (1 if expected == 201 else 0)


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 200))
def test_caregiver_patch_schedule(
    client_for, make_link, make_medication, make_schedule, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    schedule = make_schedule(make_medication(mum))
    resp = client_for(alex).patch(detail_url(schedule), {"pills_per_dose": 4}, format="json")
    assert resp.status_code == expected
    schedule.refresh_from_db()
    assert schedule.pills_per_dose == (4 if expected == 200 else 1)


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 204))
def test_caregiver_delete_schedule(
    client_for, make_link, make_medication, make_schedule, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    schedule = make_schedule(make_medication(mum))
    assert client_for(alex).delete(detail_url(schedule)).status_code == expected
    assert Schedule.objects.count() == (0 if expected == 204 else 1)
