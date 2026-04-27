from fastapi import Response
from ..config import settings

AUTH_COOKIE_NAME = "access_token"

def set_auth_cookie(response: Response, token: str) -> None:
    secure = (
        settings.COOKIE_SECURE
        if settings.COOKIE_SECURE is not None
        else settings.is_production
    )
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=60 * 60 * 24 * 30,
        path="/",
    )

def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        domain=settings.COOKIE_DOMAIN,
    )
