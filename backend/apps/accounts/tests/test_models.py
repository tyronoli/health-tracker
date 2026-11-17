import pytest
from django.contrib.auth import get_user_model


@pytest.mark.django_db
def test_new_user_defaults_to_utc():
    user = get_user_model().objects.create_user(username="demo", password="pw-for-tests-only")
    assert user.timezone == "UTC"
