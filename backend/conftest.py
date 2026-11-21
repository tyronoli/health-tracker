import pytest

PASSWORD = "Tr0ub4dor&3-fake"


@pytest.fixture
def make_user(db):
    def _make(email: str, **kwargs):
        from apps.accounts.models import User

        return User.objects.create_user(email=email, password=PASSWORD, **kwargs)

    return _make


@pytest.fixture
def alex(make_user):
    return make_user("alex@example.com", display_name="Alex")


@pytest.fixture
def mum(make_user):
    return make_user("mum@example.com", display_name="Mum")


@pytest.fixture
def stranger(make_user):
    return make_user("stranger@example.com", display_name="Stranger")


@pytest.fixture
def make_link(db):
    def _make(caregiver, recipient, status="active", permission="view"):
        from apps.care.models import CareLink

        return CareLink.objects.create(
            caregiver=caregiver, recipient=recipient, status=status, permission=permission
        )

    return _make


@pytest.fixture
def client_for():
    from rest_framework.test import APIClient

    def _client(user):
        client = APIClient()
        client.force_login(user)
        return client

    return _client
