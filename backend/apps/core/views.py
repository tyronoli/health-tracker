from django.http import HttpRequest, JsonResponse


def csrf_failure(request: HttpRequest, reason: str = "") -> JsonResponse:
    return JsonResponse(
        {"error": {"code": "permission_denied", "message": "CSRF check failed."}}, status=403
    )
