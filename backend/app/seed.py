"""Startup seed for memory mode: the fixture recipe from echo_ai (API-CONTRACT §8)."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from app import ai, refcache
from app.store.base import Recipe, RecipeStatus, Step, Store, utcnow

log = logging.getLogger("echo.seed")

SEED_RECIPE_ID = "00000000-0000-4000-8000-000000000001"


def seed_step_id(recipe_id: str, idx: int) -> str:
    return str(uuid.uuid5(uuid.UUID(recipe_id), f"step-{idx}"))


def ref_image_path(recipe_id: str, idx: int) -> str:
    """Path inside the "media" bucket (API-CONTRACT §6)."""
    return f"{recipe_id}/steps/{idx}/ref.jpg"


def clip_path(recipe_id: str, idx: int) -> str:
    """Path inside the "media" bucket (API-CONTRACT §6)."""
    return f"{recipe_id}/steps/{idx}/clip.mp4"


def step_from_spec(recipe_id: str, spec: dict[str, Any], step_id: str | None = None) -> Step:
    """Build a Step record from a StepSpec dump (model_dump(mode="json"))."""
    kwargs: dict[str, Any] = {
        "recipe_id": recipe_id,
        "idx": spec["idx"],
        "title": spec["title"],
        "key_line": spec["key_line"],
        "instruction": spec["instruction"],
        "timestamp_s": float(spec["timestamp_s"]),
        "chef_quote": spec.get("chef_quote"),
        "clip_start_s": spec.get("clip_start_s"),
        "clip_end_s": spec.get("clip_end_s"),
        "success_criteria": list(spec.get("success_criteria") or []),
        "watch_fors": [dict(w) for w in spec.get("watch_fors") or []],
        "timer_s": spec.get("timer_s"),
    }
    if step_id:
        kwargs["id"] = step_id
    return Step(**kwargs)


def default_take(fixture_dir: Path) -> Path | None:
    """The chef take the fixture was made from.

    $ECHO_REAL_TAKE, else <ai>/footage/chef-take-sandwich.mp4; None when neither exists."""
    env = os.environ.get("ECHO_REAL_TAKE")
    path = Path(env) if env else fixture_dir.parent / "footage" / "chef-take-sandwich.mp4"
    return path if path.is_file() else None


async def _put_clip(store: Store, recipe_id: str, step: Step, video: Path, workdir: Path) -> None:
    """Cut the step's clip window from the take and upload it; a failure leaves clip_path None."""
    from app.media.ffmpeg import FfmpegError, extract_clip

    if step.clip_start_s is None or step.clip_end_s is None:
        return
    out = workdir / f"clip-{step.idx}.mp4"
    try:
        await extract_clip(video, step.clip_start_s, step.clip_end_s, out)
        path = clip_path(recipe_id, step.idx)
        await store.put_blob("media", path, out.read_bytes(), "video/mp4")
        step.clip_path = path
    except (FfmpegError, OSError) as exc:
        log.warning("seed clip for step %d failed: %s", step.idx, exc)


def load_draft(fixture_dir: Path) -> Any:
    """sushi_recipe.json validated as echo_ai.schemas.RecipeDraft."""
    g = ai.get()
    return g.RecipeDraft.model_validate(
        json.loads((fixture_dir / "sushi_recipe.json").read_text(encoding="utf-8"))
    )


async def write_fixture_recipe(
    store: Store,
    draft: Any,
    fixture_dir: Path,
    status: RecipeStatus,
    video: Path | None = None,
) -> tuple[Recipe, list[Step]]:
    """Creates the fixture recipe with the fixed ids, uploads the step stills, inserts steps.
    With video (the chef take), each step's clip window is cut from it and uploaded too."""
    recipe = await store.create_recipe(
        Recipe(
            id=SEED_RECIPE_ID,
            title=draft.title,
            status="processing",  # final status only once steps and images are in place
            chef_name=None,
            transcript=draft.transcript,
            created_at=utcnow(),
        )
    )
    steps: list[Step] = []
    workdir = tempfile.TemporaryDirectory(prefix="echo-seed-") if video else None
    for spec in draft.steps:
        step = step_from_spec(
            recipe.id, spec.model_dump(mode="json"), seed_step_id(recipe.id, spec.idx)
        )
        image = fixture_dir / "images" / f"step-{spec.idx}.jpg"
        if image.is_file():
            path = ref_image_path(recipe.id, spec.idx)
            await store.put_blob("media", path, image.read_bytes(), "image/jpeg")
            step.ref_image_path = path
        if video and workdir:
            await _put_clip(store, recipe.id, step, video, Path(workdir.name))
        steps.append(step)
    if workdir:
        workdir.cleanup()
    stored = await store.replace_steps(recipe.id, steps)
    refcache.invalidate_recipe(recipe.id)
    recipe = await store.update_recipe(recipe.id, status=status) or recipe
    return recipe, stored


async def seed_fixture(store: Store) -> Recipe | None:
    """Memory-mode startup seed. Supabase mode is seeded only by scripts/seed.py."""
    if not ai.available():
        log.warning("echo_ai not installed: skipping the fixture seed")
        return None
    from echo_ai import config as ai_config

    existing = await store.get_recipe(SEED_RECIPE_ID)
    if existing is not None:
        return existing
    fixture_dir = ai_config.fixture_dir()
    recipe, steps = await write_fixture_recipe(
        store, load_draft(fixture_dir), fixture_dir, "published"
    )
    log.info("seeded fixture recipe %s with %d steps", recipe.id, len(steps))
    return recipe
