import pytest
from rest_framework.test import APIClient

from apps.accounts.models import NotificationSettings

pytestmark = pytest.mark.django_db

URL = "/api/notification-settings/"


def test_a_new_user_gets_the_defaults(client_for, alex):
    assert client_for(alex).get(URL).json() == {
        "email_enabled": True,
        "push_enabled": True,
        "appointment_reminder_minutes": 1440,
        "missed_dose_grace_minutes": 60,
    }


def test_update_settings(client_for, alex):
    resp = client_for(alex).patch(
        URL, {"email_enabled": False, "missed_dose_grace_minutes": 120}, format="json"
    )
    assert resp.status_code == 200
    saved = NotificationSettings.for_user(alex)
    assert saved.email_enabled is False
    assert saved.missed_dose_grace_minutes == 120
    assert saved.push_enabled is True  # untouched


def test_settings_are_personal(client_for, alex, mum):
    client_for(alex).patch(URL, {"email_enabled": False}, format="json")
    assert client_for(mum).get(URL).json()["email_enabled"] is True


@pytest.mark.parametrize(
    "bad",
    [
        {"appointment_reminder_minutes": 4},
        {"appointment_reminder_minutes": 10_081},
        {"missed_dose_grace_minutes": 4},
        {"missed_dose_grace_minutes": 721},
        {"missed_dose_grace_minutes": "soon"},
        {"email_enabled": "maybe"},
    ],
)
def test_rejects_bad_values(client_for, alex, bad):
    resp = client_for(alex).patch(URL, bad, format="json")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "validation_error"


def test_requires_login():
    assert APIClient().get(URL).status_code == 401
    assert APIClient().patch(URL, {}, format="json").status_code == 401


def test_only_get_and_patch_are_allowed(client_for, alex):
    api = client_for(alex)
    assert api.put(URL, {}, format="json").status_code == 405
    assert api.post(URL, {}, format="json").status_code == 405
    assert api.delete(URL).status_code == 405


def test_for_user_gives_defaults_without_saving_anything(alex):
    prefs = NotificationSettings.for_user(alex)
    assert (prefs.email_enabled, prefs.missed_dose_grace_minutes) == (True, 60)
    assert NotificationSettings.objects.count() == 0
