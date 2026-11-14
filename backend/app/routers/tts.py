"""GET /tts-token (API-CONTRACT §5.4): an ElevenLabs single-use token for the TTS WebSocket.

Same idea as /live-token: the phone talks to ElevenLabs directly, the ElevenLabs API key never
leaves the server.

- POST {ELEVENLABS_API}/v1/single-use-token/tts_websocket with `xi-api-key`; 5 s timeout.
- The token lasts 15 minutes and is consumed when the WebSocket opens, so it is never cached.
- At most RATE_MAX tokens per RATE_WINDOW_S per credential (demo key or browser session), so a
  client reconnect loop cannot burn ElevenLabs quota.
- Neither the API key nor the token is ever logged: only voice, model, status and expiry.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from collections import deque
from datetime import UTC, datetime, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Request

from app import browser_sessions
from app.config import Settings, get_settings
from app.errors import ApiError
from app.schemas import TtsTokenOut

router = APIRouter(tags=["tts"])
log = logging.getLogger("echo.tts")

ELEVENLABS_API = "https://api.elevenlabs.io"
TOKEN_PATH = "/v1/single-use-token/tts_websocket"
OUTPUT_FORMAT = "pcm_24000"
TOKEN_TTL = timedelta(minutes=15)
TIMEOUT_S = 5.0
RATE_MAX = 30
RATE_WINDOW_S = 60.0

# Tests swap this for an httpx.MockTransport; None = the real network.
transport: httpx.AsyncBaseTransport | None = None

# Clock for the rate-limit window (tests replace it).
_clock = time.monotonic

# credential digest -> monotonic times of recent mints (attempts count, success or not)
_recent: dict[str, deque[float]] = {}


def reset() -> None:
    """Tests: forget the rate-limit windows."""
    _recent.clear()


def _credential(request: Request, settings: Settings) -> str:
    """A digest of the credential that actually authorised the request.

    Auth passes on a valid demo key OR a valid browser session, so a cookie caller may also send
    a junk X-Demo-Key. Only a header that matches the real key selects the shared demo-key
    bucket; anything else falls back to the session cookie, so junk headers cannot open fresh
    buckets. Both kinds are bounded: one demo key, and only live browser sessions get past auth.
    """
    given = (request.headers.get("x-demo-key") or "").encode()
    expected = settings.demo_api_key.get_secret_value().encode()
    if given and hmac.compare_digest(given, expected):
        material = "key"
    else:
        # The same cookie browser_sessions validated (its name depends on the scheme), so an
        # extra cookie under the other name cannot select a fresh bucket.
        material = f"browser:{browser_sessions._token(request.scope)}"
    return hashlib.sha256(material.encode()).hexdigest()


def _claim(credential: str) -> None:
    now = _clock()
    window = _recent.setdefault(credential, deque())
    while window and now - window[0] >= RATE_WINDOW_S:
        window.popleft()
    if len(window) >= RATE_MAX:
        raise ApiError(
            429,
            "quota_exhausted",
            f"at most {RATE_MAX} tts tokens per minute",
            retryable=True,
        )
    window.append(now)
    # Keep the table small: credentials with an empty window carry no information.
    if len(_recent) > 256:
        for k in [k for k, w in _recent.items() if not w or now - w[-1] >= RATE_WINDOW_S]:
            del _recent[k]


def _unavailable(message: str) -> ApiError:
    return ApiError(503, "model_unavailable", message, retryable=True)


async def _mint(api_key: str) -> str:
    try:
        async with httpx.AsyncClient(
            base_url=ELEVENLABS_API, timeout=TIMEOUT_S, transport=transport
        ) as client:
            r = await client.post(TOKEN_PATH, headers={"xi-api-key": api_key})
    except httpx.HTTPError as exc:
        # The exception text can carry the request; log only its type.
        log.warning("tts_token mint failed: %s", type(exc).__name__)
        raise _unavailable("ElevenLabs did not answer") from None
    if r.status_code == 429:
        log.warning("tts_token mint rate-limited by ElevenLabs")
        raise ApiError(429, "quota_exhausted", "ElevenLabs rate limit", retryable=True)
    if r.status_code != 200:
        log.warning("tts_token mint failed: ElevenLabs status %d", r.status_code)
        raise _unavailable(f"ElevenLabs answered {r.status_code}")
    try:
        token = r.json().get("token")
    except (ValueError, AttributeError):
        token = None
    if not isinstance(token, str) or not token:
        log.warning("tts_token mint failed: no token in ElevenLabs response")
        raise _unavailable("ElevenLabs returned no token")
    return token


@router.get("/tts-token", response_model=TtsTokenOut)
async def tts_token(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> TtsTokenOut:
    api_key = (
        settings.elevenlabs_api_key.get_secret_value().strip()
        if settings.elevenlabs_api_key is not None
        else ""
    )
    voice_id = settings.elevenlabs_voice_id
    if not api_key or not voice_id:
        raise _unavailable("ElevenLabs is not configured on the server")
    _claim(_credential(request, settings))
    # Taken before the call, so the client's expiry is never later than ElevenLabs' own.
    expires_at = datetime.now(UTC) + TOKEN_TTL
    token = await _mint(api_key)
    log.info(
        "tts_token",
        extra={
            "fields": {
                "voice_id": voice_id,
                "model": settings.elevenlabs_model,
                "expires_at": expires_at.isoformat(),
            }
        },
    )
    return TtsTokenOut(
        token=token,
        expires_at=expires_at,
        voice_id=voice_id,
        model_id=settings.elevenlabs_model,
        output_format=OUTPUT_FORMAT,
    )
