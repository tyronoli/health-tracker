from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request


class SessionAuthentication401(SessionAuthentication):
    def authenticate_header(self, request: Request) -> str:
        return "Session"
