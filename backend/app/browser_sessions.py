"""Opaque, revocable browser sessions. No Railway key is sent to browser code.

The deployment uses one worker. Session and login-limit state intentionally expires
on restart; an authenticated browser signs in again after a deployment.
"""

from __future__ import annotations

import hashlib
import secrets
import time
from collections import OrderedDict, deque
from http.cookies import CookieError, SimpleCookie
from urllib.parse import urlsplit

from starlette.datastructures import Headers
from starlette.types import Scope

from app.config import Settings

COOKIE = "__Host-echo_session"
LOCAL_COOKIE = "echo_local_session"
BROWSER_HEADER = "x-echo-browser"
AUTH_PATHS = {"/app/auth/session", "/app/auth/login", "/app/auth/logout"}
_sessions: OrderedDict[str, float] = OrderedDict()
_attempts: OrderedDict[str, deque[float]] = OrderedDict()
_global_attempts: deque[float] = deque()


def reset() -> None:
    _sessions.clear()
    _attempts.clear()
    _global_attempts.clear()


def transport_allowed(scope: Scope) -> bool:
    if scope.get("scheme") == "https":
        return True
    host = urlsplit(f"http://{Headers(scope=scope).get('host', '')}").hostname
    return host in {"localhost", "127.0.0.1", "::1"}


def browser_request_allowed(scope: Scope) -> bool:
    """Custom header + exact Origin for unsafe requests, even on sibling sites."""
    if not transport_allowed(scope):
        return False
    headers = Headers(scope=scope)
    if headers.get(BROWSER_HEADER) != "1":
        return False
    if headers.get("sec-fetch-site") == "cross-site":
        return False
    expected = f"{scope.get('scheme', 'http')}://{headers.get('host', '')}"
    origin = headers.get("origin")
    if origin is not None and origin != expected:
        return False
    return scope.get("method") in {"GET", "HEAD", "OPTIONS"} or origin == expected


def _prune(now: float) -> None:
    for key in [key for key, expiry in _sessions.items() if expiry <= now]:
        del _sessions[key]


def issue(settings: Settings) -> tuple[str, float]:
    now = time.time()
    _prune(now)
    token = secrets.token_urlsafe(32)
    expiry = now + settings.web_session_ttl_s
    _sessions[hashlib.sha256(token.encode()).hexdigest()] = expiry
    while len(_sessions) > 256:
        _sessions.popitem(last=False)
    return token, expiry


def _token(scope: Scope) -> str:
    cookie = SimpleCookie()
    try:
        cookie.load(Headers(scope=scope).get("cookie", ""))
    except CookieError:
        return ""
    name = COOKIE if scope.get("scheme") == "https" else LOCAL_COOKIE
    return cookie[name].value if name in cookie else ""


def session_expiry(scope: Scope) -> float | None:
    if not browser_request_allowed(scope):
        return None
    token = _token(scope)
    if not token or len(token) > 128:
        return None
    now = time.time()
    _prune(now)
    return _sessions.get(hashlib.sha256(token.encode()).hexdigest())


def revoke(scope: Scope) -> None:
    token = _token(scope)
    if token:
        _sessions.pop(hashlib.sha256(token.encode()).hexdigest(), None)


def login_allowed(client: str) -> bool:
    now = time.monotonic()
    cutoff = now - 60
    while _global_attempts and _global_attempts[0] <= cutoff:
        _global_attempts.popleft()
    attempts = _attempts.setdefault(client, deque())
    while attempts and attempts[0] <= cutoff:
        attempts.popleft()
    _attempts.move_to_end(client)
    while len(_attempts) > 1024:
        _attempts.popitem(last=False)
    if len(attempts) >= 8 or len(_global_attempts) >= 120:
        return False
    attempts.append(now)
    _global_attempts.append(now)
    return True
