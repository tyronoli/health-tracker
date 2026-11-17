import pytest
from django.db import IntegrityError

from apps.accounts.models import User

PASSWORD = "Tr0ub4dor&3-fake"


@pytest.mark.django_db
def test_email_is_normalized_to_lowercase():
    user = User.objects.create_user(email="Alex@Example.COM", password=PASSWORD)
    assert user.email == "alex@example.com"


@pytest.mark.django_db
def test_email_is_required():
    with pytest.raises(ValueError):
        User.objects.create_user(email="", password=PASSWORD)


@pytest.mark.django_db
def test_new_user_defaults_to_utc():
    user = User.objects.create_user(email="a@example.com", password=PASSWORD)
    assert user.timezone == "UTC"


@pytest.mark.django_db
def test_superuser_flags():
    admin = User.objects.create_superuser(email="root@example.com", password=PASSWORD)
    assert admin.is_staff and admin.is_superuser


@pytest.mark.django_db
def test_duplicate_email_is_rejected():
    User.objects.create_user(email="a@example.com", password=PASSWORD)
    with pytest.raises(IntegrityError):
        User.objects.create_user(email="a@example.com", password=PASSWORD)
