"""Same-origin web login: a configured access code becomes an HttpOnly cookie."""

from __future__ import annotations

import hmac
from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from app import browser_sessions
from app.config import get_settings
from app.errors import ApiError

router = APIRouter(prefix="/app/auth", tags=["browser auth"])


class Login(BaseModel):
    code: str = Field(min_length=1, max_length=128)


def _check_browser(request: Request) -> None:
    if not browser_sessions.browser_request_allowed(request.scope):
        raise ApiError(403, "browser_origin_required", "use the website on this server to sign in")


def _private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store, private"
    response.headers["Vary"] = "Cookie"


def _state(request: Request) -> dict:
    expiry = browser_sessions.session_expiry(request.scope)
    return {
        "authenticated": expiry is not None,
        "expires_at": datetime.fromtimestamp(expiry, UTC).isoformat() if expiry else None,
        "login_available": get_settings().web_login_code is not None,
    }


@router.get("/session")
async def session(request: Request, response: Response) -> dict:
    _check_browser(request)
    _private(response)
    return _state(request)


@router.post("/login")
async def login(body: Login, request: Request, response: Response) -> dict:
    _check_browser(request)
    settings = get_settings()
    if settings.web_login_code is None:
        raise ApiError(
            503,
            "login_unavailable",
            "browser login needs WEB_LOGIN_CODE in Railway service variables",
        )
    if not browser_sessions.login_allowed(request.client.host if request.client else "unknown"):
        raise ApiError(429, "login_rate_limited", "too many login attempts; try again in a minute")
    if not hmac.compare_digest(
        body.code.encode(), settings.web_login_code.get_secret_value().encode()
    ):
        raise ApiError(401, "unauthorized", "login code not accepted")
    browser_sessions.revoke(request.scope)
    token, expiry = browser_sessions.issue(settings)
    secure = request.url.scheme == "https"
    response.set_cookie(
        browser_sessions.COOKIE if secure else browser_sessions.LOCAL_COOKIE,
        token,
        max_age=settings.web_session_ttl_s,
        secure=secure,
        httponly=True,
        samesite="strict",
        path="/",
    )
    _private(response)
    return {"authenticated": True, "expires_at": datetime.fromtimestamp(expiry, UTC).isoformat()}


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict:
    _check_browser(request)
    browser_sessions.revoke(request.scope)
    secure = request.url.scheme == "https"
    response.delete_cookie(
        browser_sessions.COOKIE if secure else browser_sessions.LOCAL_COOKIE,
        secure=secure,
        httponly=True,
        samesite="strict",
        path="/",
    )
    _private(response)
    return {"authenticated": False}
