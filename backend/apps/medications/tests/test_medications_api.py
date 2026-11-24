import pytest
from rest_framework.test import APIClient

from apps.core.testing import matrix, prepare
from apps.medications.models import Medication

pytestmark = pytest.mark.django_db

URL = "/api/medications/"
PAYLOAD = {
    "name": "Metformin",
    "dosage": "500 mg",
    "instructions": "Take with food",
    "pills_remaining": 30,
    "refill_threshold": 10,
}


def detail(med):
    return f"{URL}{med.id}/"


def refill_url(med):
    return f"{URL}{med.id}/refill/"


def names(resp):
    return [m["name"] for m in resp.json()["results"]]


# ---------- create ----------


def test_create_medication(client_for, alex):
    resp = client_for(alex).post(URL, PAYLOAD, format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["owner"] == alex.id
    assert body["name"] == "Metformin"
    assert body["active"] is True
    assert body["low_supply"] is False
    assert Medication.objects.get().owner == alex


def test_create_uses_defaults(client_for, alex):
    resp = client_for(alex).post(URL, {"name": "Vitamin D"}, format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert (body["pills_remaining"], body["refill_threshold"], body["active"]) == (0, 0, True)


@pytest.mark.parametrize(
    "override",
    [
        {"name": ""},
        {"name": "   "},
        {"pills_remaining": -1},
        {"refill_threshold": -5},
        {"pills_remaining": "lots"},
        {"pills_remaining": 100_001},
    ],
)
def test_create_validates_input(client_for, alex, override):
    resp = client_for(alex).post(URL, {**PAYLOAD, **override}, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"
    assert Medication.objects.count() == 0


def test_name_is_required(client_for, alex):
    payload = {k: v for k, v in PAYLOAD.items() if k != "name"}
    assert client_for(alex).post(URL, payload, format="json").status_code == 400


def test_owner_in_body_is_ignored(client_for, alex, stranger):
    resp = client_for(alex).post(URL, {**PAYLOAD, "owner": stranger.id}, format="json")
    assert resp.status_code == 201
    assert Medication.objects.get().owner == alex


# ---------- list ----------


def test_list_shows_only_my_medications_sorted_by_name(
    client_for, make_medication, alex, mum, stranger
):
    make_medication(alex, name="Zinc")
    make_medication(alex, name="Aspirin")
    make_medication(mum, name="Mums pills")
    make_medication(stranger, name="Secret")
    body = client_for(alex).get(URL).json()
    assert [m["name"] for m in body["results"]] == ["Aspirin", "Zinc"]
    assert body["count"] == 2


def test_list_filters_by_active(client_for, make_medication, alex):
    make_medication(alex, name="On")
    make_medication(alex, name="Off", active=False)
    api = client_for(alex)
    assert names(api.get(URL)) == ["Off", "On"]
    assert names(api.get(URL, {"active": "true"})) == ["On"]
    assert names(api.get(URL, {"active": "false"})) == ["Off"]
    assert api.get(URL, {"active": "maybe"}).status_code == 400


def test_without_profile_a_caregiver_sees_only_their_own(
    client_for, make_link, make_medication, alex, mum
):
    make_link(alex, mum, status="active", permission="edit")
    make_medication(alex, name="Mine")
    make_medication(mum, name="Hers")
    assert names(client_for(alex).get(URL)) == ["Mine"]


def test_malformed_profile_is_a_400(client_for, alex):
    assert client_for(alex).get(URL, {"profile": "abc"}).status_code == 400


def test_unknown_profile_looks_like_no_access(client_for, alex):
    assert client_for(alex).get(URL, {"profile": 999999}).status_code == 403


# ---------- detail, update, delete ----------


@pytest.mark.parametrize(
    "pills,threshold,expected",
    [(30, 10, False), (11, 10, False), (10, 10, True), (3, 10, True), (0, 0, True)],
)
def test_low_supply_flag(client_for, make_medication, alex, pills, threshold, expected):
    med = make_medication(alex, pills_remaining=pills, refill_threshold=threshold)
    assert client_for(alex).get(detail(med)).json()["low_supply"] is expected


def test_update_medication(client_for, make_medication, alex):
    med = make_medication(alex)
    resp = client_for(alex).patch(
        detail(med), {"dosage": "850 mg", "pills_remaining": 12}, format="json"
    )
    assert resp.status_code == 200
    med.refresh_from_db()
    assert (med.dosage, med.pills_remaining) == ("850 mg", 12)


def test_owner_cannot_be_changed(client_for, make_medication, alex, stranger):
    med = make_medication(alex)
    client_for(alex).patch(detail(med), {"owner": stranger.id}, format="json")
    med.refresh_from_db()
    assert med.owner == alex


def test_put_is_not_allowed(client_for, make_medication, alex):
    med = make_medication(alex)
    assert client_for(alex).put(detail(med), PAYLOAD, format="json").status_code == 405


def test_delete_deactivates_instead_of_deleting(client_for, make_medication, alex):
    med = make_medication(alex)
    assert client_for(alex).delete(detail(med)).status_code == 204
    med.refresh_from_db()  # still in the database
    assert med.active is False


def test_deactivated_medication_can_be_reactivated(client_for, make_medication, alex):
    med = make_medication(alex, active=False)
    resp = client_for(alex).patch(detail(med), {"active": True}, format="json")
    assert resp.status_code == 200
    med.refresh_from_db()
    assert med.active is True


def test_missing_id_is_404(client_for, alex):
    assert client_for(alex).get(f"{URL}999999/").status_code == 404


# ---------- refill ----------


def test_refill_adds_pills(client_for, make_medication, alex):
    med = make_medication(alex, pills_remaining=5, refill_threshold=10)
    resp = client_for(alex).post(refill_url(med), {"pills_added": 30}, format="json")
    assert resp.status_code == 200
    assert resp.json()["pills_remaining"] == 35
    assert resp.json()["low_supply"] is False
    med.refresh_from_db()
    assert med.pills_remaining == 35


@pytest.mark.parametrize("value", [0, -3, "abc", 10_001, None])
def test_refill_rejects_bad_amounts(client_for, make_medication, alex, value):
    med = make_medication(alex, pills_remaining=5)
    resp = client_for(alex).post(refill_url(med), {"pills_added": value}, format="json")
    assert resp.status_code == 400
    med.refresh_from_db()
    assert med.pills_remaining == 5


def test_refill_cannot_push_total_over_the_maximum(client_for, make_medication, alex):
    med = make_medication(alex, pills_remaining=95_000)
    resp = client_for(alex).post(refill_url(med), {"pills_added": 10_000}, format="json")
    assert resp.status_code == 400
    med.refresh_from_db()
    assert med.pills_remaining == 95_000


# ---------- authentication ----------


@pytest.mark.parametrize(
    "method,suffix",
    [
        ("get", ""),
        ("post", ""),
        ("get", "1/"),
        ("patch", "1/"),
        ("delete", "1/"),
        ("post", "1/refill/"),
    ],
)
def test_everything_requires_login(method, suffix):
    assert getattr(APIClient(), method)(URL + suffix).status_code == 401


# ---------- isolation between strangers ----------


def test_stranger_gets_identical_404_for_real_and_missing_medications(
    client_for, make_medication, alex, stranger
):
    med = make_medication(alex)
    api = client_for(stranger)
    real = api.get(detail(med))
    missing = api.get(f"{URL}999999/")
    assert real.status_code == missing.status_code == 404
    assert real.json() == missing.json()


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 200, 200))
def test_caregiver_list_with_profile(
    client_for, make_link, make_medication, alex, mum, state, expected
):
    prepare(make_link, alex, mum, state)
    make_medication(mum, name="Mum med")
    resp = client_for(alex).get(URL, {"profile": mum.id})
    assert resp.status_code == expected
    if expected == 200:
        assert names(resp) == ["Mum med"]


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 200, 200))
def test_caregiver_get_detail(client_for, make_link, make_medication, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    med = make_medication(mum)
    assert client_for(alex).get(detail(med)).status_code == expected


@pytest.mark.parametrize("state,expected", matrix(403, 403, 403, 403, 403, 201))
def test_caregiver_create(client_for, make_link, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    resp = client_for(alex).post(URL, {**PAYLOAD, "profile": mum.id}, format="json")
    assert resp.status_code == expected
    if expected == 201:
        assert Medication.objects.get().owner == mum  # owned by the recipient, not the caregiver
    else:
        assert Medication.objects.count() == 0


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 200))
def test_caregiver_patch(client_for, make_link, make_medication, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    med = make_medication(mum, name="Original")
    resp = client_for(alex).patch(detail(med), {"name": "Changed"}, format="json")
    assert resp.status_code == expected
    med.refresh_from_db()
    assert med.name == ("Changed" if expected == 200 else "Original")


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 204))
def test_caregiver_delete(client_for, make_link, make_medication, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    med = make_medication(mum)
    assert client_for(alex).delete(detail(med)).status_code == expected
    med.refresh_from_db()
    assert med.active is (expected != 204)


@pytest.mark.parametrize("state,expected", matrix(404, 404, 404, 404, 403, 200))
def test_caregiver_refill(client_for, make_link, make_medication, alex, mum, state, expected):
    prepare(make_link, alex, mum, state)
    med = make_medication(mum, pills_remaining=5)
    resp = client_for(alex).post(refill_url(med), {"pills_added": 30}, format="json")
    assert resp.status_code == expected
    med.refresh_from_db()
    assert med.pills_remaining == (35 if expected == 200 else 5)


def test_access_is_one_directional(client_for, make_link, make_medication, alex, mum):
    make_link(alex, mum, status="active", permission="edit")  # alex cares for mum
    med = make_medication(alex)
    assert client_for(mum).get(detail(med)).status_code == 404
    assert client_for(mum).get(URL, {"profile": alex.id}).status_code == 403


def test_medications_include_their_schedules(client_for, make_medication, make_schedule, alex):
    from datetime import time

    med = make_medication(alex)
    make_schedule(med, time_of_day=time(20, 0))
    make_schedule(med, time_of_day=time(8, 0), active=False)
    api = client_for(alex)

    detail_body = api.get(detail(med)).json()
    listed = api.get(URL).json()["results"][0]

    for body in (detail_body, listed):
        assert [(s["time_of_day"], s["active"]) for s in body["schedules"]] == [
            ("08:00", False),
            ("20:00", True),
        ]
