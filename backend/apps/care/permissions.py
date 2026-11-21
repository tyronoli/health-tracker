from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import User

from .models import CareLink


def can_access_profile(
    request_user: User | AnonymousUser, target_user: User, *, write: bool = False
) -> bool:
    """The one place that decides whose data a user may touch."""
    if not request_user.is_authenticated:
        return False
    if request_user.pk == target_user.pk:
        return True
    links = CareLink.objects.filter(
        caregiver=request_user,
        recipient=target_user,
        status=CareLink.Status.ACTIVE,
    )
    if write:
        links = links.filter(permission=CareLink.Permission.EDIT)
    return links.exists()


def get_target_profile(user: User, profile_id: str | int | None, *, write: bool = False) -> User:
    """Turn a ?profile=<id> value into a user the caller may access, or raise."""
    if profile_id in (None, ""):
        return user
    try:
        target_id = int(profile_id)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ValidationError({"profile": ["Must be a valid user id."]}) from None

    target = User.objects.filter(pk=target_id, is_active=True).first()
    if target is None or not can_access_profile(user, target, write=write):
        # Same answer for "doesn't exist" and "not yours": no information leaks.
        raise PermissionDenied("You do not have access to this profile.")
    return target


def check_object_access(user: User, owner: User, *, write: bool = False) -> None:
    """Object-level gate: not visible at all -> 404; visible but read-only -> 403."""
    if not can_access_profile(user, owner):
        raise NotFound()
    if write and not can_access_profile(user, owner, write=True):
        raise PermissionDenied("You only have view access to this profile.")
