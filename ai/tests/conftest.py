import json
import os
from pathlib import Path

import pytest

from echo_ai import config, fake
from echo_ai.schemas import RecipeDraft

AI_DIR = Path(__file__).resolve().parents[1]
FIXTURE = AI_DIR / "fixtures" / "sushi_recipe.json"

# The team's real chef take (sandwich lesson through the glasses, 2:14, 720x1280, with audio).
# Not in git: the repository is public (README: no raw footage). Each laptop keeps a private copy
# at ai/footage/chef-take-sandwich.mp4 (git-ignored), or points ECHO_REAL_TAKE at it.
REAL_TAKE = Path(os.environ.get("ECHO_REAL_TAKE") or AI_DIR / "footage" / "chef-take-sandwich.mp4")


@pytest.fixture(scope="session")
def real_take() -> Path:
    if not REAL_TAKE.is_file():
        pytest.fail(
            f"Real chef take missing: {REAL_TAKE}. Get the file privately from the team (it is "
            "not in git) and save it there, or set ECHO_REAL_TAKE to its path.",
            pytrace=False,
        )
    return REAL_TAKE


@pytest.fixture(autouse=True)
def _fake_env(monkeypatch):
    monkeypatch.setenv("ECHO_AI_FAKE", "1")
    monkeypatch.setenv("ECHO_AI_FAKE_DELAY", "0")
    for k in ("ECHO_MODEL_VIDEO", "ECHO_MODEL_CHECK", "ECHO_MODEL_WATCH",
              "ECHO_MODEL_LIVE", "ECHO_FIXTURE_DIR",
              # ai/.env may hold a real key: unit tests must never reach a paid API.
              "GEMINI_API_KEY", "OPENAI_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    # Entry points (CLI main, eval.main, the scripts' main) call config.load_env(), which would
    # load the real key from ai/.env into this process. Tests never read ai/.env.
    monkeypatch.setattr(config, "load_dotenv", lambda *a, **k: False)
    fake.reset()
    yield
    fake.reset()


@pytest.fixture
def recipe() -> RecipeDraft:
    return RecipeDraft.model_validate(json.loads(FIXTURE.read_text(encoding="utf-8")))


@pytest.fixture
def big_frame() -> bytes:
    return (AI_DIR / "fixtures" / "images" / "step-3.jpg").read_bytes()
