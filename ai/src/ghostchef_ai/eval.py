"""AI-07 evaluation runner: python -m ghostchef_ai.eval (ai/tasks/07, docs/EVALUATION.md §4).

Runs check_frame or watch_frame over the labelled rows of eval/cases.csv and writes one JSON
file (every case) and one Markdown summary (the EVALUATION.md metrics) per run to eval/results/.

    python -m ghostchef_ai.eval --split dev --config full                 # tuning
    python -m ghostchef_ai.eval --split dev --mode watch --threshold 0.7
    python -m ghostchef_ai.eval --split heldout --config full --confirm-heldout   # once, frozen

Configs (the ablation): full = reference photo + criteria + mistakes (what ships);
no-ref = criteria + mistakes, no reference photo; generic = a plain "is this step done
correctly?" prompt with no criteria and no reference. Watch mode always uses the shipped prompt.

Rules: tune on dev only; the held-out split needs --confirm-heldout and is run once, after the
prompts are frozen. Every result file records the date, model, prompt hashes, git commit and set
size. Works in fake mode (GHOSTCHEF_AI_FAKE=1), which is how the runner itself is tested; fake
results are labelled as such and are never evaluation results.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import hashlib
import json
import statistics
import subprocess
import sys
import time
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import ghostchef_ai as gc
from ghostchef_ai import check, client, prompts, watch
from ghostchef_ai.config import AI_DIR, fixture_dir, is_fake, load_env, model_ids
from ghostchef_ai.errors import AIError, AIInvalidOutput
from ghostchef_ai.schemas import CheckResult, RecipeDraft, StepSpec

CONFIGS = ("full", "no-ref", "generic")
MODES = ("check", "watch")
DEFAULT_THRESHOLD = 0.7  # API-CONTRACT §3.3 default until AI-07.3 tunes it
# Frame sizes the product sends (API-CONTRACT §3.1 / §3.2, ai/STATUS.md "Tuned values").
CHECK_LONG_EDGE = 1280
WATCH_LONG_EDGE = 512
# §3.3 client rules replayed by debounce_alerts.
WARNING_SCREEN_S = 12.0  # an unanswered warning dismisses itself after 12 s; watcher paused
MUTE_S = 20.0            # the dismissed mistake_id stays muted for 20 s after dismissal
# make_placeholders.py records the sha256 of every placeholder still it writes, so a run can
# tell a text card from a real chef still.
PLACEHOLDER_MANIFEST = "placeholders.json"


@dataclass
class Case:
    case_id: str
    file: Path
    step_idx: int
    split: str
    label: str
    mistake_id: str = ""


@dataclass
class Row:
    case_id: str
    file: str
    step_idx: int
    label: str
    mistake_id: str
    prediction: str = ""          # check: pass/fix/unsure; watch: ok/warn
    predicted_mistake: str = ""
    confidence: float | None = None
    latency_ms: int | None = None
    model: str = ""
    error: str = ""
    extra: dict[str, Any] = field(default_factory=dict)


# --------------------------------------------------------------------------- loading


def load_cases(csv_path: Path, split: str) -> list[Case]:
    """Labelled rows of one split. Unlabelled rows are skipped (check_cases.py validates)."""
    eval_dir = csv_path.parent
    out: list[Case] = []
    # utf-8-sig: a spreadsheet's "CSV UTF-8" export starts with a BOM, which would otherwise
    # become part of the first column name.
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if (r.get("split") or "").strip() != split or not (r.get("label") or "").strip():
                continue
            out.append(Case(case_id=r["case_id"].strip(),
                            file=eval_dir / r["file"].strip().replace("\\", "/"),
                            step_idx=int(r["step_idx"]), split=split,
                            label=r["label"].strip(),
                            mistake_id=(r.get("mistake_id") or "").strip()))
    return out


def load_recipe(path: Path | None = None) -> RecipeDraft:
    p = path or fixture_dir() / "sushi_recipe.json"
    return RecipeDraft.model_validate(json.loads(p.read_text(encoding="utf-8")))


def reference_image(step_idx: int, images_dir: Path | None = None) -> bytes | None:
    p = (images_dir or fixture_dir() / "images") / f"step-{step_idx}.jpg"
    return p.read_bytes() if p.is_file() else None


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def placeholder_steps(step_idxs: set[int], images_dir: Path | None = None) -> list[int]:
    """Steps whose reference image is missing or still a placeholder card (AI-03.5)."""
    images_dir = images_dir or fixture_dir() / "images"
    try:
        manifest = json.loads((images_dir / PLACEHOLDER_MANIFEST).read_text(encoding="utf-8"))
        known = set(manifest.values())
    except (OSError, ValueError, AttributeError):
        known = set()
    out = []
    for idx in sorted(step_idxs):
        ref = reference_image(idx, images_dir)
        if ref is None or _sha256(ref) in known:
            out.append(idx)
    return out


def fit_long_edge(jpeg: bytes, long_edge: int) -> bytes:
    """Shrink a JPEG so its long edge is at most long_edge, as the clients do before upload.

    Unchanged when it already fits. Needs Pillow (the dev extra): this runner is a dev tool;
    the package's public functions never resize.
    """
    import io

    from PIL import Image, ImageOps, UnidentifiedImageError

    try:
        im = Image.open(io.BytesIO(jpeg))
    except UnidentifiedImageError:
        return jpeg  # not decodable here: send as is and let the model call report it
    with im:
        if max(im.size) <= long_edge:
            return jpeg
        im = ImageOps.exif_transpose(im).convert("RGB")
        scale = long_edge / max(im.size)
        im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))),
                       Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=80)
        return buf.getvalue()


# --------------------------------------------------------------------------- one case


def generic_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "verdict": {"type": "string", "enum": ["pass", "fix", "unsure"]},
            "headline": {"type": "string"},
            "fix": {"type": "string"},
            "spoken": {"type": "string"},
            "confidence": {"type": "number"},
        },
        "required": ["verdict", "headline", "fix", "spoken", "confidence"],
        "additionalProperties": False,
    }


async def generic_check(frame: bytes, step: StepSpec, timeout_s: float) -> CheckResult:
    """The ablation's plain prompt: no criteria, no mistakes, no reference photo."""
    if is_fake():
        return await gc.check_frame(frame, step, None, timeout_s=timeout_s)
    model = model_ids()["check"]
    res = await client.image_json(
        model=model, prompt=prompts.render("generic_check", STEP_TITLE=step.title),
        images=[(check.LEARNER_LABEL, frame)], schema=generic_schema(),
        schema_name="generic_check", timeout_s=timeout_s,
        max_output_tokens=check.MAX_OUTPUT_TOKENS, low_detail=check.LOW_DETAIL)
    try:
        raw = check.RawCheck.model_validate({**res.data, "mistake_id": None})
    except Exception as exc:  # noqa: BLE001
        raise AIInvalidOutput(f"generic check output did not match: {exc}"[:300]) from exc
    return check.postprocess(raw, step, res.model, has_ref=False)


async def run_case(case: Case, recipe: RecipeDraft, mode: str, config: str,
                   timeout_s: float, long_edge: int | None = None) -> Row:
    row = Row(case.case_id, case.file.as_posix(), case.step_idx, case.label, case.mistake_id)
    try:
        step = recipe.step(case.step_idx)
        frame = case.file.read_bytes()
        if long_edge:
            frame = fit_long_edge(frame, long_edge)
    except (KeyError, OSError, ValueError, ImportError) as exc:
        row.error = f"setup: {type(exc).__name__}: {exc}"[:300]
        return row
    t0 = time.perf_counter()
    try:
        if mode == "watch":
            w = await gc.watch_frame(frame, step, timeout_s=timeout_s)
            row.prediction, row.predicted_mistake = w.status, w.mistake_id or ""
            row.confidence, row.model = w.confidence, w.model
        else:
            if config == "generic":
                c = await generic_check(frame, step, timeout_s)
            else:
                ref = reference_image(step.idx) if config == "full" else None
                c = await gc.check_frame(frame, step, ref, timeout_s=timeout_s)
            row.prediction, row.predicted_mistake = c.verdict, c.mistake_id or ""
            row.confidence, row.model = c.confidence, c.model
    except AIError as exc:
        row.error = f"{type(exc).__name__}: {exc}"[:300]
    row.latency_ms = round((time.perf_counter() - t0) * 1000)
    return row


# --------------------------------------------------------------------------- metrics


def _p50_max(values: list[int]) -> tuple[int | None, int | None]:
    return (round(statistics.median(values)), max(values)) if values else (None, None)


def check_metrics(rows: list[Row]) -> dict[str, Any]:
    """EVALUATION.md §4 counts. Denominators are every labelled case of that kind, errors
    included, so a timed-out mistake frame never silently leaves "x of N" (errors_by_label
    says how many of N had no answer)."""
    ok = [r for r in rows if not r.error]
    confusion = Counter((r.label, r.prediction) for r in ok)
    by_label = Counter(r.label for r in rows)
    p50, mx = _p50_max([r.latency_ms for r in ok if r.latency_ms is not None])
    return {
        "n": len(rows), "errors": len(rows) - len(ok),
        "errors_by_label": dict(Counter(r.label for r in rows if r.error)),
        "confusion": {f"{lab}->{pred}": n for (lab, pred), n in sorted(confusion.items())},
        "false_approvals": confusion[("fix", "pass")], "n_fix": by_label["fix"],
        "false_rejections": confusion[("pass", "fix")], "n_pass": by_label["pass"],
        "appropriate_unsure": confusion[("unsure", "unsure")], "n_unsure": by_label["unsure"],
        "wrong_unsure": confusion[("pass", "unsure")] + confusion[("fix", "unsure")],
        "n_pass_or_fix": by_label["pass"] + by_label["fix"],
        "right_mistake_id": sum(1 for r in ok if r.label == "fix" and r.prediction == "fix"
                                and r.mistake_id and r.predicted_mistake == r.mistake_id),
        "n_fix_with_id": sum(1 for r in rows if r.label == "fix" and r.mistake_id),
        "latency_p50_ms": p50, "latency_max_ms": mx,
    }


def watch_metrics(rows: list[Row], threshold: float) -> dict[str, Any]:
    ok = [r for r in rows if not r.error]

    def warns(r: Row) -> bool:
        return r.prediction == "warn" and (r.confidence or 0) >= threshold

    fixes = [r for r in ok if r.label == "fix"]
    others = [r for r in ok if r.label in ("pass", "unsure")]
    p50, mx = _p50_max([r.latency_ms for r in ok if r.latency_ms is not None])
    return {
        "n": len(rows), "errors": len(rows) - len(ok), "threshold": threshold,
        "errors_by_label": dict(Counter(r.label for r in rows if r.error)),
        # Detected = a warn the client would act on: the right id and confidence >= threshold.
        "detected": sum(1 for r in fixes if warns(r)
                        and (not r.mistake_id or r.predicted_mistake == r.mistake_id)),
        "n_fix": sum(1 for r in rows if r.label == "fix"),
        "false_warnings": sum(1 for r in others if warns(r)),
        "n_not_fix": sum(1 for r in rows if r.label in ("pass", "unsure")),
        "single_frame_note": "per frame, before the client's 2-in-a-row debounce",
        "latency_p50_ms": p50, "latency_max_ms": mx,
    }


# --------------------------------------------------------------------------- watcher debounce


def debounce_alerts(results: list[tuple[float, str, str | None, float]], threshold: float, *,
                    required: int = 2, screen_s: float = WARNING_SCREEN_S,
                    mute_s: float = MUTE_S) -> list[tuple[float, str]]:
    """Replay API-CONTRACT §3.3 on (time_s, status, mistake_id, confidence) watch results.

    time_s is when the response reaches the client (capture + latency). An alert fires on the
    `required`-th consecutive warn with the same mistake id and confidence >= threshold. The
    warning screen then shows for screen_s with the watcher paused (results arriving meanwhile
    are dropped, as if never taken); with no input it dismisses itself, and the id stays muted
    for mute_s after that. Warns of a muted id still extend the streak, so a mistake that is
    still visible alerts again as soon as the mute ends.
    Returns [(time_s, mistake_id)] of raised alerts.

    Approximation: frames are taken on the unpaused schedule and those inside the pause are
    dropped, so the first frame after a pause can be up to one interval off the phone's.
    """
    alerts: list[tuple[float, str]] = []
    muted_until: dict[str, float] = {}
    paused_until = float("-inf")
    streak_id, streak = None, 0
    for t, status, mid, conf in results:
        if t < paused_until:
            continue
        if status != "warn" or not mid or conf < threshold:
            streak_id, streak = None, 0
            continue
        streak = streak + 1 if mid == streak_id else 1
        streak_id = mid
        if streak >= required and t >= muted_until.get(mid, float("-inf")):
            alerts.append((t, mid))
            paused_until = t + screen_s
            muted_until[mid] = paused_until + mute_s
            streak_id, streak = None, 0
    return alerts


# --------------------------------------------------------------------------- run metadata


def _git_commit() -> str:
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=AI_DIR,
                              capture_output=True, text=True, timeout=5).stdout.strip() or "?"
    except (OSError, subprocess.SubprocessError):
        return "?"


def prompt_hashes() -> dict[str, str]:
    names = ("check", "watch", "generic_check")
    return {n: hashlib.sha256(prompts.template(n).encode()).hexdigest()[:12] for n in names}


def _git_dirty() -> list[str] | None:
    """Uncommitted changes under ai/ (prompts, fixture, code), or None if git is unavailable.

    A "frozen" run with a non-empty list did not run on the commit it names.
    """
    try:
        out = subprocess.run(["git", "status", "--porcelain", "--", "."], cwd=AI_DIR,
                             capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return [line[3:] for line in out.stdout.splitlines() if line.strip()]


def provenance(where: str = "") -> dict[str, Any]:
    """What every result file records (AI-07 rule 3) besides the run's own settings."""
    try:
        fixture_sha = _sha256((fixture_dir() / "sushi_recipe.json").read_bytes())[:12]
    except OSError:
        fixture_sha = "?"
    return {"commit": _git_commit(), "uncommitted": _git_dirty(),
            "prompt_hashes": prompt_hashes(), "fixture_sha256": fixture_sha,
            "where": where or "not recorded"}


def tree_state(uncommitted: list[str] | None) -> str:
    if uncommitted is None:
        return "tree state unknown"
    if not uncommitted:
        return "clean tree"
    return f"**{len(uncommitted)} uncommitted change(s)**: {', '.join(uncommitted[:5])}"


def summary_markdown(meta: dict, metrics: dict, rows: list[Row]) -> str:
    fake = " — **FAKE MODE, not an evaluation result**" if meta["fake"] else ""
    errs = metrics.get("errors_by_label", {})
    lines = [f"# Eval {meta['split']} / {meta['config']} / {meta['mode']}{fake}", "",
             f"- When (UTC): {meta['when']}  ·  commit `{meta['commit']}` "
             f"({tree_state(meta['uncommitted'])})",
             f"- Model: `{meta['model']}`  ·  prompt hashes: {meta['prompt_hashes']}  ·  "
             f"fixture `{meta['fixture_sha256']}`",
             f"- Frames: long edge <= {meta['frame_long_edge']} px, media resolution "
             f"{meta['media_resolution']}, timeout {meta['timeout_s']} s  ·  run from: "
             f"{meta['where']}",
             f"- Cases: {metrics['n']} ({meta['cases_file']}), errors: {metrics['errors']}"
             + (f" by label {errs}" if errs else ""), ""]
    if meta.get("placeholder_refs"):
        lines += [f"> **Warning:** the reference images for step(s) {meta['placeholder_refs']} "
                  "are placeholder cards, not chef stills (AI-03.5). This run cannot show what "
                  "the chef's reference adds.", ""]

    def of(n_key: str, label: str) -> str:
        k = errs.get(label, 0)
        return f"{metrics[n_key]}" + (f" ({k} without an answer)" if k else "")

    if meta["mode"] == "check":
        lines += [
            "| Metric | Count |", "|---|---|",
            f"| False approvals (fix → pass) | {metrics['false_approvals']} of "
            f"{of('n_fix', 'fix')} |",
            f"| False rejections (pass → fix) | {metrics['false_rejections']} of "
            f"{of('n_pass', 'pass')} |",
            f"| Appropriate unsure | {metrics['appropriate_unsure']} of "
            f"{of('n_unsure', 'unsure')} |",
            f"| Wrong unsure (pass/fix → unsure) | {metrics['wrong_unsure']} of "
            f"{metrics['n_pass_or_fix']} |",
            f"| Fix with the right mistake id | {metrics['right_mistake_id']} of "
            f"{metrics['n_fix_with_id']} |",
            f"| Latency p50 / max (ms) | {metrics['latency_p50_ms']} / "
            f"{metrics['latency_max_ms']} |", "",
            "Confusion (label→verdict): "
            + ", ".join(f"{k} {v}" for k, v in metrics["confusion"].items())]
    else:
        lines += [
            "| Metric | Count |", "|---|---|",
            f"| Mistakes detected (warn, right id, conf ≥ {metrics['threshold']}) | "
            f"{metrics['detected']} of {of('n_fix', 'fix')} |",
            f"| False warnings on pass/unsure frames | {metrics['false_warnings']} of "
            f"{metrics['n_not_fix']} |",
            f"| Latency p50 / max (ms) | {metrics['latency_p50_ms']} / "
            f"{metrics['latency_max_ms']} |", "", f"_{metrics['single_frame_note']}_"]
    wrong = [r for r in rows if r.error or (meta["mode"] == "check" and r.label != r.prediction)]
    if wrong:
        lines += ["", "## Disagreements and errors", "",
                  "| case | label | got | conf | error |", "|---|---|---|---|---|"]
        lines += [f"| {r.case_id} | {r.label} {r.mistake_id} | {r.prediction} "
                  f"{r.predicted_mistake} | {r.confidence} | {r.error[:80]} |" for r in wrong]
    return "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- main


async def evaluate(cases: list[Case], recipe: RecipeDraft, mode: str, config: str,
                   concurrency: int, timeout_s: float, long_edge: int | None = None) -> list[Row]:
    sem = asyncio.Semaphore(max(1, concurrency))

    async def one(c: Case) -> Row:
        async with sem:
            return await run_case(c, recipe, mode, config, timeout_s, long_edge)
    return list(await asyncio.gather(*(one(c) for c in cases)))


def main(argv: list[str] | None = None) -> int:
    load_env()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    p = argparse.ArgumentParser(prog="python -m ghostchef_ai.eval",
                                description=__doc__.splitlines()[0])
    p.add_argument("--split", choices=("dev", "heldout"), required=True)
    p.add_argument("--config", choices=CONFIGS, default="full")
    p.add_argument("--mode", choices=MODES, default="check")
    p.add_argument("--cases", type=Path, default=AI_DIR / "eval" / "cases.csv")
    p.add_argument("--out", type=Path, default=AI_DIR / "eval" / "results")
    p.add_argument("--concurrency", type=int, default=2)
    p.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    p.add_argument("--timeout", type=float, default=None,
                   help="per-case model budget (default: check 8 s, watch 3.5 s)")
    p.add_argument("--check-long-edge", type=int, default=CHECK_LONG_EDGE,
                   help="shrink check frames to this long edge, as the clients do (§3.1)")
    p.add_argument("--watch-long-edge", type=int, default=WATCH_LONG_EDGE,
                   help="shrink watch frames to this long edge, as the clients do (§3.2)")
    p.add_argument("--where", default="",
                   help="where it ran from, e.g. 'owner laptop, venue Wi-Fi' (recorded)")
    p.add_argument("--confirm-heldout", action="store_true",
                   help="required for --split heldout: run it once, after freezing prompts")
    args = p.parse_args(argv)
    if args.split == "heldout" and not args.confirm_heldout:
        print("refusing to run the held-out split without --confirm-heldout "
              "(run it once, after the prompts and threshold are frozen)", file=sys.stderr)
        return 2
    if args.mode == "watch" and args.config != "full":
        print("watch mode has no ablation configs; use --config full", file=sys.stderr)
        return 2
    cases = load_cases(args.cases, args.split)
    if not cases:
        print(f"no labelled {args.split} rows in {args.cases}", file=sys.stderr)
        return 1
    timeout_s = (args.timeout if args.timeout is not None and args.timeout > 0
                 else 8.0 if args.mode == "check" else 3.5)
    long_edge = args.check_long_edge if args.mode == "check" else args.watch_long_edge
    placeholders = (placeholder_steps({c.step_idx for c in cases})
                    if args.mode == "check" and args.config == "full" else [])
    if placeholders:
        print(f"warning: reference images for step(s) {placeholders} are placeholders, not chef "
              "stills; the full config cannot show what the reference adds", file=sys.stderr)
    rows = asyncio.run(evaluate(cases, load_recipe(), args.mode, args.config,
                                args.concurrency, timeout_s, long_edge))
    metrics = (check_metrics(rows) if args.mode == "check"
               else watch_metrics(rows, args.threshold))
    when = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    low_detail = check.LOW_DETAIL if args.mode == "check" else watch.LOW_DETAIL
    meta = {"when": when, "split": args.split, "config": args.config, "mode": args.mode,
            "fake": is_fake(), "model": model_ids()["check" if args.mode == "check" else "watch"],
            **provenance(args.where),
            "frame_long_edge": long_edge, "media_resolution": "LOW" if low_detail else "MEDIUM",
            "placeholder_refs": placeholders,
            "cases_file": args.cases.as_posix(), "concurrency": args.concurrency,
            "timeout_s": timeout_s, "paid_calls": client.usage.calls}
    args.out.mkdir(parents=True, exist_ok=True)
    stem = f"{when}-{args.split}-{args.config}-{args.mode}" + ("-FAKE" if meta["fake"] else "")
    (args.out / f"{stem}.json").write_text(
        json.dumps({"meta": meta, "metrics": metrics, "rows": [asdict(r) for r in rows]},
                   indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    md = summary_markdown(meta, metrics, rows)
    (args.out / f"{stem}.md").write_text(md, encoding="utf-8")
    print(md)
    print(f"wrote {args.out / stem}.json and .md", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
