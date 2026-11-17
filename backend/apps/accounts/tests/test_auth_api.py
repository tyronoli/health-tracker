import pytest
from rest_framework.test import APIClient

from apps.accounts.models import User

PASSWORD = "Tr0ub4dor&3-fake"
CSRF_URL = "/api/auth/csrf/"
REGISTER_URL = "/api/auth/register/"
LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/auth/me/"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email="alex@example.com", password=PASSWORD, display_name="Alex", timezone="Asia/Manila"
    )


def register_payload(**overrides):
    data = {
        "email": "alex@example.com",
        "password": PASSWORD,
        "display_name": "Alex",
        "timezone": "Asia/Manila",
    }
    data.update(overrides)
    return data


# --- csrf ---


def test_csrf_endpoint_sets_cookie(api):
    resp = api.get(CSRF_URL)
    assert resp.status_code == 204
    assert "csrftoken" in resp.cookies


@pytest.mark.django_db
def test_login_requires_csrf_token(user):
    client = APIClient(enforce_csrf_checks=True)
    creds = {"email": "alex@example.com", "password": PASSWORD}

    assert client.post(LOGIN_URL, creds, format="json").status_code == 403

    client.get(CSRF_URL)
    token = client.cookies["csrftoken"].value
    resp = client.post(LOGIN_URL, creds, format="json", HTTP_X_CSRFTOKEN=token)
    assert resp.status_code == 200


# --- register ---


@pytest.mark.django_db
def test_register_creates_user_and_logs_in(api):
    resp = api.post(REGISTER_URL, register_payload(), format="json")
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "alex@example.com"
    assert body["timezone"] == "Asia/Manila"
    assert "password" not in body
    assert api.get(ME_URL).status_code == 200


@pytest.mark.django_db
def test_register_rejects_weak_password(api):
    resp = api.post(REGISTER_URL, register_payload(password="12345678"), format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"
    assert "password" in resp.json()["error"]["fields"]
    assert User.objects.count() == 0


@pytest.mark.django_db
def test_register_rejects_unknown_timezone(api):
    resp = api.post(REGISTER_URL, register_payload(timezone="Mars/Olympus"), format="json")
    assert resp.status_code == 400
    assert "timezone" in resp.json()["error"]["fields"]


@pytest.mark.django_db
def test_register_rejects_duplicate_email_case_insensitively(api, user):
    resp = api.post(REGISTER_URL, register_payload(email="ALEX@example.com"), format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"
    assert User.objects.count() == 1


# --- login / logout ---


@pytest.mark.django_db
def test_login_success(api, user):
    resp = api.post(LOGIN_URL, {"email": "ALEX@example.com", "password": PASSWORD}, format="json")
    assert resp.status_code == 200
    assert resp.json()["email"] == "alex@example.com"
    assert api.get(ME_URL).status_code == 200


@pytest.mark.django_db
def test_wrong_password_and_unknown_email_look_identical(api, user):
    wrong = api.post(
        LOGIN_URL, {"email": "alex@example.com", "password": "nope-nope"}, format="json"
    )
    unknown = api.post(LOGIN_URL, {"email": "who@example.com", "password": PASSWORD}, format="json")
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json() == unknown.json()
    assert wrong.json()["error"]["code"] == "invalid_credentials"


@pytest.mark.django_db
def test_inactive_user_cannot_log_in(api, user):
    user.is_active = False
    user.save()
    resp = api.post(LOGIN_URL, {"email": "alex@example.com", "password": PASSWORD}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_logout_ends_session(api, user):
    api.force_login(user)
    assert api.post(LOGOUT_URL).status_code == 204
    assert api.get(ME_URL).status_code == 401


@pytest.mark.django_db
def test_logout_requires_login(api):
    assert api.post(LOGOUT_URL).status_code == 401


# --- me ---


@pytest.mark.django_db
def test_me_requires_login(api):
    resp = api.get(ME_URL)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


@pytest.mark.django_db
def test_me_returns_current_user(api, user):
    api.force_login(user)
    body = api.get(ME_URL).json()
    assert body == {
        "id": user.id,
        "email": "alex@example.com",
        "display_name": "Alex",
        "timezone": "Asia/Manila",
    }


@pytest.mark.django_db
def test_me_can_update_timezone_and_name(api, user):
    api.force_login(user)
    resp = api.patch(ME_URL, {"timezone": "Europe/London", "display_name": "Al"}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.timezone == "Europe/London"
    assert user.display_name == "Al"


@pytest.mark.django_db
def test_me_rejects_invalid_timezone(api, user):
    api.force_login(user)
    resp = api.patch(ME_URL, {"timezone": "Nowhere/Land"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_me_cannot_change_email(api, user):
    api.force_login(user)
    api.patch(ME_URL, {"email": "hacker@example.com"}, format="json")
    user.refresh_from_db()
    assert user.email == "alex@example.com"
