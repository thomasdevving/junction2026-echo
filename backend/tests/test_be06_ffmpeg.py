"""BE-06.1: ffmpeg helpers, against the team's real chef take (see conftest: REAL_TAKE)."""

from __future__ import annotations

import json
import subprocess

import pytest
from PIL import Image

from app.media import ffmpeg
from app.media.ffmpeg import FfmpegError, extract_clip, extract_still, probe

from .conftest import requires_ffmpeg

pytestmark = requires_ffmpeg


def _ffprobe_json(path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", str(path)],
        check=True,
        capture_output=True,
    ).stdout
    return json.loads(out)


async def test_probe_real_take(take_mp4, take_duration_s):
    info = await probe(take_mp4)
    assert info["duration_s"] == pytest.approx(take_duration_s, abs=0.3)
    assert info["duration_s"] > 120  # the 2:14 sandwich lesson
    assert (info["width"], info["height"], info["rotation"]) == (720, 1280, 0)


async def test_probe_rotated(take_rotated_mp4):
    info = await probe(take_rotated_mp4)
    assert info["rotation"] in (90, 270)
    assert (info["width"], info["height"]) == (720, 1280)


async def test_probe_rejects_non_video(tmp_path):
    bad = tmp_path / "x.mp4"
    bad.write_text("this is not a video\n" * 100)
    with pytest.raises(FfmpegError):
        await probe(bad)


async def test_still_1280_jpeg(take_mp4, tmp_path):
    out = tmp_path / "still.jpg"
    await extract_still(take_mp4, 2.0, out)
    with Image.open(out) as img:
        assert img.format == "JPEG"
        assert img.size == (720, 1280)  # portrait, already within 1280: unchanged


async def test_still_follows_rotation_and_never_upscales(take_rotated_mp4, tmp_path):
    # The real take is portrait; a 90 degree display rotation makes it upright-landscape.
    out = tmp_path / "still.jpg"
    await extract_still(take_rotated_mp4, 1.0, out)
    with Image.open(out) as img:
        w, h = img.size
    assert w > h and max(w, h) <= 1280

    small = tmp_path / "small.jpg"
    await extract_still(take_rotated_mp4, 1.0, small, long_edge=4000)
    with Image.open(small) as img:
        assert max(img.size) == 1280  # the source's long edge, not 4000


async def test_still_past_the_end_fails(take_mp4, tmp_path):
    with pytest.raises(FfmpegError):
        await extract_still(take_mp4, 500.0, tmp_path / "late.jpg")
    assert not (tmp_path / "late.jpg").exists()


async def test_clip_720_h264_no_audio_faststart(take_mp4, tmp_path):
    out = tmp_path / "clip.mp4"
    await extract_clip(take_mp4, 0.5, 4.5, out)
    streams = _ffprobe_json(out)["streams"]
    assert [s["codec_type"] for s in streams] == ["video"]  # the take's audio is dropped
    v = streams[0]
    assert (v["codec_name"], v["pix_fmt"]) == ("h264", "yuv420p")
    assert (v["width"], v["height"]) == (406, 720)  # portrait, long edge 720
    data = out.read_bytes()
    assert data.index(b"moov") < data.index(b"mdat")


async def test_clip_is_capped_at_6_seconds(take_small_mp4, tmp_path):
    out = tmp_path / "clip.mp4"
    await extract_clip(take_small_mp4, 0.0, 8.0, out)
    v = _ffprobe_json(out)["streams"][0]
    assert float(v["duration"]) <= 6.05
    assert (v["width"], v["height"]) == (240, 426)  # never upscaled to 720


async def test_clip_empty_window_raises(take_mp4, tmp_path):
    with pytest.raises(FfmpegError):
        await extract_clip(take_mp4, 3.0, 3.0, tmp_path / "c.mp4")


async def test_run_timeout_kills_the_process():
    with pytest.raises(FfmpegError, match="timed out"):
        await ffmpeg._run(["sleep", "30"], 0.2)


async def test_run_nonzero_exit_keeps_stderr_tail():
    with pytest.raises(FfmpegError) as exc:
        await ffmpeg._run(["sh", "-c", "echo oops >&2; exit 3"], 5)
    assert "oops" in exc.value.stderr and "oops" not in str(exc.value)


def test_health_reports_ffmpeg(client):
    body = client.get("/health").json()
    assert body["ffmpeg"] is True


def test_ffmpeg_available_false_when_missing(monkeypatch, client):
    monkeypatch.setattr(ffmpeg.shutil, "which", lambda name: None)
    ffmpeg.ffmpeg_available.cache_clear()
    try:
        assert ffmpeg.ffmpeg_available() is False
        assert client.get("/health").json()["ffmpeg"] is False
    finally:
        monkeypatch.undo()
        ffmpeg.ffmpeg_available.cache_clear()
