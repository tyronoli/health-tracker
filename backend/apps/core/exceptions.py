from typing import Any

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler


class InvalidCredentials(exceptions.APIException):
    status_code = 400
    default_detail = "Invalid email or password."
    default_code = "invalid_credentials"


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    error: dict[str, Any]
    if isinstance(exc, exceptions.ValidationError):
        if isinstance(response.data, dict):
            error = {
                "code": "validation_error",
                "message": "One or more fields are invalid.",
                "fields": response.data,
            }
        else:
            error = {
                "code": "validation_error",
                "message": " ".join(str(item) for item in response.data),
            }
    else:
        codes = exc.get_codes() if isinstance(exc, exceptions.APIException) else None
        code = codes if isinstance(codes, str) else "error"
        if code == "throttled":
            code = "rate_limited"
        message = str(exc.detail) if isinstance(exc, exceptions.APIException) else "Request failed."
        error = {"code": code, "message": message}

    response.data = {"error": error}
    return response
