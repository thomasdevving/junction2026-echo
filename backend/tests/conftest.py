from __future__ import annotations

import os
import shutil
import subprocess
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Defaults for every test: memory store, fake AI, no delays. Set before app modules import.
os.environ.setdefault("ECHO_AI_FAKE", "1")
os.environ.setdefault("ECHO_AI_FAKE_DELAY", "0")

from app import ai, browser_sessions, faults, metrics  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.deps import reset_store  # noqa: E402

KEY = "test-key"

requires_ai = pytest.mark.skipif(
    not ai.available(), reason="echo_ai not installed (needs AI-01 on main)"
)


HAVE_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))
requires_ffmpeg = pytest.mark.skipif(
    not HAVE_FFMPEG, reason="ffmpeg/ffprobe not installed (needed from BE-06 on)"
)


def _ffmpeg(*args: str) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error", "-y", *args],
        check=True,
        capture_output=True,
        timeout=120,
    )


# --------------------------------------------------------------------------- real footage
# Every video test uses the team's real chef take (sandwich lesson, recorded through the glasses,
# 2:14, 720x1280 portrait, H.264 + AAC). It is NOT in git: the repository is public (README: no
# raw footage). Each laptop keeps a private copy at ai/footage/chef-take-sandwich.mp4
# (git-ignored), or points ECHO_REAL_TAKE at it. Without it, the video tests fail and say so.
REPO_ROOT = Path(__file__).resolve().parents[2]
REAL_TAKE = Path(
    os.environ.get("ECHO_REAL_TAKE") or REPO_ROOT / "ai" / "footage" / "chef-take-sandwich.mp4"
)


def _require_real_take() -> Path:
    if not HAVE_FFMPEG:
        pytest.skip("ffmpeg not installed")
    if not REAL_TAKE.is_file():
        pytest.fail(
            f"Real chef take missing: {REAL_TAKE}. Get the file privately from the team (it is "
            "not in git) and save it there, or set ECHO_REAL_TAKE to its path.",
            pytrace=False,
        )
    return REAL_TAKE


def _ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return float(out.strip())


@pytest.fixture(scope="session")
def take_mp4() -> Path:
    """The real chef take: about 134 s, 720x1280 portrait, with audio."""
    return _require_real_take()


@pytest.fixture(scope="session")
def take_duration_s(take_mp4) -> float:
    return _ffprobe_duration(take_mp4)


@pytest.fixture(scope="session")
def take_rotated_mp4(take_mp4, tmp_path_factory) -> Path:
    """The real take with a 90 degree display-matrix rotation added (stream copy)."""
    out = tmp_path_factory.mktemp("media") / "rotated.mp4"
    try:
        _ffmpeg("-display_rotation", "90", "-i", str(take_mp4), "-c", "copy", str(out))
    except subprocess.CalledProcessError:
        pytest.skip("this ffmpeg does not support -display_rotation")
    return out


@pytest.fixture(scope="session")
def take_small_mp4(take_mp4, tmp_path_factory) -> Path:
    """The real take's first 8 s, scaled down to 240x426: smaller than any output size, so
    tests can check that nothing is upscaled."""
    out = tmp_path_factory.mktemp("media") / "small.mp4"
    _ffmpeg(
        "-i", str(take_mp4), "-t", "8", "-vf", "scale=240:426", "-an",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(out),
    )  # fmt: skip
    return out


@pytest.fixture(scope="session")
def take_bytes(take_mp4) -> bytes:
    return take_mp4.read_bytes()


@pytest.fixture(autouse=True)
def _env(tmp_path, monkeypatch) -> Iterator[None]:
    monkeypatch.setenv("DEMO_API_KEY", KEY)
    monkeypatch.setenv("STORAGE", "memory")
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("WEB_DIR", str(tmp_path / "no-web"))
    monkeypatch.setenv("PUBLIC_BASE_URL", "")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    get_settings.cache_clear()
    reset_store()
    metrics.reset()
    faults.reset()
    browser_sessions.reset()
    monkeypatch.delenv("WEB_LOGIN_CODE", raising=False)
    monkeypatch.delenv("FAULT_INJECT", raising=False)
    monkeypatch.delenv("FAULT_INJECT_ENABLED", raising=False)
    if ai.available():
        from echo_ai import fake

        fake.reset()
    yield
    get_settings.cache_clear()
    reset_store()


@pytest.fixture
def app():
    from app.main import create_app

    return create_app()


@pytest.fixture
def client(app) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


@pytest.fixture
def auth() -> dict[str, str]:
    return {"X-Demo-Key": KEY}
