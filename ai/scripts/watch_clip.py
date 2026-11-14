"""AI-07.2: replay the proactive watcher on one clip, on the phone's clock.

Usage (from ai/, real mode, ai/.env with a key; ffmpeg on PATH):

    # a mistake clip: the mistake becomes visible at 6 s and is fixed at 18 s
    python scripts/watch_clip.py footage/V14.mp4 --step 4 --expect filling_piled_center \
        --mistake-at 6 --fixed-at 18 --where "owner laptop, venue Wi-Fi"
    # a correct clip: any alert is a false alert
    python scripts/watch_clip.py footage/V03.mp4 --step 4 --expect none

Timing follows API-CONTRACT §3.3: the next frame is taken --every seconds after the previous
response arrived (not every 2.5 s of video), and a response counts when it arrives (capture time
+ measured latency). So detection delay = mistake visible -> alert shown, as EVALUATION.md §4
defines it. Each frame goes through watch_frame once; the client debounce (2 in a row, same id,
confidence >= threshold, the 12 s warning screen with the watcher paused, then a 20 s mute) is
replayed for every --thresholds value, so a threshold sweep costs no extra model calls.
Approximation: frames are taken on the unpaused schedule, and the replay drops those that fall
inside a warning screen (see ghostchef_ai.eval.debounce_alerts).

Writes <UTC>-clip-<name>.json and .md to eval/results/.
"""

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import json
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

AI_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_DIR / "src"))

import ghostchef_ai as gc  # noqa: E402
from ghostchef_ai import config  # noqa: E402
from ghostchef_ai.config import is_fake, model_ids  # noqa: E402
from ghostchef_ai.errors import AIError  # noqa: E402
from ghostchef_ai.eval import debounce_alerts, load_recipe, provenance  # noqa: E402


def _extract_frames_module():
    spec = importlib.util.spec_from_file_location("extract_frames",
                                                  AI_DIR / "scripts" / "extract_frames.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def score(alerts: list[tuple[float, str]], expect: str, mistake_at: float | None,
          fixed_at: float | None, duration_s: float, grace_s: float = 2.5) -> dict:
    """Detection delay, false alerts, alerts after the fix, for one threshold.

    Alert times are arrival times, so an alert counts as a hit up to grace_s after the fix (its
    frame may have been taken just before the fix).
    """
    minutes = max(duration_s, 1e-9) / 60
    if expect == "none":
        return {"alerts": len(alerts), "false_alerts": len(alerts),
                "false_alerts_per_min": round(len(alerts) / minutes, 2)}
    start = mistake_at or 0.0
    end = fixed_at if fixed_at is not None else float("inf")
    hits = [t for t, mid in alerts if mid == expect and start <= t <= end + grace_s]
    false = [t for t, mid in alerts if not (mid == expect and start <= t <= end + grace_s)]
    after_fix = [t for t, _ in alerts if fixed_at is not None and t > fixed_at + grace_s]
    return {"alerts": len(alerts), "detected": bool(hits),
            "detection_delay_s": round(hits[0] - start, 1) if hits else None,
            "false_alerts": len(false), "alerts_after_fix": len(after_fix)}


def warn_frames_after_fix(results: list[dict], expect: str, fixed_at: float | None,
                          threshold: float) -> int | None:
    """Raw warns (before debounce and mute) on frames taken after the fix.

    The mute can hide a model that keeps warning after the fix; this count cannot.
    """
    if fixed_at is None or expect == "none":
        return None
    return sum(1 for r in results if r["t"] > fixed_at and r["status"] == "warn"
               and r["mistake_id"] == expect and r["confidence"] >= threshold)


async def run(clip: Path, step, duration: float, *, every: float, long_edge: int,
              timeout_s: float, ef, ffmpeg: str, workdir: Path) -> list[dict]:
    """Take frames on the phone's clock and call watch_frame on each, one at a time.

    t = capture time in the clip, arrival = t + latency; the next capture is arrival + every.
    """
    out: list[dict] = []
    t = 0.0
    while t < duration - 0.05:
        frame = workdir / ef.frame_name("f", t)
        ef.subprocess.run(ef.ffmpeg_cmd(ffmpeg, clip, t, frame, long_edge, 5),
                          capture_output=True, check=False)
        if not frame.exists():
            out.append({"t": round(t, 2), "arrival": round(t, 2), "latency_ms": 0,
                        "status": "error", "mistake_id": None, "confidence": 0.0, "model": "",
                        "error": "ffmpeg produced no frame"})
            t += every
            continue
        t0 = time.perf_counter()
        try:
            r = await gc.watch_frame(frame.read_bytes(), step, timeout_s=timeout_s)
            row = {"status": r.status, "mistake_id": r.mistake_id, "confidence": r.confidence,
                   "model": r.model, "error": ""}
        except AIError as exc:  # §3.3: an error is silent; the next tick is the retry
            row = {"status": "error", "mistake_id": None, "confidence": 0.0, "model": "",
                   "error": f"{type(exc).__name__}: {exc}"[:200]}
        latency = time.perf_counter() - t0
        arrival = t + latency
        out.append({"t": round(t, 2), "arrival": round(arrival, 2),
                    "latency_ms": round(latency * 1000), **row})
        t = arrival + every
    return out


def markdown(meta: dict, results: list[dict], sweep: dict) -> str:
    fake = " — **FAKE MODE, not an evaluation result**" if meta["fake"] else ""
    first = next(iter(sweep.values()))
    dirty = meta.get("uncommitted")
    tree = ("tree state unknown" if dirty is None else "clean tree" if not dirty
            else f"**{len(dirty)} uncommitted change(s)**")
    lines = [f"# Watcher replay: {meta['clip']}{fake}", "",
             f"- Step {meta['step']}, expect `{meta['expect']}`, mistake at "
             f"{meta['mistake_at']} s, fixed at {meta['fixed_at']} s",
             f"- {len(results)} frames over {meta['duration_s']:.1f} s, next frame "
             f"{meta['every']} s after each answer, long edge {meta['long_edge']} px, "
             f"timeout {meta['timeout_s']} s",
             f"- Model `{meta['model']}`; {meta['when']}; commit `{meta['commit']}` ({tree}); "
             f"prompts {meta['prompt_hashes']}; fixture `{meta['fixture_sha256']}`; "
             f"run from: {meta['where']}", "",
             "| threshold | " + " | ".join(first.keys()) + " |",
             "|---|" + "---|" * len(first)]
    for th, s in sweep.items():
        lines.append(f"| {th} | " + " | ".join(str(v) for v in s.values()) + " |")
    lines += ["", "| capture (s) | arrives (s) | status | id | conf | ms | error |",
              "|---|---|---|---|---|---|---|"]
    lines += [f"| {r['t']} | {r['arrival']} | {r['status']} | {r['mistake_id'] or ''} | "
              f"{r['confidence']} | {r['latency_ms']} | {r['error'][:60]} |" for r in results]
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    config.load_env()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("clip", type=Path)
    p.add_argument("--step", type=int, default=4)
    p.add_argument("--expect", required=True, help="the clip's mistake_id, or 'none'")
    p.add_argument("--mistake-at", type=float, help="second the mistake becomes visible")
    p.add_argument("--fixed-at", type=float, help="second the mistake is fixed (fix clips)")
    p.add_argument("--every", type=float, default=2.5,
                   help="seconds from one answer to the next frame (§3.3)")
    p.add_argument("--long-edge", type=int, default=512)
    p.add_argument("--thresholds", type=float, nargs="+", default=[0.5, 0.6, 0.7, 0.8, 0.9])
    p.add_argument("--timeout", type=float, default=3.5)
    p.add_argument("--where", default="", help="where it ran from (recorded)")
    p.add_argument("--out", type=Path, default=AI_DIR / "eval" / "results")
    args = p.parse_args(argv)
    if not args.clip.is_file():
        print(f"no such clip: {args.clip}", file=sys.stderr)
        return 1
    ef = _extract_frames_module()
    ffmpeg, ffprobe = ef.find_tools()
    duration = ef.probe_duration(ffprobe, args.clip)
    step = load_recipe().step(args.step)
    with tempfile.TemporaryDirectory() as d:
        results = asyncio.run(run(args.clip, step, duration, every=args.every,
                                  long_edge=args.long_edge, timeout_s=args.timeout, ef=ef,
                                  ffmpeg=ffmpeg, workdir=Path(d)))
    triples = [(r["arrival"], r["status"], r["mistake_id"], r["confidence"]) for r in results]
    sweep = {}
    for th in args.thresholds:
        s = score(debounce_alerts(triples, th), args.expect, args.mistake_at, args.fixed_at,
                  duration, grace_s=args.every)
        after = warn_frames_after_fix(results, args.expect, args.fixed_at, th)
        if after is not None:
            s["warn_frames_after_fix"] = after
        sweep[th] = s
    when = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    meta = {"when": when, "clip": args.clip.name, "step": args.step, "expect": args.expect,
            "mistake_at": args.mistake_at, "fixed_at": args.fixed_at, "every": args.every,
            "long_edge": args.long_edge, "timeout_s": args.timeout, "duration_s": duration,
            "fake": is_fake(), "model": model_ids()["watch"], **provenance(args.where)}
    args.out.mkdir(parents=True, exist_ok=True)
    stem = f"{when}-clip-{args.clip.stem}" + ("-FAKE" if meta["fake"] else "")
    (args.out / f"{stem}.json").write_text(json.dumps(
        {"meta": meta, "frames": results, "sweep": {str(k): v for k, v in sweep.items()}},
        indent=2) + "\n", encoding="utf-8")
    md = markdown(meta, results, sweep)
    (args.out / f"{stem}.md").write_text(md, encoding="utf-8")
    print(md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
