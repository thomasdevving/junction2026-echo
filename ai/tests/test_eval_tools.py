"""AI-07 tooling without network: eval runner (fake mode), debounce replay, clip intake."""

import csv
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys

import pytest
from conftest import AI_DIR

from echo_ai import eval as ev

HAS_FFMPEG = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))
COLUMNS = ["case_id", "file", "step_idx", "split", "label", "mistake_id", "labeller",
           "source_device", "notes"]


def _load(name):
    spec = importlib.util.spec_from_file_location(name, AI_DIR / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod  # dataclasses need the module registered
    spec.loader.exec_module(mod)
    return mod


def _eval_dir(tmp_path, rows):
    """A tiny eval set: real fixture images as frames (big enough for the fake's rules)."""
    for split in ("dev", "heldout"):
        (tmp_path / "frames" / split).mkdir(parents=True)
    img = (AI_DIR / "fixtures" / "images" / "step-4.jpg").read_bytes()
    with (tmp_path / "cases.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for i, (split, label, mid, size) in enumerate(rows):
            name = f"f{i}.jpg"
            (tmp_path / "frames" / split / name).write_bytes(img if size == "big" else b"x" * 100)
            w.writerow({"case_id": f"c{i}", "file": f"frames/{split}/{name}", "step_idx": "4",
                        "split": split, "label": label, "mistake_id": mid, "labeller": "AK",
                        "source_device": "test", "notes": ""})
    return tmp_path / "cases.csv"


# ------------------------------------------------------------------ eval runner


def test_load_cases_filters_split_and_unlabelled(tmp_path):
    cases_csv = _eval_dir(tmp_path, [("dev", "pass", "", "big"), ("dev", "", "", "big"),
                                     ("heldout", "fix", "filling_piled_center", "big")])
    dev = ev.load_cases(cases_csv, "dev")
    assert [c.case_id for c in dev] == ["c0"]
    assert ev.load_cases(cases_csv, "heldout")[0].mistake_id == "filling_piled_center"


def test_check_metrics_counts():
    R = ev.Row
    rows = [R("a", "f", 4, "fix", "filling_piled_center", "pass", latency_ms=100),
            R("b", "f", 4, "fix", "filling_piled_center", "fix", "filling_piled_center",
              latency_ms=300),
            R("c", "f", 4, "pass", "", "fix", latency_ms=200),
            R("d", "f", 4, "unsure", "", "unsure", latency_ms=50),
            R("e", "f", 4, "pass", "", "unsure", latency_ms=60),
            R("x", "f", 4, "pass", "", error="AITimeout: slow")]
    m = ev.check_metrics(rows)
    assert (m["false_approvals"], m["n_fix"]) == (1, 2)
    # The timed-out pass case stays in the denominator and is reported as an error.
    assert (m["false_rejections"], m["n_pass"]) == (1, 3)
    assert m["errors_by_label"] == {"pass": 1}
    assert (m["appropriate_unsure"], m["n_unsure"]) == (1, 1)
    assert (m["wrong_unsure"], m["n_pass_or_fix"]) == (1, 5)
    assert (m["right_mistake_id"], m["n_fix_with_id"]) == (1, 2) and m["errors"] == 1
    assert (m["latency_p50_ms"], m["latency_max_ms"]) == (100, 300)


def test_watch_metrics_threshold():
    R = ev.Row
    rows = [R("a", "f", 4, "fix", "filling_piled_center", "warn", "filling_piled_center", 0.9),
            R("b", "f", 4, "fix", "filling_piled_center", "warn", "filling_piled_center", 0.6),
            R("c", "f", 4, "pass", "", "warn", "filling_piled_center", 0.95),
            R("d", "f", 4, "pass", "", "ok", "", 0.9)]
    m = ev.watch_metrics(rows, 0.7)
    assert (m["detected"], m["n_fix"], m["false_warnings"], m["n_not_fix"]) == (1, 2, 1, 2)


@pytest.mark.parametrize("config", ["full", "no-ref", "generic"])
def test_runner_end_to_end_in_fake_mode(tmp_path, config):
    cases_csv = _eval_dir(tmp_path, [("dev", "fix", "filling_piled_center", "big"),
                                     ("dev", "pass", "", "big"),
                                     ("dev", "unsure", "", "small")])
    out = tmp_path / "results"
    assert ev.main(["--split", "dev", "--config", config, "--cases", str(cases_csv),
                    "--out", str(out), "--concurrency", "1"]) == 0
    js = next(out.glob("*.json"))
    assert js.name.endswith(f"-dev-{config}-check-FAKE.json")
    data = json.loads(js.read_text(encoding="utf-8"))
    assert data["meta"]["fake"] is True and data["metrics"]["n"] == 3
    assert data["metrics"]["appropriate_unsure"] == 1  # the tiny frame -> fake unsure
    md = js.with_suffix(".md").read_text(encoding="utf-8")
    assert "FAKE MODE, not an evaluation result" in md and "False approvals" in md


def test_runner_watch_mode_and_guards(tmp_path):
    cases_csv = _eval_dir(tmp_path, [("dev", "fix", "filling_piled_center", "big"),
                                     ("heldout", "pass", "", "big")])
    out = tmp_path / "results"
    assert ev.main(["--split", "dev", "--mode", "watch", "--cases", str(cases_csv),
                    "--out", str(out)]) == 0
    assert ev.main(["--split", "heldout", "--cases", str(cases_csv), "--out", str(out)]) == 2
    assert ev.main(["--split", "dev", "--mode", "watch", "--config", "generic",
                    "--cases", str(cases_csv), "--out", str(out)]) == 2
    empty = _eval_dir(tmp_path / "e", [("dev", "", "", "big")])
    assert ev.main(["--split", "dev", "--cases", str(empty), "--out", str(out)]) == 1


def test_generic_prompt_has_only_the_step_title():
    text = ev.prompts.render("generic_check", STEP_TITLE="Add fillings")
    assert "Add fillings" in text and "{{" not in text


# ------------------------------------------------------------------ debounce replay


def test_debounce_two_in_a_row_same_id():
    r = [(0, "warn", "a", 0.9), (2.5, "warn", "a", 0.9), (5, "warn", "a", 0.9)]
    assert ev.debounce_alerts(r, 0.7) == [(2.5, "a")]


def test_debounce_breaks_on_ok_other_id_or_low_confidence():
    r = [(0, "warn", "a", 0.9), (2.5, "ok", None, 0.9), (5, "warn", "a", 0.9),
         (7.5, "warn", "b", 0.9), (10, "warn", "b", 0.5), (12.5, "warn", "b", 0.9)]
    assert ev.debounce_alerts(r, 0.7) == []


def test_debounce_pauses_for_the_screen_then_mutes():
    # A mistake that stays visible, one answer every 2.5 s. Alert at 2.5; the warning screen
    # pauses the watcher until 14.5 (12 s, no input -> dismissed), then "a" is muted until
    # 34.5. Warns after the pause rebuild the streak, so the next alert is the first warn at
    # or after 34.5 (API-CONTRACT §3.3), not 22.5 as a mute counted from the alert would give.
    r = [(t * 2.5, "warn", "a", 0.9) for t in range(20)]
    assert ev.debounce_alerts(r, 0.7) == [(2.5, "a"), (35.0, "a")]


def test_debounce_drops_answers_during_the_warning_screen():
    # Another mistake warned while "a" is on screen: the watcher is paused, so no alert.
    r = [(0, "warn", "a", 0.9), (2.5, "warn", "a", 0.9), (5, "warn", "b", 0.9),
         (7.5, "warn", "b", 0.9), (15, "warn", "b", 0.9), (17.5, "warn", "b", 0.9)]
    assert ev.debounce_alerts(r, 0.7) == [(2.5, "a"), (17.5, "b")]


def test_debounce_mute_lasts_twenty_seconds_after_dismissal():
    r = [(0, "warn", "a", 0.9), (2.5, "warn", "a", 0.9),  # alert, screen until 14.5
         (15, "ok", None, 0.9),
         (30, "warn", "a", 0.9), (32.5, "warn", "a", 0.9),  # still muted (until 34.5)
         (35, "warn", "a", 0.9)]
    assert ev.debounce_alerts(r, 0.7) == [(2.5, "a"), (35, "a")]


# ------------------------------------------------------------------ BOM, frame size, provenance


def test_cases_with_a_spreadsheet_bom_are_read(tmp_path):
    cases_csv = _eval_dir(tmp_path, [("dev", "pass", "", "big")])
    cases_csv.write_bytes(b"\xef\xbb\xbf" + cases_csv.read_bytes())  # Excel "CSV UTF-8"
    assert [c.case_id for c in ev.load_cases(cases_csv, "dev")] == ["c0"]


def test_fit_long_edge_shrinks_like_the_clients():
    import io

    from PIL import Image

    big = (AI_DIR / "fixtures" / "images" / "step-4.jpg").read_bytes()  # 720x1280
    with Image.open(io.BytesIO(ev.fit_long_edge(big, 512))) as im:
        assert max(im.size) == 512 and im.size[0] < im.size[1]
    assert ev.fit_long_edge(big, 1280) is big  # already fits: unchanged


def test_placeholder_references_are_detected(tmp_path):
    # The shipped references are real stills from the glasses take: none is a placeholder.
    assert ev.placeholder_steps({1, 2, 3, 4, 5, 6}) == []
    # A still whose hash is in the manifest is a placeholder card; a missing image also counts
    # as "no chef reference"; any other still is real.
    own = tmp_path / "images"
    own.mkdir()
    card = b"placeholder card"
    (own / "step-4.jpg").write_bytes(card)
    (own / "placeholders.json").write_text(
        json.dumps({"step-4.jpg": hashlib.sha256(card).hexdigest()}), encoding="utf-8")
    (own / "step-2.jpg").write_bytes(b"real still")
    assert ev.placeholder_steps({2, 4, 5}, own) == [4, 5]


def test_runner_records_provenance(tmp_path):
    cases_csv = _eval_dir(tmp_path, [("dev", "fix", "filling_piled_center", "big")])
    out = tmp_path / "results"
    assert ev.main(["--split", "dev", "--cases", str(cases_csv), "--out", str(out),
                    "--where", "test runner"]) == 0
    js = next(out.glob("*.json"))
    meta = json.loads(js.read_text(encoding="utf-8"))["meta"]
    assert meta["placeholder_refs"] == []  # real stills since the glasses take
    assert meta["frame_long_edge"] == 1280 and meta["media_resolution"] == "MEDIUM"
    assert meta["where"] == "test runner" and len(meta["fixture_sha256"]) == 12
    assert "uncommitted" in meta and "prompt_hashes" in meta
    md = js.with_suffix(".md").read_text(encoding="utf-8")
    assert "placeholder cards" not in md
    assert ev.main(["--split", "dev", "--mode", "watch", "--cases", str(cases_csv),
                    "--out", str(tmp_path / "w")]) == 0
    wmeta = json.loads(next((tmp_path / "w").glob("*.json")).read_text(encoding="utf-8"))
    assert wmeta["meta"]["frame_long_edge"] == 512 and wmeta["meta"]["placeholder_refs"] == []


def test_watch_clip_takes_frames_on_the_phone_clock(monkeypatch, tmp_path):
    """Next frame = previous answer's arrival + 2.5 s; alert times are arrival times."""
    from types import SimpleNamespace

    wc = _load("watch_clip")

    def fake_run(cmd, **_):
        cmd[3].write_bytes(b"x" * 6000)  # ffmpeg_cmd(ffmpeg, clip, t, out, ...): out at [3]

    ef = SimpleNamespace(frame_name=lambda p, t: f"{p}-{t:07.2f}.jpg",
                         ffmpeg_cmd=lambda *a: list(a), subprocess=SimpleNamespace(run=fake_run))
    ticks = iter(range(100))
    monkeypatch.setattr(wc.time, "perf_counter", lambda: float(next(ticks)))  # 1 s per call

    async def watch(frame, step, timeout_s):
        return SimpleNamespace(status="warn", mistake_id="filling_piled_center",
                               confidence=0.9, model="stub")

    monkeypatch.setattr(wc.gc, "watch_frame", watch)
    step = ev.load_recipe().step(4)
    rows = wc.asyncio.run(wc.run(tmp_path / "c.mp4", step, 10.0, every=2.5, long_edge=512,
                                 timeout_s=3.5, ef=ef, ffmpeg="ffmpeg", workdir=tmp_path))
    assert [r["t"] for r in rows] == [0.0, 3.5, 7.0]
    assert [r["arrival"] for r in rows] == [1.0, 4.5, 8.0]
    assert [r["latency_ms"] for r in rows] == [1000, 1000, 1000]
    triples = [(r["arrival"], r["status"], r["mistake_id"], r["confidence"]) for r in rows]
    # Visible from 0 s: the alert is shown when the 2nd warn arrives, at 4.5 s, not at 2.5 s.
    assert ev.debounce_alerts(triples, 0.7) == [(4.5, "filling_piled_center")]
    assert wc.warn_frames_after_fix(rows, "filling_piled_center", 3.0, 0.7) == 2
    assert wc.warn_frames_after_fix(rows, "none", 3.0, 0.7) is None


def test_watch_clip_score():
    wc = _load("watch_clip")
    assert wc.score([], "none", None, None, 60) == {
        "alerts": 0, "false_alerts": 0, "false_alerts_per_min": 0.0}
    s = wc.score([(1.0, "x"), (7.5, "filling_piled_center"), (30, "filling_piled_center")],
                 "filling_piled_center", 5.0, 18.0, 40)
    assert s["detected"] and s["detection_delay_s"] == 2.5
    assert s["false_alerts"] == 2 and s["alerts_after_fix"] == 1


# ------------------------------------------------------------------ clip intake


def _manifest(path, rows):
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["clip_id", "split", "step_idx", "intent", "mistake_id", "notes"])
        w.writerows(rows)


def test_manifest_validation(tmp_path):
    ic = _load("intake_clips")
    m = tmp_path / "clips.csv"
    _manifest(m, [["V1", "dev", "4", "fix", "filling_piled_center", ""],
                  ["v1", "dev", "4", "pass", "", ""], ["V2", "nope", "", "", "", ""],
                  ["V3", "heldout", "", "pass", "", ""], ["C1", "expert", "", "", "", ""]])
    clips, errors = ic.read_manifest(m)
    assert any("duplicate" in e for e in errors)
    assert any("split must be" in e for e in errors)
    assert any("need a step_idx" in e for e in errors)
    assert [c.clip_id for c in clips] == ["V1", "v1", "C1"]


def test_find_file_matches_id_prefix_only(tmp_path):
    ic = _load("intake_clips")
    for n in ("V1.mp4", "v1-filling.MOV", "V10.mp4", "V1.txt"):
        (tmp_path / n).write_bytes(b"x")
    assert {p.name for p in ic.find_file(tmp_path, "V1")} == {"V1.mp4", "v1-filling.MOV"}
    assert [p.name for p in ic.find_file(tmp_path, "V10")] == ["V10.mp4"]


def test_manifest_with_a_bom_is_read(tmp_path):
    ic = _load("intake_clips")
    m = tmp_path / "clips.csv"
    _manifest(m, [["V1", "dev", "4", "fix", "filling_piled_center", ""]])
    m.write_bytes(b"\xef\xbb\xbf" + m.read_bytes())
    clips, errors = ic.read_manifest(m)
    assert errors == [] and [c.clip_id for c in clips] == ["V1"]


def test_intake_reports_a_clip_without_frames(tmp_path):
    ic = _load("intake_clips")
    src = tmp_path / "drive"
    src.mkdir()
    (src / "V2.mp4").write_bytes(b"not a video")  # ffprobe cannot read it (or no ffmpeg)
    m = tmp_path / "clips.csv"
    _manifest(m, [["V2", "dev", "4", "pass", "", ""]])
    footage, eval_dir = tmp_path / "footage", tmp_path / "eval"
    args = ["--src", str(src), "--manifest", str(m), "--footage", str(footage),
            "--eval-dir", str(eval_dir), "--labeller", "AK", "--device", "test"]
    assert ic.main(args) == 1  # a failure, not a silent 0 rows
    assert not (eval_dir / "cases.csv").exists()


def test_intake_never_overwrites_a_retake_silently(tmp_path):
    ic = _load("intake_clips")
    src, footage = tmp_path / "drive", tmp_path / "footage"
    src.mkdir()
    footage.mkdir()
    (src / "C1.mp4").write_bytes(b"new take")
    (footage / "C1.mp4").write_bytes(b"old")
    m = tmp_path / "clips.csv"
    _manifest(m, [["C1", "expert", "", "", "", ""]])
    assert ic.main(["--src", str(src), "--manifest", str(m), "--footage", str(footage),
                    "--eval-dir", str(tmp_path / "eval")]) == 1
    assert (footage / "C1.mp4").read_bytes() == b"old"


def test_committed_manifest_has_the_right_header():
    ic = _load("intake_clips")
    with (AI_DIR / "eval" / "clips.csv").open(newline="", encoding="utf-8") as f:
        assert next(csv.reader(f)) == ic.MANIFEST_COLUMNS


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg not installed")
def test_intake_end_to_end(tmp_path):
    ic = _load("intake_clips")
    src = tmp_path / "drive"
    src.mkdir()
    for name in ("V1-filling.mp4", "C1.mp4", "B1.mp4", "stray.mp4"):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i",
                        "testsrc=size=720x1280:rate=10:duration=6", "-pix_fmt", "yuv420p",
                        str(src / name)], check=True)
    m = tmp_path / "clips.csv"
    _manifest(m, [["V1", "dev", "4", "fix", "filling_piled_center", "obvious"],
                  ["C1", "expert", "", "", "", "chef take"], ["B1", "other", "", "", "", ""],
                  ["V9", "heldout", "4", "pass", "", ""]])
    footage, eval_dir = tmp_path / "footage", tmp_path / "eval"
    args = ["--src", str(src), "--manifest", str(m), "--footage", str(footage),
            "--eval-dir", str(eval_dir), "--labeller", "AK", "--device", "test"]
    assert ic.main([*args, "--dry-run"]) == 1  # V9 is missing
    assert not footage.exists()
    assert ic.main(args) == 1
    assert (footage / "V1.mp4").is_file() and (footage / "C1.mp4").is_file()
    assert (footage / "other" / "B1.mp4").is_file()
    frames = sorted((eval_dir / "frames" / "dev").glob("V1-*.jpg"))
    assert len(frames) == 3
    with (eval_dir / "cases.csv").open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 3 and all(r["label"] == "" for r in rows)
    assert rows[0]["step_idx"] == "4" and "intent: fix filling_piled_center" in rows[0]["notes"]
    assert ic.main(args) == 1  # rerun adds no duplicate rows
    with (eval_dir / "cases.csv").open(newline="", encoding="utf-8") as f:
        assert len(list(csv.DictReader(f))) == 3
