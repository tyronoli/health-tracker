from datetime import UTC, date, datetime, time

import pytest
from rest_framework.test import APIClient

from apps.core.testing import matrix, prepare
from apps.medications.models import DoseLog

pytestmark = pytest.mark.django_db

URL = "/api/doses/"
TODAY = "/api/doses/today/"
NOW = datetime(2026, 11, 17, 12, 0, tzinfo=UTC)  # a Tuesday
EIGHT = datetime(2026, 11, 17, 8, 0, tzinfo=UTC)


def utc(*args):
    return datetime(*args, tzinfo=UTC)


@pytest.fixture(autouse=True)
def frozen_time(freeze_now):
    freeze_now(NOW)


@pytest.fixture
def schedule(alex, make_medication, make_schedule):
    """Alex's daily 08:00 schedule."""
    return make_schedule(make_medication(alex, name="Metformin"), time_of_day=time(8, 0))


def payload(schedule, /, **overrides):
    return {
        "schedule": schedule.id,
        "scheduled_for": "2026-11-17T08:00:00Z",
        "status": "taken",
        **overrides,
    }


def detail(log):
    return f"{URL}{log.id}/"


# ---------- today ----------


def test_today_lists_due_doses_with_derived_status(
    client_for, make_medication, make_schedule, alex
):
    med = make_medication(alex, name="Metformin", dosage="500 mg")
    make_schedule(med, time_of_day=time(14, 0), pills_per_dose=2)
    make_schedule(med, time_of_day=time(8, 0))
    make_schedule(med, time_of_day=time(11, 30))

    body = client_for(alex).get(TODAY).json()

    assert body["date"] == "2026-11-17"
    assert body["timezone"] == "UTC"
    assert [(d["scheduled_for"][11:16], d["status"]) for d in body["doses"]] == [
        ("08:00", "missed"),  # 08:00 + 60 min grace has passed at 12:00
        ("11:30", "pending"),  # still inside the grace period
        ("14:00", "pending"),
    ]
    first = body["doses"][0]
    assert first["medication"] == {"id": med.id, "name": "Metformin", "dosage": "500 mg"}
    assert first["dose_log_id"] is None
    assert body["doses"][2]["pills_per_dose"] == 2


def test_today_uses_the_logged_status(
    client_for, make_medication, make_schedule, make_dose_log, alex
):
    med = make_medication(alex)
    s8 = make_schedule(med, time_of_day=time(8, 0))
    s9 = make_schedule(med, time_of_day=time(9, 0))
    taken = make_dose_log(s8, EIGHT, "taken")
    make_dose_log(s9, utc(2026, 11, 17, 9, 0), "skipped")

    doses = client_for(alex).get(TODAY).json()["doses"]
    assert [d["status"] for d in doses] == ["taken", "skipped"]
    assert doses[0]["dose_log_id"] == taken.id


def test_a_stored_missed_log_shows_as_missed(client_for, schedule, make_dose_log, alex):
    log = make_dose_log(schedule, EIGHT, "missed")
    dose = client_for(alex).get(TODAY).json()["doses"][0]
    assert (dose["status"], dose["dose_log_id"]) == ("missed", log.id)


def test_doses_before_tracking_started_are_never_missed(
    client_for, make_medication, make_schedule, alex
):
    make_schedule(
        make_medication(alex), time_of_day=time(8, 0), tracking_started_at=utc(2026, 11, 17, 11, 0)
    )
    dose = client_for(alex).get(TODAY).json()["doses"][0]
    assert dose["status"] == "pending"


def test_today_follows_the_owners_timezone(
    client_for, make_user, make_medication, make_schedule, freeze_now
):
    manila = make_user("manila@example.com", timezone="Asia/Manila")
    make_schedule(make_medication(manila), time_of_day=time(8, 0))
    freeze_now(utc(2026, 11, 17, 20, 0))  # 04:00 on Nov 18 in Manila

    body = client_for(manila).get(TODAY).json()
    assert body["date"] == "2026-11-18"
    assert body["timezone"] == "Asia/Manila"
    assert body["doses"][0]["scheduled_for"] == "2026-11-18T00:00:00Z"


# ---------- log a dose ----------


def test_log_a_taken_dose(client_for, schedule, alex):
    resp = client_for(alex).post(URL, payload(schedule, note="with breakfast"), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert (body["status"], body["note"]) == ("taken", "with breakfast")
    assert body["schedule"] == schedule.id
    assert body["medication"] == schedule.medication_id
    log = DoseLog.objects.get()
    assert log.scheduled_for == EIGHT
    assert log.logged_at == NOW


def test_log_a_skipped_dose(client_for, schedule, alex):
    resp = client_for(alex).post(URL, payload(schedule, status="skipped"), format="json")
    assert resp.status_code == 201
    assert DoseLog.objects.get().status == "skipped"


def test_a_past_dose_can_be_logged(client_for, schedule, alex):
    when = "2026-11-16T08:00:00Z"
    resp = client_for(alex).post(URL, payload(schedule, scheduled_for=when), format="json")
    assert resp.status_code == 201


def test_logging_tomorrows_dose_early_is_fine(client_for, schedule, alex):
    when = "2026-11-18T08:00:00Z"  # 20 hours ahead
    assert (
        client_for(alex).post(URL, payload(schedule, scheduled_for=when), format="json").status_code
        == 201
    )


def test_doses_more_than_a_day_ahead_are_rejected(client_for, make_medication, make_schedule, alex):
    later = make_schedule(make_medication(alex), time_of_day=time(14, 0))
    when = "2026-11-18T14:00:00Z"  # 26 hours ahead
    resp = client_for(alex).post(URL, payload(later, scheduled_for=when), format="json")
    assert resp.status_code == 400
    assert "scheduled_for" in resp.json()["error"]["fields"]


@pytest.mark.parametrize(
    "override",
    [
        {"scheduled_for": "2026-11-17T08:05:00Z"},  # wrong time
        {"scheduled_for": "2026-11-17T20:00:00Z"},  # wrong time
        {"status": "missed"},
        {"status": "bogus"},
        {"note": "x" * 501},
        {"scheduled_for": "not-a-date"},
        {"schedule": "abc"},
    ],
)
def test_log_validates_input(client_for, schedule, alex, override):
    resp = client_for(alex).post(URL, payload(schedule, **override), format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"
    assert DoseLog.objects.count() == 0


def test_log_requires_all_main_fields(client_for, schedule, alex):
    for missing in ("schedule", "scheduled_for", "status"):
        data = {k: v for k, v in payload(schedule).items() if k != missing}
        assert client_for(alex).post(URL, data, format="json").status_code == 400


def test_the_date_must_fit_the_schedule(client_for, make_medication, make_schedule, alex):
    mondays = make_schedule(make_medication(alex), days_of_week=[0])  # Mondays only
    resp = client_for(alex).post(URL, payload(mondays), format="json")  # Nov 17 is a Tuesday
    assert resp.status_code == 400

    later = make_schedule(make_medication(alex, name="B"), start_date=date(2026, 11, 18))
    assert client_for(alex).post(URL, payload(later), format="json").status_code == 400


def test_inactive_schedules_and_medications_cannot_be_logged(
    client_for, make_medication, make_schedule, alex
):
    paused = make_schedule(make_medication(alex, name="A"), active=False)
    stopped = make_schedule(make_medication(alex, name="B", active=False))
    assert client_for(alex).post(URL, payload(paused), format="json").status_code == 400
    assert client_for(alex).post(URL, payload(stopped), format="json").status_code == 400


def test_optional_medication_must_match_the_schedule(client_for, make_medication, schedule, alex):
    other = make_medication(alex, name="Other")
    ok = client_for(alex).post(
        URL, payload(schedule, medication=schedule.medication_id), format="json"
    )
    assert ok.status_code == 201
    bad = client_for(alex).post(URL, payload(schedule, medication=other.id), format="json")
    assert bad.status_code in (
        400,
        409,
    )  # 400 for the mismatch, or 409 if checked after the duplicate


def test_logging_the_same_dose_twice_conflicts(client_for, schedule, alex):
    assert client_for(alex).post(URL, payload(schedule), format="json").status_code == 201
    resp = client_for(alex).post(URL, payload(schedule, status="skipped"), format="json")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "already_logged"
    assert DoseLog.objects.count() == 1


def test_a_missed_dose_also_counts_as_logged(client_for, schedule, make_dose_log, alex):
    make_dose_log(schedule, EIGHT, "missed")
    resp = client_for(alex).post(URL, payload(schedule), format="json")
    assert resp.status_code == 409


def test_profile_in_the_body_is_ignored(client_for, schedule, alex, stranger):
    resp = client_for(alex).post(URL, payload(schedule, profile=stranger.id), format="json")
    assert resp.status_code == 201
    assert DoseLog.objects.get().medication.owner == alex


def test_missing_and_forbidden_schedules_look_identical(client_for, schedule, stranger):
    api = client_for(stranger)
    real = api.post(URL, payload(schedule), format="json")
    missing = api.post(URL, payload(schedule, schedule=999999), format="json")
    assert real.status_code == missing.status_code == 404
    assert real.json() == missing.json()


def test_deleting_a_schedule_keeps_its_logs(schedule, make_dose_log):
    log = make_dose_log(schedule, EIGHT, "taken")
    schedule.delete()
    log.refresh_from_db()
    assert log.schedule is None
    assert log.status == "taken"


# ---------- correct a log ----------


def test_correct_a_dose(client_for, schedule, make_dose_log, alex):
    log = make_dose_log(schedule, EIGHT, "taken", logged_at=utc(2026, 11, 17, 8, 1))
    resp = client_for(alex).patch(
        detail(log), {"status": "skipped", "note": "felt sick"}, format="json"
    )
    assert resp.status_code == 200
    log.refresh_from_db()
    assert (log.status, log.note, log.logged_at) == ("skipped", "felt sick", NOW)


def test_editing_only_the_note_keeps_logged_at(client_for, schedule, make_dose_log, alex):
    original = utc(2026, 11, 17, 8, 1)
    log = make_dose_log(schedule, EIGHT, "taken", logged_at=original)
    client_for(alex).patch(detail(log), {"note": "after food"}, format="json")
    log.refresh_from_db()
    assert (log.note, log.logged_at) == ("after food", original)


def test_a_missed_dose_can_be_taken_late(client_for, schedule, make_dose_log, alex):
    log = make_dose_log(schedule, EIGHT, "missed")
    assert (
        client_for(alex).patch(detail(log), {"status": "taken"}, format="json").status_code == 200
    )
    log.refresh_from_db()
    assert log.status == "taken"


@pytest.mark.parametrize("bad", [{"status": "missed"}, {"status": "bogus"}, {"note": "x" * 501}])
def test_correction_validates_input(client_for, schedule, make_dose_log, alex, bad):
    log = make_dose_log(schedule, EIGHT, "taken")
    assert client_for(alex).patch(detail(log), bad, format="json").status_code == 400


def test_missing_and_forbidden_logs_look_identical(client_for, schedule, make_dose_log, stranger):
    log = make_dose_log(schedule, EIGHT, "taken")
    api = client_for(stranger)
    real = api.patch(detail(log), {"status": "skipped"}, format="json")
    missing = api.patch(f"{URL}999999/", {"status": "skipped"}, format="json")
    assert real.status_code == missing.status_code == 404
    assert real.json() == missing.json()


# ---------- history ----------


def test_history_is_newest_first_and_paginated(client_for, schedule, make_dose_log, alex):
    older = make_dose_log(schedule, utc(2026, 11, 15, 8, 0), "taken")
    newer = make_dose_log(schedule, utc(2026, 11, 16, 8, 0), "skipped")
    body = client_for(alex).get(URL).json()
    assert body["count"] == 2
    assert [r["id"] for r in body["results"]] == [newer.id, older.id]


def test_history_only_shows_the_profiles_logs(
    client_for, schedule, make_dose_log, make_medication, make_schedule, alex, mum
):
    make_dose_log(schedule, EIGHT, "taken")
    hers = make_schedule(make_medication(mum))
    make_dose_log(hers, EIGHT, "taken")
    assert client_for(alex).get(URL).json()["count"] == 1


def test_history_filters(client_for, make_medication, make_schedule, make_dose_log, alex):
    a = make_schedule(make_medication(alex, name="A"))
    b = make_schedule(make_medication(alex, name="B"))
    log_a = make_dose_log(a, EIGHT, "taken")
    log_b = make_dose_log(b, EIGHT, "skipped")
    api = client_for(alex)

    def ids(**params):
        return {r["id"] for r in api.get(URL, params).json()["results"]}

    assert ids(status="skipped") == {log_b.id}
    assert ids(medication=a.medication_id) == {log_a.id}
    assert ids(medication=a.medication_id, status="skipped") == set()


def test_history_dates_use_the_owners_timezone(
    client_for, make_user, make_medication, make_schedule, make_dose_log
):
    manila = make_user("manila@example.com", timezone="Asia/Manila")
    sched = make_schedule(make_medication(manila))
    before = make_dose_log(sched, utc(2026, 11, 17, 15, 59), "taken")  # Nov 17, 23:59 in Manila
    after = make_dose_log(sched, utc(2026, 11, 17, 16, 0), "taken")  # Nov 18, 00:00 in Manila
    api = client_for(manila)

    assert [r["id"] for r in api.get(URL, {"from": "2026-11-18"}).json()["results"]] == [after.id]
    assert [r["id"] for r in api.get(URL, {"to": "2026-11-17"}).json()["results"]] == [before.id]
    both = api.get(URL, {"from": "2026-11-17", "to": "2026-11-18"}).json()
    assert both["count"] == 2


@pytest.mark.parametrize(
    "params",
    [{"status": "bogus"}, {"medication": "abc"}, {"from": "garbage"}, {"to": "2026-13-45"}],
)
def test_history_rejects_bad_filters(client_for, alex, params):
    assert client_for(alex).get(URL, params).status_code == 400


# ---------- authentication ----------


@pytest.mark.parametrize(
    "method,path",
    [("get", URL), ("get", TODAY), ("post", URL), ("patch", f"{URL}1/")],
)
def test_everything_requires_login(method, path):
    assert getattr(APIClient(), method)(path).status_code == 401


# ---------- the caregiver matrix (alex cares for mum) ----------


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 200, 200))
def test_caregiver_today(
    client_for, make_link, make_medication, make_schedule, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    make_schedule(make_medication(mum))
    resp = client_for(alex).get(TODAY, {"profile": mum.id})
    assert resp.status_code == expected
    if expected == 200:
        assert len(resp.json()["doses"]) == 1


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 200, 200))
def test_caregiver_history(
    client_for, make_link, make_medication, make_schedule, make_dose_log, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    make_dose_log(make_schedule(make_medication(mum)), EIGHT, "taken")
    resp = client_for(alex).get(URL, {"profile": mum.id})
    assert resp.status_code == expected
    if expected == 200:
        assert resp.json()["count"] == 1


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 201))
def test_caregiver_log_dose(
    client_for, make_link, make_medication, make_schedule, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    hers = make_schedule(make_medication(mum))
    resp = client_for(alex).post(URL, payload(hers), format="json")
    assert resp.status_code == expected
    assert DoseLog.objects.count() == (1 if expected == 201 else 0)


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 200))
def test_caregiver_correct_dose(
    client_for, make_link, make_medication, make_schedule, make_dose_log, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    log = make_dose_log(make_schedule(make_medication(mum)), EIGHT, "taken")
    resp = client_for(alex).patch(detail(log), {"status": "skipped"}, format="json")
    assert resp.status_code == expected
    log.refresh_from_db()
    assert log.status == ("skipped" if expected == 200 else "taken")
