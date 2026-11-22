from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.core.exceptions import Conflict

from .models import CareLink

_RANK = {"view": 0, "edit": 1}


def _require_recipient(link: CareLink, user: User) -> None:
    if link.recipient_id != user.pk:
        raise PermissionDenied("Only the recipient can do this.")


def _require_status(link: CareLink, *allowed: str) -> None:
    if link.status not in allowed:
        raise Conflict(f"This link is {link.status}.", code="invalid_state")


def invite(caregiver: User, email: str, permission: str) -> None:
    """Create a pending link if the email has an account. Silent otherwise."""
    email = email.strip().lower()
    if email == caregiver.email:
        raise ValidationError({"email": ["You cannot link to yourself."]})

    recipient = User.objects.filter(email__iexact=email, is_active=True).first()
    if recipient is None:
        return  # no account: do nothing, and look exactly the same to the caller
    try:
        with transaction.atomic():
            CareLink.objects.create(caregiver=caregiver, recipient=recipient, permission=permission)
    except IntegrityError:
        raise Conflict("A link with this person already exists.", code="link_exists") from None


def accept_invite(link: CareLink, user: User, permission: str | None = None) -> CareLink:
    _require_recipient(link, user)
    _require_status(link, CareLink.Status.PENDING)
    if permission is not None:
        if _RANK[permission] > _RANK[link.permission]:
            raise ValidationError(
                {"permission": ["You cannot grant more access than was requested."]}
            )
        link.permission = permission
    link.status = CareLink.Status.ACTIVE
    link.responded_at = timezone.now()
    link.save(update_fields=["permission", "status", "responded_at"])
    return link


def decline_invite(link: CareLink, user: User) -> CareLink:
    _require_recipient(link, user)
    _require_status(link, CareLink.Status.PENDING)
    link.status = CareLink.Status.DECLINED
    link.responded_at = timezone.now()
    link.save(update_fields=["status", "responded_at"])
    return link


def revoke(link: CareLink, user: User) -> CareLink:
    if user.pk not in (link.caregiver_id, link.recipient_id):
        raise PermissionDenied("You are not part of this link.")
    _require_status(link, CareLink.Status.PENDING, CareLink.Status.ACTIVE)
    link.status = CareLink.Status.REVOKED
    link.save(update_fields=["status"])
    return link


def change_permission(link: CareLink, user: User, permission: str) -> CareLink:
    _require_recipient(link, user)
    _require_status(link, CareLink.Status.ACTIVE)
    link.permission = permission
    link.save(update_fields=["permission"])
    return link
