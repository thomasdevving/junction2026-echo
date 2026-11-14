#!/usr/bin/env python3
"""Seed the demo recipe into whichever store STORAGE selects (BE-02.4).

    python scripts/seed.py [--fixture ../ai/fixtures] [--publish] [--replace]
                           [--video PATH | --no-clips]

Uses the same fixed recipe id and step ids as the memory-mode startup seed. Without --replace an
existing recipe with that id stops the script (no accidental duplicates). Supabase mode is seeded
only by this script. Never prints the service key.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings  # noqa: E402
from app.deps import get_store  # noqa: E402
from app.errors import ApiError  # noqa: E402
from app.seed import SEED_RECIPE_ID, default_take, write_fixture_recipe  # noqa: E402
from app.store.ops import purge_recipe  # noqa: E402


def default_fixture_dir() -> Path:
    try:
        from echo_ai import config as ai_config

        return ai_config.fixture_dir()
    except ImportError:
        return BACKEND_DIR.parent / "ai" / "fixtures"


async def run(fixture_dir: Path, publish: bool, replace: bool, video: Path | None = None) -> int:
    try:
        from echo_ai.schemas import RecipeDraft
    except ImportError:
        print("echo_ai is not installed: pip install -e ../ai", file=sys.stderr)
        return 2

    recipe_file = fixture_dir / "sushi_recipe.json"
    if not recipe_file.is_file():
        print(f"fixture not found: {recipe_file}", file=sys.stderr)
        return 2
    draft = RecipeDraft.model_validate(json.loads(recipe_file.read_text(encoding="utf-8")))

    settings = get_settings()
    store = get_store()
    print(f"storage: {settings.storage}")
    if settings.storage == "memory":
        print("note: memory-mode rows live only in this process; the server seeds itself")

    if await store.get_recipe(SEED_RECIPE_ID) is not None:
        if not replace:
            print(
                f"recipe {SEED_RECIPE_ID} already exists; pass --replace to recreate it",
                file=sys.stderr,
            )
            return 1
        await purge_recipe(store, SEED_RECIPE_ID)
        print(f"deleted existing recipe {SEED_RECIPE_ID} (rows, media, sessions, frames)")

    status = "published" if publish else "review"
    print(f"clips from: {video}" if video else "clips: none (no chef take given or found)")
    recipe, steps = await write_fixture_recipe(store, draft, fixture_dir, status, video)
    print(f"recipe_id: {recipe.id}  status: {recipe.status}  title: {recipe.title}")
    for s in steps:
        image = "ref.jpg" if s.ref_image_path else "no image"
        clip = "clip.mp4" if s.clip_path else "no clip"
        print(f"  step {s.idx}: {s.id}  {image}  {clip}  {s.title}")
    missing = [s.idx for s in steps if not s.ref_image_path]
    if missing:
        print(f"warning: steps without a reference image: {missing}", file=sys.stderr)
    no_clip = [s.idx for s in steps if video and s.clip_start_s is not None and not s.clip_path]
    if no_clip:
        print(f"error: steps whose clip failed: {no_clip}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--fixture", type=Path, default=None, help="folder with sushi_recipe.json")
    ap.add_argument("--publish", action="store_true", help="status published (default review)")
    ap.add_argument("--replace", action="store_true", help="delete an existing recipe first")
    clips = ap.add_mutually_exclusive_group()
    clips.add_argument(
        "--video",
        type=Path,
        default=None,
        help="chef take to cut step clips from (default: $ECHO_REAL_TAKE or "
        "ai/footage/chef-take-sandwich.mp4)",
    )
    clips.add_argument("--no-clips", action="store_true", help="upload stills only")
    args = ap.parse_args()
    fixture_dir = (args.fixture or default_fixture_dir()).resolve()
    try:
        video = None if args.no_clips else (args.video or default_take(fixture_dir))
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    if video is not None and not video.is_file():
        print(f"video not found: {video}", file=sys.stderr)
        return 2
    try:
        return asyncio.run(run(fixture_dir, args.publish, args.replace, video))
    except ApiError as exc:
        print(f"failed: {exc.code}: {exc.message} (see log above)", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
