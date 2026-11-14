from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import browser_sessions
from app.config import get_settings
from app.main import create_app

ORIGIN = "https://echo.example"
HEADERS = {"X-Echo-Browser": "1", "Origin": ORIGIN}
CODE = "test-browser-access"


@pytest.fixture
def browser(monkeypatch):
    monkeypatch.setenv("WEB_LOGIN_CODE", CODE)
    get_settings.cache_clear()
    with TestClient(create_app(), base_url=ORIGIN) as client:
        yield client


def test_code_becomes_cookie_not_api_key(browser):
    result = browser.post("/app/auth/login", json={"code": CODE}, headers=HEADERS)
    assert result.status_code == 200
    assert result.json()["authenticated"] is True
    assert set(result.json()) == {"authenticated", "expires_at"}
    cookie = result.headers["set-cookie"]
    for attribute in ("HttpOnly", "Secure", "SameSite=strict", "Path=/", "Max-Age="):
        assert attribute in cookie
    assert cookie.startswith("__Host-echo_session=")
    assert "Domain=" not in cookie
    assert CODE not in result.text and CODE not in cookie
    assert "test-key" not in result.text and "test-key" not in cookie
    recipes = browser.get("/recipes", headers={"X-Echo-Browser": "1"})
    assert recipes.status_code == 200
    assert recipes.headers["cache-control"] == "no-store, private"
    assert browser.get("/app/auth/session", headers=HEADERS).json()["authenticated"]


def test_cookie_cannot_bypass_csrf_checks(browser):
    assert browser.post("/app/auth/login", json={"code": CODE}, headers=HEADERS).status_code == 200
    for headers in (
        {},
        {"X-Echo-Browser": "1", "Origin": "https://evil.example"},
        {**HEADERS, "Sec-Fetch-Site": "cross-site"},
    ):
        assert browser.get("/recipes", headers=headers).status_code == 401
    assert browser.post("/sessions", json={}, headers={"X-Echo-Browser": "1"}).status_code == 401
    assert browser.post("/app/auth/logout", headers={"X-Echo-Browser": "1"}).status_code == 403
    assert browser.get("/recipes", headers=HEADERS).status_code == 200


def test_wrong_login_and_cross_origin_login_do_not_create_cookie(browser):
    for headers in ({}, {**HEADERS, "Origin": "https://evil.example"}):
        assert (
            browser.post("/app/auth/login", json={"code": CODE}, headers=headers).status_code == 403
        )
    result = browser.post("/app/auth/login", json={"code": "wrong"}, headers=HEADERS)
    assert result.status_code == 401
    assert "set-cookie" not in result.headers
    assert browser.get("/recipes", headers=HEADERS).status_code == 401


def test_expiry_logout_and_rotation_revoke_cookie(browser, monkeypatch):
    browser.post("/app/auth/login", json={"code": CODE}, headers=HEADERS)
    first = browser.cookies.get(browser_sessions.COOKIE)
    browser.post("/app/auth/login", json={"code": CODE}, headers=HEADERS)
    second = browser.cookies.get(browser_sessions.COOKIE)
    assert first != second
    browser.cookies.set(browser_sessions.COOKIE, first, domain="echo.example", path="/")
    assert browser.get("/recipes", headers=HEADERS).status_code == 401
    browser.cookies.set(browser_sessions.COOKIE, second, domain="echo.example", path="/")
    now = browser_sessions.time.time()
    with monkeypatch.context() as clock:
        clock.setattr(browser_sessions.time, "time", lambda: now + 14401)
        assert browser.get("/recipes", headers=HEADERS).status_code == 401
        assert not browser.get("/app/auth/session", headers=HEADERS).json()["authenticated"]


def test_logout_revokes_even_a_copied_cookie(browser):
    browser.post("/app/auth/login", json={"code": CODE}, headers=HEADERS)
    token = browser.cookies.get(browser_sessions.COOKIE)
    result = browser.post("/app/auth/logout", json={}, headers=HEADERS)
    assert result.status_code == 200
    browser.cookies.set(browser_sessions.COOKIE, token, domain="echo.example", path="/")
    assert browser.get("/recipes", headers=HEADERS).status_code == 401


def test_login_rate_limit_and_body_cap(browser):
    for _ in range(8):
        assert (
            browser.post("/app/auth/login", json={"code": "wrong"}, headers=HEADERS).status_code
            == 401
        )
    assert browser.post("/app/auth/login", json={"code": CODE}, headers=HEADERS).status_code == 429
    assert browser.post("/app/auth/login", content=b"x" * 4097, headers=HEADERS).status_code == 413


def test_disabled_login_fails_closed_and_old_api_key_still_works(client, auth):
    client.base_url = ORIGIN
    state = client.get("/app/auth/session", headers=HEADERS)
    assert state.status_code == 200 and state.json()["login_available"] is False
    assert client.post("/app/auth/login", json={"code": CODE}, headers=HEADERS).status_code == 503
    assert client.get("/recipes", headers=auth).status_code == 200
    assert client.get("/recipes").status_code == 401


def test_plain_http_is_only_allowed_on_loopback(monkeypatch):
    monkeypatch.setenv("WEB_LOGIN_CODE", CODE)
    get_settings.cache_clear()
    for origin, expected in (("http://localhost", 200), ("http://192.168.1.2", 403)):
        with TestClient(create_app(), base_url=origin) as client:
            result = client.post(
                "/app/auth/login", json={"code": CODE}, headers={**HEADERS, "Origin": origin}
            )
            assert result.status_code == expected
            if expected == 200:
                assert browser_sessions.LOCAL_COOKIE in result.headers["set-cookie"]
                assert "Secure" not in result.headers["set-cookie"]
