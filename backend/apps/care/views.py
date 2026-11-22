from typing import cast

from django.db.models import Q, QuerySet
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User

from . import services
from .models import CareLink
from .serializers import (
    AcceptSerializer,
    CareLinkSerializer,
    InviteSerializer,
    PermissionSerializer,
)

INVITE_MESSAGE = "If an account exists for that email, an invitation has been sent."


class CareLinkViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = CareLinkSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    lookup_value_regex = "[0-9]+"

    def get_queryset(self) -> QuerySet[CareLink]:
        user = cast(User, self.request.user)
        # Scoping the queryset is what makes other people's links return 404.
        queryset = CareLink.objects.filter(Q(caregiver=user) | Q(recipient=user)).select_related(
            "caregiver", "recipient"
        )
        if self.action == "list":
            queryset = self._apply_filters(queryset, user)
        return queryset

    def _apply_filters(self, queryset: QuerySet[CareLink], user: User) -> QuerySet[CareLink]:
        role = self.request.query_params.get("role")
        if role == "caregiver":
            queryset = queryset.filter(caregiver=user)
        elif role == "recipient":
            queryset = queryset.filter(recipient=user)
        elif role is not None:
            raise ValidationError({"role": ["Must be 'caregiver' or 'recipient'."]})

        status_value = self.request.query_params.get("status")
        if status_value is not None:
            if status_value not in CareLink.Status.values:
                raise ValidationError({"status": ["Not a valid status."]})
            queryset = queryset.filter(status=status_value)
        return queryset

    def create(self, request: Request) -> Response:
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.invite(
            cast(User, request.user),
            serializer.validated_data["email"],
            serializer.validated_data["permission"],
        )
        return Response({"message": INVITE_MESSAGE}, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        link = self.get_object()
        serializer = PermissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = services.change_permission(
            link, cast(User, request.user), serializer.validated_data["permission"]
        )
        return Response(CareLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def accept(self, request: Request, pk: str | None = None) -> Response:
        link = self.get_object()
        serializer = AcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        link = services.accept_invite(
            link, cast(User, request.user), serializer.validated_data.get("permission")
        )
        return Response(CareLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def decline(self, request: Request, pk: str | None = None) -> Response:
        link = services.decline_invite(self.get_object(), cast(User, request.user))
        return Response(CareLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def revoke(self, request: Request, pk: str | None = None) -> Response:
        link = services.revoke(self.get_object(), cast(User, request.user))
        return Response(CareLinkSerializer(link).data)


class ProfileListView(APIView):
    """Whose data can I open? Myself, plus everyone who has an active link to me."""

    def get(self, request: Request) -> Response:
        user = cast(User, request.user)
        profiles = [
            {
                "user_id": user.id,
                "display_name": user.display_name or user.email,
                "relationship": "self",
                "permission": "edit",
            }
        ]
        links = (
            CareLink.objects.filter(caregiver=user, status=CareLink.Status.ACTIVE)
            .select_related("recipient")
            .order_by("recipient__display_name", "recipient__email")
        )
        profiles += [
            {
                "user_id": link.recipient_id,
                "display_name": link.recipient.display_name or link.recipient.email,
                "relationship": "recipient",
                "permission": link.permission,
            }
            for link in links
        ]
        return Response(profiles)
