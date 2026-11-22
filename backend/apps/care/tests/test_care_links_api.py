import pytest
from rest_framework.test import APIClient

from apps.care.models import CareLink
from apps.care.permissions import can_access_profile

pytestmark = pytest.mark.django_db

LINKS = "/api/care-links/"
PROFILES = "/api/profiles/"


def action_url(link, name):
    return f"{LINKS}{link.id}/{name}/"


def detail_url(link):
    return f"{LINKS}{link.id}/"


# --- invite ---


def test_invite_creates_pending_link(client_for, alex, mum):
    resp = client_for(alex).post(
        LINKS, {"email": "mum@example.com", "permission": "edit"}, format="json"
    )
    assert resp.status_code == 201
    link = CareLink.objects.get()
    assert (link.caregiver, link.recipient) == (alex, mum)
    assert link.status == "pending"
    assert link.permission == "edit"


def test_invite_defaults_to_view_and_ignores_email_case(client_for, alex, mum):
    resp = client_for(alex).post(LINKS, {"email": "MUM@Example.com"}, format="json")
    assert resp.status_code == 201
    assert CareLink.objects.get().permission == "view"


def test_invite_response_is_identical_for_unknown_email(client_for, alex, mum):
    known = client_for(alex).post(LINKS, {"email": "mum@example.com"}, format="json")
    unknown = client_for(alex).post(LINKS, {"email": "nobody@example.com"}, format="json")
    assert known.status_code == unknown.status_code == 201
    assert known.json() == unknown.json()
    assert CareLink.objects.count() == 1  # nothing created for the unknown email


def test_cannot_invite_yourself(client_for, alex):
    resp = client_for(alex).post(LINKS, {"email": "alex@example.com"}, format="json")
    assert resp.status_code == 400
    assert CareLink.objects.count() == 0


@pytest.mark.parametrize("status", ["pending", "active"])
def test_duplicate_open_invite_conflicts(client_for, make_link, alex, mum, status):
    make_link(alex, mum, status=status)
    resp = client_for(alex).post(LINKS, {"email": "mum@example.com"}, format="json")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "link_exists"


@pytest.mark.parametrize("status", ["declined", "revoked"])
def test_can_invite_again_after_declined_or_revoked(client_for, make_link, alex, mum, status):
    make_link(alex, mum, status=status)
    resp = client_for(alex).post(LINKS, {"email": "mum@example.com"}, format="json")
    assert resp.status_code == 201
    assert CareLink.objects.count() == 2


def test_invite_validates_input(client_for, alex):
    bad_email = {"email": "not-an-email"}
    assert client_for(alex).post(LINKS, bad_email, format="json").status_code == 400
    bad_permission = {"email": "mum@example.com", "permission": "admin"}
    assert client_for(alex).post(LINKS, bad_permission, format="json").status_code == 400


def test_invite_requires_login():
    resp = APIClient().post(LINKS, {"email": "mum@example.com"}, format="json")
    assert resp.status_code == 401


# --- list ---


def test_list_shows_only_my_links(client_for, make_link, alex, mum, stranger):
    link = make_link(alex, mum, status="pending")
    for user in (alex, mum):
        body = client_for(user).get(LINKS).json()
        assert [item["id"] for item in body["results"]] == [link.id]
    assert client_for(stranger).get(LINKS).json()["count"] == 0


def test_list_contains_both_people(client_for, make_link, alex, mum):
    make_link(alex, mum)
    item = client_for(alex).get(LINKS).json()["results"][0]
    assert item["caregiver"]["email"] == "alex@example.com"
    assert item["recipient"]["email"] == "mum@example.com"
    assert item["status"] == "active"


def test_list_filters_by_role_and_status(client_for, make_link, alex, mum, stranger):
    as_caregiver = make_link(alex, mum, status="pending")
    as_recipient = make_link(stranger, alex, status="active")
    api = client_for(alex)

    def ids(resp):
        return {i["id"] for i in resp.json()["results"]}

    assert ids(api.get(LINKS, {"role": "caregiver"})) == {as_caregiver.id}
    assert ids(api.get(LINKS, {"role": "recipient"})) == {as_recipient.id}
    assert ids(api.get(LINKS, {"status": "active"})) == {as_recipient.id}
    assert api.get(LINKS, {"role": "banana"}).status_code == 400


def test_list_requires_login():
    assert APIClient().get(LINKS).status_code == 401


# --- accept ---


def test_recipient_accepts(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending", permission="edit")
    resp = client_for(mum).post(action_url(link, "accept"))
    assert resp.status_code == 200
    link.refresh_from_db()
    assert link.status == "active"
    assert link.responded_at is not None
    assert link.permission == "edit"
    assert can_access_profile(alex, mum, write=True)


def test_recipient_can_accept_with_lower_permission(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending", permission="edit")
    resp = client_for(mum).post(action_url(link, "accept"), {"permission": "view"}, format="json")
    assert resp.status_code == 200
    link.refresh_from_db()
    assert link.permission == "view"
    assert not can_access_profile(alex, mum, write=True)


def test_recipient_cannot_accept_with_higher_permission(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending", permission="view")
    resp = client_for(mum).post(action_url(link, "accept"), {"permission": "edit"}, format="json")
    assert resp.status_code == 400
    link.refresh_from_db()
    assert link.status == "pending"


def test_caregiver_cannot_accept_own_invite(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending")
    resp = client_for(alex).post(action_url(link, "accept"))
    assert resp.status_code == 403
    link.refresh_from_db()
    assert link.status == "pending"
    assert not can_access_profile(alex, mum)


def test_stranger_cannot_even_see_the_link(client_for, make_link, alex, mum, stranger):
    link = make_link(alex, mum, status="pending")
    api = client_for(stranger)
    assert api.post(action_url(link, "accept")).status_code == 404
    assert api.post(action_url(link, "revoke")).status_code == 404
    patch = api.patch(detail_url(link), {"permission": "edit"}, format="json")
    assert patch.status_code == 404


def test_missing_and_forbidden_links_look_identical(client_for, make_link, alex, mum, stranger):
    link = make_link(alex, mum, status="pending")
    api = client_for(stranger)
    real = api.post(action_url(link, "accept"))
    missing = api.post(f"{LINKS}999999/accept/")
    assert real.status_code == missing.status_code == 404
    assert real.json() == missing.json()


@pytest.mark.parametrize("status", ["active", "declined", "revoked"])
def test_accept_only_works_on_pending(client_for, make_link, alex, mum, status):
    link = make_link(alex, mum, status=status)
    assert client_for(mum).post(action_url(link, "accept")).status_code == 409


# --- decline ---


def test_recipient_declines(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending")
    resp = client_for(mum).post(action_url(link, "decline"))
    assert resp.status_code == 200
    link.refresh_from_db()
    assert link.status == "declined"
    assert not can_access_profile(alex, mum)


def test_caregiver_cannot_decline(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending")
    assert client_for(alex).post(action_url(link, "decline")).status_code == 403


# --- revoke ---


def test_recipient_revokes_and_access_ends_immediately(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="active", permission="edit")
    assert can_access_profile(alex, mum, write=True)
    resp = client_for(mum).post(action_url(link, "revoke"))
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"
    assert not can_access_profile(alex, mum)


def test_caregiver_can_end_the_link_too(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="active")
    assert client_for(alex).post(action_url(link, "revoke")).status_code == 200
    assert not can_access_profile(alex, mum)


def test_caregiver_can_cancel_a_pending_invite(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending")
    assert client_for(alex).post(action_url(link, "revoke")).status_code == 200
    link.refresh_from_db()
    assert link.status == "revoked"


@pytest.mark.parametrize("status", ["declined", "revoked"])
def test_cannot_revoke_a_closed_link(client_for, make_link, alex, mum, status):
    link = make_link(alex, mum, status=status)
    assert client_for(mum).post(action_url(link, "revoke")).status_code == 409


# --- change permission ---


def test_recipient_changes_permission(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="active", permission="view")
    resp = client_for(mum).patch(detail_url(link), {"permission": "edit"}, format="json")
    assert resp.status_code == 200
    assert can_access_profile(alex, mum, write=True)
    client_for(mum).patch(detail_url(link), {"permission": "view"}, format="json")
    assert not can_access_profile(alex, mum, write=True)


def test_caregiver_cannot_raise_own_permission(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="active", permission="view")
    resp = client_for(alex).patch(detail_url(link), {"permission": "edit"}, format="json")
    assert resp.status_code == 403
    assert not can_access_profile(alex, mum, write=True)


def test_permission_only_changes_on_active_links(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="pending")
    resp = client_for(mum).patch(detail_url(link), {"permission": "edit"}, format="json")
    assert resp.status_code == 409


def test_permission_value_is_validated(client_for, make_link, alex, mum):
    link = make_link(alex, mum, status="active")
    resp = client_for(mum).patch(detail_url(link), {"permission": "owner"}, format="json")
    assert resp.status_code == 400


# --- profiles ---


def test_profiles_lists_self_and_active_recipients_only(
    client_for, make_link, make_user, alex, mum
):
    dad = make_user("dad@example.com", display_name="Dad")
    gran = make_user("gran@example.com", display_name="Gran")
    cat = make_user("cat@example.com", display_name="Cat")
    make_link(alex, mum, status="active", permission="view")
    make_link(alex, dad, status="pending")
    make_link(alex, gran, status="revoked")
    make_link(cat, alex, status="active")  # reverse direction: Alex is the recipient

    body = client_for(alex).get(PROFILES).json()
    assert [(p["user_id"], p["relationship"], p["permission"]) for p in body] == [
        (alex.id, "self", "edit"),
        (mum.id, "recipient", "view"),
    ]


def test_profiles_requires_login():
    assert APIClient().get(PROFILES).status_code == 401
