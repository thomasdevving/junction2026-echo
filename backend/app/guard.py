"""Pure ASGI middleware: demo-key check and body-size cap BEFORE any body is parsed.

FastAPI parses the request body before router-level dependencies run, so without this an
unauthenticated caller could make the server parse (and spool) a large body, and would see a
400/422 instead of the contract's 401. The router-level dependency stays as a second layer.
"""

from __future__ import annotations

import hmac
import json
import re

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app import browser_sessions
from app.config import get_settings

OPEN_PREFIXES = ("/local-files/", "/local-upload/", "/app/")
OPEN_EXACT = ("/health", "/app")
# Authorised by its own per-session token (app/routers/latest_frame.py): <img> sends no header.
OPEN_PATTERN = re.compile(r"^/sessions/[^/]+/latest-frame\.jpg$")
FRAME_PATHS = ("/check", "/watch")
# Multipart frame: the 1.5 MB contract limit plus room for the form fields. The exact limits and
# JPEG validation are in app/media/images.py.
MAX_FRAME_BODY = 2 * 1024 * 1024
MAX_JSON_BODY = 64 * 1024


async def _send_error(send: Send, status: int, code: str, message: str) -> None:
    body = json.dumps(
        {"error": {"code": code, "message": message, "retryable": False, "request_id": None}}
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class GuardMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")
        browser_auth = path in browser_sessions.AUTH_PATHS
        if not browser_auth and (
            path in OPEN_EXACT or path.startswith(OPEN_PREFIXES) or OPEN_PATTERN.match(path)
        ):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        given = headers.get(b"x-demo-key", b"")
        expected = get_settings().demo_api_key.get_secret_value().encode()
        cookie_auth = browser_sessions.session_expiry(scope)
        if (
            not browser_auth
            and (not given or not hmac.compare_digest(given, expected))
            and not cookie_auth
        ):
            await _send_error(send, 401, "unauthorized", "missing or wrong X-Demo-Key")
            return

        limit = 4096 if browser_auth else MAX_FRAME_BODY if path in FRAME_PATHS else MAX_JSON_BODY
        declared = headers.get(b"content-length")
        if declared is not None and declared.isdigit() and int(declared) > limit:
            await _send_error(send, 413, "payload_too_large", "request body too large")
            return

        # Read the (capped) body up front, then replay it. Guarded bodies are small (64 KB
        # JSON, 8 MB frames), so buffering costs nothing the parser would not spend anyway.
        chunks: list[bytes] = []
        seen = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            if message["type"] != "http.request":
                continue
            chunk = message.get("body", b"")
            seen += len(chunk)
            if seen > limit:
                await _send_error(send, 413, "payload_too_large", "request body too large")
                return
            chunks.append(chunk)
            if not message.get("more_body", False):
                break

        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": b"".join(chunks), "more_body": False}
            return await receive()

        async def private_send(message: Message) -> None:
            if message["type"] == "http.response.start" and (cookie_auth or browser_auth):
                headers = list(message.get("headers", []))
                headers = [(k, v) for k, v in headers if k.lower() != b"cache-control"]
                headers.append((b"cache-control", b"no-store, private"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, replay, private_send)
