"""GET /tts-token (API-CONTRACT §5.4) with the ElevenLabs call mocked."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.config import get_settings
from app.routers import tts

API_KEY = "el-secret-key-123"
VOICE = "voice-abc"
TOKEN = "sutkn_secret_token_456"


@pytest.fixture(autouse=True)
def _tts(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_API_KEY", API_KEY)
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", VOICE)
    monkeypatch.setenv("ELEVENLABS_MODEL", "")
    get_settings.cache_clear()
    tts.reset()
    yield
    monkeypatch.setattr(tts, "transport", None)
    tts.reset()


def _mock(monkeypatch, handler) -> list[httpx.Request]:
    seen: list[httpx.Request] = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    monkeypatch.setattr(tts, "transport", httpx.MockTransport(wrapped))
    return seen


def _ok(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json={"token": TOKEN})


def test_200_shape(client, auth, monkeypatch, caplog):
    seen = _mock(monkeypatch, _ok)
    caplog.set_level(logging.DEBUG)
    before = datetime.now(UTC)
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"token", "expires_at", "voice_id", "model_id", "output_format"}
    assert body["token"] == TOKEN
    assert body["voice_id"] == VOICE
    assert body["model_id"] == "eleven_flash_v2_5"
    assert body["output_format"] == "pcm_24000"
    expires = datetime.fromisoformat(body["expires_at"].replace("Z", "+00:00"))
    assert before + timedelta(minutes=14) < expires <= datetime.now(UTC) + timedelta(minutes=15)

    assert len(seen) == 1
    req = seen[0]
    assert req.method == "POST"
    assert str(req.url) == "https://api.elevenlabs.io/v1/single-use-token/tts_websocket"
    assert req.headers["xi-api-key"] == API_KEY
    # Neither secret reaches the logs.
    assert API_KEY not in caplog.text and TOKEN not in caplog.text


def test_model_override(client, auth, monkeypatch):
    monkeypatch.setenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
    get_settings.cache_clear()
    _mock(monkeypatch, _ok)
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 200 and r.json()["model_id"] == "eleven_multilingual_v2"


@pytest.mark.parametrize("missing", ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"])
def test_missing_config_503(client, auth, monkeypatch, missing):
    seen = _mock(monkeypatch, _ok)
    monkeypatch.setenv(missing, "  ")
    get_settings.cache_clear()
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 503
    err = r.json()["error"]
    assert err["code"] == "model_unavailable" and err["retryable"] is True
    assert seen == []


@pytest.mark.parametrize("status", [401, 500, 502, 503])
def test_elevenlabs_error_503(client, auth, monkeypatch, caplog, status):
    _mock(monkeypatch, lambda req: httpx.Response(status, json={"detail": "nope"}))
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "model_unavailable"
    assert API_KEY not in caplog.text


def test_elevenlabs_timeout_503(client, auth, monkeypatch):
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    _mock(monkeypatch, boom)
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 503 and r.json()["error"]["code"] == "model_unavailable"


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, json={}),
        httpx.Response(200, json={"token": ""}),
        httpx.Response(200, json=["x"]),
        httpx.Response(200, text="not json"),
    ],
)
def test_bad_body_503(client, auth, monkeypatch, response):
    _mock(monkeypatch, lambda req: response)
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 503 and r.json()["error"]["code"] == "model_unavailable"


def test_elevenlabs_429(client, auth, monkeypatch):
    _mock(monkeypatch, lambda req: httpx.Response(429, json={"detail": "busy"}))
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 429
    err = r.json()["error"]
    assert err["code"] == "quota_exhausted" and err["retryable"] is True


def test_missing_demo_key_401(client, monkeypatch):
    seen = _mock(monkeypatch, _ok)
    assert client.get("/tts-token").status_code == 401
    assert client.get("/tts-token", headers={"X-Demo-Key": "wrong"}).status_code == 401
    assert seen == []


def test_rate_limit_per_credential(client, auth, monkeypatch):
    seen = _mock(monkeypatch, _ok)
    for _ in range(tts.RATE_MAX):
        assert client.get("/tts-token", headers=auth).status_code == 200
    r = client.get("/tts-token", headers=auth)
    assert r.status_code == 429 and r.json()["error"]["code"] == "quota_exhausted"
    assert len(seen) == tts.RATE_MAX


ORIGIN = "https://echo.example"
BROWSER = {"X-Echo-Browser": "1", "Origin": ORIGIN}


@pytest.fixture
def browser(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import create_app

    monkeypatch.setenv("WEB_LOGIN_CODE", "test-browser-access")
    get_settings.cache_clear()
    with TestClient(create_app(), base_url=ORIGIN) as c:
        login = c.post("/app/auth/login", json={"code": "test-browser-access"}, headers=BROWSER)
        assert login.status_code == 200
        yield c


def test_cookie_session_gets_token(browser, monkeypatch):
    _mock(monkeypatch, _ok)
    r = browser.get("/tts-token", headers=BROWSER)
    assert r.status_code == 200 and r.json()["token"] == TOKEN


def test_junk_demo_key_with_cookie_cannot_escape_limit(browser, monkeypatch):
    seen = _mock(monkeypatch, _ok)
    for i in range(tts.RATE_MAX):
        r = browser.get("/tts-token", headers={**BROWSER, "X-Demo-Key": f"junk-{i}"})
        assert r.status_code == 200
    r = browser.get("/tts-token", headers={**BROWSER, "X-Demo-Key": "junk-last"})
    assert r.status_code == 429
    assert len(seen) == tts.RATE_MAX
    assert len(tts._recent) == 1


def test_credentials_have_separate_buckets(browser, auth, monkeypatch):
    _mock(monkeypatch, _ok)
    for _ in range(tts.RATE_MAX):
        assert browser.get("/tts-token", headers=BROWSER).status_code == 200
    assert browser.get("/tts-token", headers=BROWSER).status_code == 429
    # The real demo key is its own credential, unaffected by the browser session's window.
    assert browser.get("/tts-token", headers=auth).status_code == 200


def test_window_expires(client, auth, monkeypatch):
    _mock(monkeypatch, _ok)
    now = [1000.0]
    monkeypatch.setattr(tts, "_clock", lambda: now[0])
    for _ in range(tts.RATE_MAX):
        assert client.get("/tts-token", headers=auth).status_code == 200
    assert client.get("/tts-token", headers=auth).status_code == 429
    now[0] += tts.RATE_WINDOW_S
    assert client.get("/tts-token", headers=auth).status_code == 200


def test_extra_cookie_name_cannot_escape_limit(monkeypatch):
    """Over http the local cookie authorises; a junk __Host- cookie must not pick the bucket."""
    from fastapi.testclient import TestClient

    from app import browser_sessions
    from app.main import create_app

    monkeypatch.setenv("WEB_LOGIN_CODE", "test-browser-access")
    get_settings.cache_clear()
    seen = _mock(monkeypatch, _ok)
    origin = "http://localhost"
    headers = {"X-Echo-Browser": "1", "Origin": origin}
    with TestClient(create_app(), base_url=origin) as c:
        login = c.post("/app/auth/login", json={"code": "test-browser-access"}, headers=headers)
        assert login.status_code == 200
        assert c.cookies.get(browser_sessions.LOCAL_COOKIE)
        for i in range(tts.RATE_MAX + 1):
            c.cookies.set(browser_sessions.COOKIE, f"junk-{i}")
            r = c.get("/tts-token", headers=headers)
            assert r.status_code == (200 if i < tts.RATE_MAX else 429), (i, r.text)
    assert len(seen) == tts.RATE_MAX
    assert len(tts._recent) == 1
