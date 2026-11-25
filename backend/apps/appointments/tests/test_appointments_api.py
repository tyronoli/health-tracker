from datetime import UTC, datetime

import pytest
from rest_framework.test import APIClient

from apps.appointments.models import Appointment
from apps.core.testing import matrix, prepare

pytestmark = pytest.mark.django_db

URL = "/api/appointments/"
NOW = datetime(2026, 11, 22, 12, 0, tzinfo=UTC)  # a Sunday
PAYLOAD = {
    "title": "Chest X-ray",
    "type": "imaging",
    "provider_name": "St. Luke's Imaging",
    "location": "Level 2",
    "starts_at": "2026-11-26T01:30:00Z",
    "duration_minutes": 30,
    "preparation": "Wear loose clothing",
    "notes": "Bring the referral",
}


@pytest.fixture(autouse=True)
def frozen_time(freeze_now):
    freeze_now(NOW)


def utc(*args):
    return datetime(*args, tzinfo=UTC)


def detail(appointment):
    return f"{URL}{appointment.id}/"


def titles(resp):
    return [a["title"] for a in resp.json()["results"]]


# ---------- create ----------


def test_create_appointment(client_for, alex):
    resp = client_for(alex).post(URL, PAYLOAD, format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["owner"] == alex.id
    assert body["title"] == "Chest X-ray"
    assert body["type"] == "imaging"
    assert body["status"] == "scheduled"
    assert body["starts_at"] == "2026-11-26T01:30:00Z"
    assert body["duration_minutes"] == 30
    assert body["preparation"] == "Wear loose clothing"
    assert Appointment.objects.get().owner == alex


def test_create_uses_defaults(client_for, alex):
    resp = client_for(alex).post(
        URL, {"title": "Dentist", "starts_at": "2026-12-01T03:00:00Z"}, format="json"
    )
    assert resp.status_code == 201
    body = resp.json()
    assert (body["type"], body["status"], body["duration_minutes"]) == ("other", "scheduled", None)
    assert (body["provider_name"], body["location"], body["preparation"], body["notes"]) == (
        "",
        "",
        "",
        "",
    )


def test_a_time_with_an_offset_is_stored_as_utc(client_for, alex):
    payload = {**PAYLOAD, "starts_at": "2026-11-26T09:30:00+08:00"}
    resp = client_for(alex).post(URL, payload, format="json")
    assert resp.status_code == 201
    assert resp.json()["starts_at"] == "2026-11-26T01:30:00Z"
    assert Appointment.objects.get().starts_at == utc(2026, 11, 26, 1, 30)


def test_past_appointments_can_be_recorded(client_for, alex):
    payload = {**PAYLOAD, "starts_at": "2026-01-05T02:00:00Z", "status": "completed"}
    assert client_for(alex).post(URL, payload, format="json").status_code == 201


@pytest.mark.parametrize(
    "override",
    [
        {"title": ""},
        {"title": "   "},
        {"title": None},
        {"title": "x" * 201},
        {"starts_at": None},
        {"starts_at": "2026-11-26T09:30:00"},  # no offset: ambiguous, so rejected
        {"starts_at": "2026-11-26"},
        {"starts_at": "banana"},
        {"type": "surgery"},
        {"status": "done"},
        {"duration_minutes": 0},
        {"duration_minutes": -5},
        {"duration_minutes": 1441},
        {"duration_minutes": "long"},
        {"provider_name": "x" * 201},
        {"location": "x" * 201},
        {"preparation": "x" * 2001},
        {"notes": "x" * 5001},
    ],
)
def test_create_validates_input(client_for, alex, override):
    resp = client_for(alex).post(URL, {**PAYLOAD, **override}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"
    assert Appointment.objects.count() == 0


@pytest.mark.parametrize("missing", ["title", "starts_at"])
def test_title_and_start_are_required(client_for, alex, missing):
    payload = {k: v for k, v in PAYLOAD.items() if k != missing}
    resp = client_for(alex).post(URL, payload, format="json")
    assert resp.status_code == 400
    assert missing in resp.json()["error"]["fields"]


def test_the_naive_time_message_explains_the_fix(client_for, alex):
    payload = {**PAYLOAD, "starts_at": "2026-11-26T09:30:00"}
    fields = client_for(alex).post(URL, payload, format="json").json()["error"]["fields"]
    assert "offset" in fields["starts_at"][0]


def test_owner_in_body_is_ignored(client_for, alex, stranger):
    resp = client_for(alex).post(URL, {**PAYLOAD, "owner": stranger.id}, format="json")
    assert resp.status_code == 201
    assert Appointment.objects.get().owner == alex


# ---------- list ----------


def test_list_shows_only_my_appointments_soonest_first(
    client_for, make_appointment, alex, mum, stranger
):
    make_appointment(alex, title="Later", starts_at=utc(2026, 12, 10, 2, 0))
    make_appointment(alex, title="Sooner", starts_at=utc(2026, 11, 26, 2, 0))
    make_appointment(mum, title="Mums")
    make_appointment(stranger, title="Secret")
    body = client_for(alex).get(URL).json()
    assert [a["title"] for a in body["results"]] == ["Sooner", "Later"]
    assert body["count"] == 2


def test_upcoming_true_means_not_started_and_still_scheduled(client_for, make_appointment, alex):
    make_appointment(alex, title="Past", starts_at=utc(2026, 11, 20, 2, 0))
    make_appointment(alex, title="Soon", starts_at=utc(2026, 11, 26, 2, 0))
    make_appointment(alex, title="Later", starts_at=utc(2026, 12, 10, 2, 0))
    make_appointment(alex, title="Cancelled", starts_at=utc(2026, 11, 27, 2, 0), status="cancelled")
    make_appointment(
        alex, title="Done early", starts_at=utc(2026, 11, 28, 2, 0), status="completed"
    )
    assert titles(client_for(alex).get(URL, {"upcoming": "true"})) == ["Soon", "Later"]


def test_upcoming_false_means_already_started_newest_first(client_for, make_appointment, alex):
    make_appointment(alex, title="Older", starts_at=utc(2026, 10, 1, 2, 0))
    make_appointment(alex, title="Recent", starts_at=utc(2026, 11, 20, 2, 0))
    make_appointment(alex, title="Future", starts_at=utc(2026, 12, 10, 2, 0))
    assert titles(client_for(alex).get(URL, {"upcoming": "false"})) == ["Recent", "Older"]


def test_an_appointment_starting_right_now_is_upcoming(client_for, make_appointment, alex):
    make_appointment(alex, title="Now", starts_at=NOW)
    assert titles(client_for(alex).get(URL, {"upcoming": "true"})) == ["Now"]


def test_filters_by_type_and_status(client_for, make_appointment, alex):
    make_appointment(alex, title="Scan", type="imaging")
    make_appointment(alex, title="Visit", type="checkup")
    make_appointment(alex, title="Called off", type="checkup", status="cancelled")
    api = client_for(alex)
    assert titles(api.get(URL, {"type": "imaging"})) == ["Scan"]
    assert sorted(titles(api.get(URL, {"type": "checkup"}))) == ["Called off", "Visit"]
    assert titles(api.get(URL, {"status": "cancelled"})) == ["Called off"]
    assert titles(api.get(URL, {"type": "checkup", "status": "scheduled"})) == ["Visit"]


@pytest.mark.parametrize(
    "params",
    [
        {"upcoming": "maybe"},
        {"type": "surgery"},
        {"status": "done"},
        {"from": "garbage"},
        {"to": "2026-13-45"},
    ],
)
def test_list_rejects_bad_filters(client_for, alex, params):
    assert client_for(alex).get(URL, params).status_code == 400


def test_date_filters_use_the_owners_timezone(client_for, make_user, make_appointment):
    manila = make_user("manila@example.com", timezone="Asia/Manila")
    before = make_appointment(
        manila, title="Before", starts_at=utc(2026, 11, 17, 15, 59)
    )  # Nov 17, 23:59 Manila
    after = make_appointment(
        manila, title="After", starts_at=utc(2026, 11, 17, 16, 0)
    )  # Nov 18, 00:00 Manila
    api = client_for(manila)

    assert titles(api.get(URL, {"from": "2026-11-18"})) == [after.title]
    assert titles(api.get(URL, {"to": "2026-11-17"})) == [before.title]
    assert titles(api.get(URL, {"from": "2026-11-17", "to": "2026-11-18"})) == ["Before", "After"]
    assert titles(api.get(URL, {"from": "2026-11-18", "to": "2026-11-18"})) == ["After"]


def test_a_caregiver_gets_the_profile_owners_timezone_for_dates(
    client_for, make_link, make_user, make_appointment, alex
):
    manila = make_user("manila2@example.com", timezone="Asia/Manila")
    make_link(alex, manila, status="active", permission="view")  # alex's own timezone is UTC
    make_appointment(
        manila, title="After", starts_at=utc(2026, 11, 17, 16, 0)
    )  # Nov 18 in Manila, Nov 17 in UTC

    resp = client_for(alex).get(URL, {"profile": manila.id, "from": "2026-11-18"})

    assert titles(resp) == ["After"]


def test_without_profile_a_caregiver_sees_only_their_own(
    client_for, make_link, make_appointment, alex, mum
):
    make_link(alex, mum, status="active", permission="edit")
    make_appointment(alex, title="Mine")
    make_appointment(mum, title="Hers")
    assert titles(client_for(alex).get(URL)) == ["Mine"]


def test_malformed_profile_is_a_400(client_for, alex):
    assert client_for(alex).get(URL, {"profile": "abc"}).status_code == 400


def test_unknown_profile_looks_like_no_access(client_for, alex):
    assert client_for(alex).get(URL, {"profile": 999999}).status_code == 403


# ---------- detail, update, delete ----------


def test_get_one_appointment(client_for, make_appointment, alex):
    appt = make_appointment(
        alex, title="Chest X-ray", type="imaging", preparation="No food for 6 hours"
    )
    body = client_for(alex).get(detail(appt)).json()
    assert (body["title"], body["type"], body["preparation"]) == (
        "Chest X-ray",
        "imaging",
        "No food for 6 hours",
    )


def test_update_appointment(client_for, make_appointment, alex):
    appt = make_appointment(alex)
    resp = client_for(alex).patch(
        detail(appt),
        {
            "title": "Annual check-up",
            "location": "Room 4",
            "starts_at": "2026-11-27T09:30:00+08:00",
        },
        format="json",
    )
    assert resp.status_code == 200
    appt.refresh_from_db()
    assert (appt.title, appt.location, appt.starts_at) == (
        "Annual check-up",
        "Room 4",
        utc(2026, 11, 27, 1, 30),
    )


def test_status_can_be_changed(client_for, make_appointment, alex):
    appt = make_appointment(alex)
    api = client_for(alex)
    assert api.patch(detail(appt), {"status": "completed"}, format="json").status_code == 200
    appt.refresh_from_db()
    assert appt.status == "completed"
    assert api.patch(detail(appt), {"status": "cancelled"}, format="json").status_code == 200


def test_duration_can_be_cleared(client_for, make_appointment, alex):
    appt = make_appointment(alex, duration_minutes=45)
    assert (
        client_for(alex).patch(detail(appt), {"duration_minutes": None}, format="json").status_code
        == 200
    )
    appt.refresh_from_db()
    assert appt.duration_minutes is None


def test_update_validates_input(client_for, make_appointment, alex):
    appt = make_appointment(alex)
    api = client_for(alex)
    assert api.patch(detail(appt), {"type": "surgery"}, format="json").status_code == 400
    assert (
        api.patch(detail(appt), {"starts_at": "2026-11-27T09:30:00"}, format="json").status_code
        == 400
    )
    assert api.patch(detail(appt), {"title": ""}, format="json").status_code == 400


def test_owner_cannot_be_changed(client_for, make_appointment, alex, stranger):
    appt = make_appointment(alex)
    client_for(alex).patch(detail(appt), {"owner": stranger.id}, format="json")
    appt.refresh_from_db()
    assert appt.owner == alex


def test_put_is_not_allowed(client_for, make_appointment, alex):
    appt = make_appointment(alex)
    assert client_for(alex).put(detail(appt), PAYLOAD, format="json").status_code == 405


def test_delete_removes_the_appointment(client_for, make_appointment, alex):
    appt = make_appointment(alex)
    assert client_for(alex).delete(detail(appt)).status_code == 204
    assert Appointment.objects.count() == 0


def test_missing_id_is_404(client_for, alex):
    assert client_for(alex).get(f"{URL}999999/").status_code == 404


def test_stranger_gets_identical_404_for_real_and_missing_appointments(
    client_for, make_appointment, alex, stranger
):
    appt = make_appointment(alex)
    api = client_for(stranger)
    real = api.get(detail(appt))
    missing = api.get(f"{URL}999999/")
    assert real.status_code == missing.status_code == 404
    assert real.json() == missing.json()


@pytest.mark.parametrize(
    "method,suffix",
    [("get", ""), ("post", ""), ("get", "1/"), ("patch", "1/"), ("delete", "1/")],
)
def test_everything_requires_login(method, suffix):
    assert getattr(APIClient(), method)(URL + suffix).status_code == 401


# ---------- the caregiver matrix (alex cares for mum) ----------


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 200, 200))
def test_caregiver_list_with_profile(
    client_for, make_link, make_appointment, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    make_appointment(mum, title="Mum visit")
    resp = client_for(alex).get(URL, {"profile": mum.id})
    assert resp.status_code == expected
    if expected == 200:
        assert titles(resp) == ["Mum visit"]


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 200, 200))
def test_caregiver_get_detail(client_for, make_link, make_appointment, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    appt = make_appointment(mum)
    assert client_for(alex).get(detail(appt)).status_code == expected


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 403, 201))
def test_caregiver_create(client_for, make_link, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    resp = client_for(alex).post(URL, {**PAYLOAD, "profile": mum.id}, format="json")
    assert resp.status_code == expected
    if expected == 201:
        assert Appointment.objects.get().owner == mum  # owned by the recipient, not the caregiver
    else:
        assert Appointment.objects.count() == 0


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 200))
def test_caregiver_patch(client_for, make_link, make_appointment, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    appt = make_appointment(mum, title="Original")
    resp = client_for(alex).patch(detail(appt), {"title": "Changed"}, format="json")
    assert resp.status_code == expected
    appt.refresh_from_db()
    assert appt.title == ("Changed" if expected == 200 else "Original")


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 204))
def test_caregiver_delete(client_for, make_link, make_appointment, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    appt = make_appointment(mum)
    assert client_for(alex).delete(detail(appt)).status_code == expected
    assert Appointment.objects.count() == (0 if expected == 204 else 1)


def test_access_is_one_directional(client_for, make_link, make_appointment, alex, mum):
    make_link(alex, mum, status="active", permission="edit")  # alex cares for mum
    appt = make_appointment(alex)
    assert client_for(mum).get(detail(appt)).status_code == 404
    assert client_for(mum).get(URL, {"profile": alex.id}).status_code == 403
