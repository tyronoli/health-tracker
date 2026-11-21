import pytest
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.care.permissions import can_access_profile, get_target_profile

pytestmark = pytest.mark.django_db


# --- can_access_profile ---


def test_owner_can_read_and_write(alex):
    assert can_access_profile(alex, alex)
    assert can_access_profile(alex, alex, write=True)


def test_stranger_is_denied(alex, stranger):
    assert not can_access_profile(stranger, alex)
    assert not can_access_profile(stranger, alex, write=True)


def test_anonymous_is_denied(alex):
    assert not can_access_profile(AnonymousUser(), alex)


@pytest.mark.parametrize("status", ["pending", "declined", "revoked"])
def test_non_active_links_grant_nothing(make_link, alex, mum, status):
    make_link(alex, mum, status=status, permission="edit")
    assert not can_access_profile(alex, mum)
    assert not can_access_profile(alex, mum, write=True)


def test_active_view_link_allows_read_only(make_link, alex, mum):
    make_link(alex, mum, status="active", permission="view")
    assert can_access_profile(alex, mum)
    assert not can_access_profile(alex, mum, write=True)


def test_active_edit_link_allows_read_and_write(make_link, alex, mum):
    make_link(alex, mum, status="active", permission="edit")
    assert can_access_profile(alex, mum)
    assert can_access_profile(alex, mum, write=True)


def test_link_is_one_directional(make_link, alex, mum):
    make_link(alex, mum, status="active", permission="edit")
    assert not can_access_profile(mum, alex)
    assert not can_access_profile(mum, alex, write=True)


def test_link_does_not_extend_to_third_parties(make_link, alex, mum, stranger):
    make_link(alex, mum, status="active", permission="edit")
    assert not can_access_profile(stranger, mum)
    assert not can_access_profile(alex, stranger)


# --- get_target_profile (reads the ?profile= value) ---


def test_no_profile_means_self(alex):
    assert get_target_profile(alex, None) == alex
    assert get_target_profile(alex, "") == alex


def test_own_id_is_allowed(alex):
    assert get_target_profile(alex, str(alex.id)) == alex


def test_linked_profile_is_allowed(make_link, alex, mum):
    make_link(alex, mum)
    assert get_target_profile(alex, str(mum.id)) == mum


def test_unknown_id_is_denied_like_any_other(alex):
    with pytest.raises(PermissionDenied):
        get_target_profile(alex, 999999)


def test_unlinked_profile_is_denied(alex, stranger):
    with pytest.raises(PermissionDenied):
        get_target_profile(alex, stranger.id)


def test_write_needs_an_edit_link(make_link, alex, mum):
    make_link(alex, mum, permission="view")
    with pytest.raises(PermissionDenied):
        get_target_profile(alex, mum.id, write=True)


def test_malformed_id_is_a_validation_error(alex):
    with pytest.raises(ValidationError):
        get_target_profile(alex, "abc")
