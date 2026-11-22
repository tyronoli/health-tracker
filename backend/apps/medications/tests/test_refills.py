from datetime import UTC, date, datetime, time

import pytest
from rest_framework.test import APIClient

from apps.core.testing import matrix, prepare
from apps.medications.models import Schedule

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 17, 12, 0, tzinfo=UTC)
LATER = datetime(2026, 11, 17, 18, 0, tzinfo=UTC)
DOSES = "/api/doses/"
LOW_SUPPLY = "/api/refills/low-supply/"


@pytest.fixture(autouse=True)
def frozen_time(freeze_now):
    freeze_now(NOW)


@pytest.fixture
def med(alex, make_medication):
    return make_medication(alex, pills_remaining=30, refill_threshold=10)


@pytest.fixture
def schedule(med, make_schedule):
    return make_schedule(med, time_of_day=time(8, 0), pills_per_dose=2)


def log(api, schedule, status="taken", day=17):
    body = {
        "schedule": schedule.id,
        "scheduled_for": f"2026-11-{day:02d}T08:00:00Z",
        "status": status,
    }
    return api.post(DOSES, body, format="json")


def correct(api, dose_id, status):
    return api.patch(f"{DOSES}{dose_id}/", {"status": status}, format="json")


# ---------- taking and skipping ----------


def test_a_taken_dose_reduces_the_count_by_pills_per_dose(client_for, alex, med, schedule):
    resp = log(client_for(alex), schedule)
    assert resp.status_code == 201
    med.refresh_from_db()
    assert med.pills_remaining == 28


def test_a_skipped_dose_leaves_the_count_alone(client_for, alex, med, schedule):
    log(client_for(alex), schedule, status="skipped")
    med.refresh_from_db()
    assert med.pills_remaining == 30


def test_missed_doses_leave_the_count_alone(med, schedule):
    from apps.medications import doses

    doses.mark_missed_doses(NOW)
    med.refresh_from_db()
    assert med.pills_remaining == 30


def test_the_count_never_goes_below_zero(client_for, alex, make_medication, make_schedule):
    low = make_medication(alex, pills_remaining=1, refill_threshold=0)
    sched = make_schedule(low, time_of_day=time(8, 0), pills_per_dose=2)
    log(client_for(alex), sched)
    low.refresh_from_db()
    assert low.pills_remaining == 0
    assert low.dose_logs.get().pills_used == 1  # only what was really there


def test_a_duplicate_does_not_deduct_twice(client_for, alex, med, schedule):
    api = client_for(alex)
    assert log(api, schedule).status_code == 201
    assert log(api, schedule).status_code == 409
    med.refresh_from_db()
    assert med.pills_remaining == 28


def test_a_rejected_request_does_not_deduct(client_for, alex, med, schedule):
    body = {"schedule": schedule.id, "scheduled_for": "2026-11-17T08:05:00Z", "status": "taken"}
    assert client_for(alex).post(DOSES, body, format="json").status_code == 400
    med.refresh_from_db()
    assert med.pills_remaining == 30


# ---------- corrections ----------


def test_taken_to_skipped_gives_the_pills_back(client_for, alex, med, schedule):
    api = client_for(alex)
    dose_id = log(api, schedule).json()["id"]
    assert correct(api, dose_id, "skipped").status_code == 200
    med.refresh_from_db()
    assert med.pills_remaining == 30


def test_skipped_to_taken_deducts(client_for, alex, med, schedule):
    api = client_for(alex)
    dose_id = log(api, schedule, status="skipped").json()["id"]
    correct(api, dose_id, "taken")
    med.refresh_from_db()
    assert med.pills_remaining == 28


def test_a_late_dose_after_missed_deducts(client_for, alex, med, schedule, make_dose_log):
    missed = make_dose_log(schedule, datetime(2026, 11, 17, 8, 0, tzinfo=UTC), "missed")
    correct(client_for(alex), missed.id, "taken")
    med.refresh_from_db()
    assert med.pills_remaining == 28


def test_round_trip_returns_to_the_same_count(client_for, alex, med, schedule):
    api = client_for(alex)
    dose_id = log(api, schedule).json()["id"]
    correct(api, dose_id, "skipped")
    correct(api, dose_id, "taken")
    med.refresh_from_db()
    assert med.pills_remaining == 28


def test_editing_only_the_note_changes_nothing(client_for, alex, med, schedule):
    api = client_for(alex)
    dose_id = log(api, schedule).json()["id"]
    api.patch(f"{DOSES}{dose_id}/", {"note": "after lunch"}, format="json")
    med.refresh_from_db()
    assert med.pills_remaining == 28


def test_undoing_returns_what_was_actually_deducted(client_for, alex, med, schedule):
    api = client_for(alex)
    dose_id = log(api, schedule).json()["id"]  # deducted 2
    Schedule.objects.filter(pk=schedule.pk).update(pills_per_dose=5)  # changed afterwards
    correct(api, dose_id, "skipped")
    med.refresh_from_db()
    assert med.pills_remaining == 30  # not 33


def test_logs_of_a_deleted_schedule_can_still_be_undone(client_for, alex, med, schedule):
    api = client_for(alex)
    dose_id = log(api, schedule).json()["id"]
    schedule.delete()
    correct(api, dose_id, "skipped")
    med.refresh_from_db()
    assert med.pills_remaining == 30
    correct(api, dose_id, "taken")  # dose size unknown now, so nothing is deducted
    med.refresh_from_db()
    assert med.pills_remaining == 30


# ---------- the alert marker ----------


def test_crossing_the_threshold_raises_the_alert_once(
    client_for, alex, make_medication, make_schedule, freeze_now
):
    m = make_medication(alex, pills_remaining=11, refill_threshold=10)
    sched = make_schedule(m, time_of_day=time(8, 0), pills_per_dose=1)
    api = client_for(alex)
    assert m.low_supply_alert_raised_at is None

    log(api, sched, day=17)  # 11 -> 10: crosses
    m.refresh_from_db()
    assert m.low_supply is True
    assert m.low_supply_alert_raised_at == NOW

    freeze_now(LATER)
    log(api, sched, day=16)  # 10 -> 9: still low, not a new crossing
    m.refresh_from_db()
    assert m.pills_remaining == 9
    assert m.low_supply_alert_raised_at == NOW


def test_refilling_above_the_threshold_clears_the_alert(client_for, alex, make_medication):
    m = make_medication(alex, pills_remaining=5, refill_threshold=10)
    api = client_for(alex)
    # A medication that starts low has never "crossed", so there is no alert yet
    assert m.low_supply_alert_raised_at is None

    # Put it into the alerted state through the API: refill a bit, then drop below again
    api.patch(f"/api/medications/{m.id}/", {"pills_remaining": 12}, format="json")
    api.patch(f"/api/medications/{m.id}/", {"pills_remaining": 9}, format="json")
    m.refresh_from_db()
    assert m.low_supply_alert_raised_at == NOW

    api.post(f"/api/medications/{m.id}/refill/", {"pills_added": 5}, format="json")  # 14
    m.refresh_from_db()
    assert m.low_supply_alert_raised_at is None


def test_a_small_refill_that_stays_low_keeps_the_alert(
    client_for, alex, make_medication, make_schedule
):
    m = make_medication(alex, pills_remaining=11, refill_threshold=10)
    sched = make_schedule(m, time_of_day=time(8, 0), pills_per_dose=1)
    api = client_for(alex)
    log(api, sched)  # crosses to 10
    api.post(
        f"/api/medications/{m.id}/refill/", {"pills_added": 0 + 1}, format="json"
    )  # 11: not low
    m.refresh_from_db()
    assert m.low_supply_alert_raised_at is None

    log(api, sched, day=16)  # 10 again: a new crossing
    m.refresh_from_db()
    assert m.low_supply_alert_raised_at == NOW


def test_undoing_a_dose_back_above_the_threshold_clears_the_alert(
    client_for, alex, make_medication, make_schedule
):
    m = make_medication(alex, pills_remaining=11, refill_threshold=10)
    sched = make_schedule(m, time_of_day=time(8, 0), pills_per_dose=1)
    api = client_for(alex)
    dose_id = log(api, sched).json()["id"]
    m.refresh_from_db()
    assert m.low_supply_alert_raised_at == NOW

    correct(api, dose_id, "skipped")
    m.refresh_from_db()
    assert m.pills_remaining == 11
    assert m.low_supply_alert_raised_at is None


def test_creating_a_low_medication_does_not_raise_an_alert(client_for, alex):
    resp = client_for(alex).post(
        "/api/medications/",
        {"name": "New", "pills_remaining": 2, "refill_threshold": 10},
        format="json",
    )
    assert resp.status_code == 201
    from apps.medications.models import Medication

    assert Medication.objects.get().low_supply_alert_raised_at is None


@pytest.mark.parametrize(
    "change,expected_raised",
    [
        ({"pills_remaining": 9}, True),  # 30 -> 9, below threshold 10
        ({"refill_threshold": 40}, True),  # threshold raised above the stock
        ({"name": "Renamed"}, False),
        ({"pills_remaining": 25}, False),
    ],
)
def test_editing_stock_or_threshold_can_cross_it(client_for, alex, med, change, expected_raised):
    client_for(alex).patch(f"/api/medications/{med.id}/", change, format="json")
    med.refresh_from_db()
    assert (med.low_supply_alert_raised_at == NOW) is expected_raised


def test_raising_stock_above_the_threshold_by_editing_clears_it(client_for, alex, med):
    api = client_for(alex)
    api.patch(f"/api/medications/{med.id}/", {"pills_remaining": 5}, format="json")
    med.refresh_from_db()
    assert med.low_supply_alert_raised_at == NOW
    api.patch(f"/api/medications/{med.id}/", {"pills_remaining": 50}, format="json")
    med.refresh_from_db()
    assert med.low_supply_alert_raised_at is None


# ---------- days of supply left ----------


def days_left(api, med):
    return api.get(f"/api/medications/{med.id}/").json()["days_supply_left"]


def test_once_a_day(client_for, alex, med, make_schedule):
    make_schedule(med, pills_per_dose=1)
    assert days_left(client_for(alex), med) == 30


def test_two_pills_per_dose_halves_it(client_for, alex, med, make_schedule):
    make_schedule(med, pills_per_dose=2)
    assert days_left(client_for(alex), med) == 15


def test_several_schedules_add_up(client_for, alex, med, make_schedule):
    make_schedule(med, time_of_day=time(8, 0), pills_per_dose=1)
    make_schedule(med, time_of_day=time(20, 0), pills_per_dose=1)
    assert days_left(client_for(alex), med) == 15


def test_weekday_only_schedules_use_the_weekly_average(
    client_for, alex, make_medication, make_schedule
):
    ten = make_medication(alex, pills_remaining=10)
    make_schedule(ten, days_of_week=[0, 1, 2, 3, 4], pills_per_dose=1)  # 5 pills per week
    assert days_left(client_for(alex), ten) == 14


def test_a_weekly_schedule(client_for, alex, make_medication, make_schedule):
    three = make_medication(alex, pills_remaining=3)
    make_schedule(three, days_of_week=[0], pills_per_dose=1)
    assert days_left(client_for(alex), three) == 21


def test_zero_pills_means_zero_days(client_for, alex, make_medication, make_schedule):
    empty = make_medication(alex, pills_remaining=0)
    make_schedule(empty)
    assert days_left(client_for(alex), empty) == 0


def test_no_usable_schedule_means_null(client_for, alex, med, make_schedule):
    api = client_for(alex)
    assert days_left(api, med) is None  # no schedules at all
    make_schedule(med, active=False)
    make_schedule(med, end_date=date(2026, 11, 16))  # ended yesterday
    make_schedule(med, start_date=date(2026, 11, 18))  # starts tomorrow
    assert days_left(api, med) is None


def test_inactive_medication_has_no_estimate(client_for, alex, make_medication, make_schedule):
    stopped = make_medication(alex, active=False)
    make_schedule(stopped)
    assert days_left(client_for(alex), stopped) is None


# ---------- the low-supply list ----------


def test_low_supply_lists_active_medications_at_or_below_threshold(
    client_for, alex, make_medication, make_schedule
):
    make_medication(alex, name="Fine", pills_remaining=30, refill_threshold=10)
    make_medication(alex, name="Edge", pills_remaining=10, refill_threshold=10)
    make_medication(alex, name="Empty", pills_remaining=0, refill_threshold=5)
    make_medication(alex, name="Stopped", pills_remaining=1, refill_threshold=5, active=False)
    body = client_for(alex).get(LOW_SUPPLY).json()
    assert [m["name"] for m in body] == ["Empty", "Edge"]  # fewest pills first
    assert all(m["low_supply"] for m in body)


def test_low_supply_includes_the_estimate(client_for, alex, make_medication, make_schedule):
    m = make_medication(alex, pills_remaining=4, refill_threshold=10)
    make_schedule(m, pills_per_dose=2)
    assert client_for(alex).get(LOW_SUPPLY).json()[0]["days_supply_left"] == 2


def test_low_supply_requires_login():
    assert APIClient().get(LOW_SUPPLY).status_code == 401


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 200, 200))
def test_caregiver_low_supply(client_for, make_link, make_medication, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    make_medication(mum, pills_remaining=1, refill_threshold=5)
    resp = client_for(alex).get(LOW_SUPPLY, {"profile": mum.id})
    assert resp.status_code == expected
    if expected == 200:
        assert len(resp.json()) == 1
