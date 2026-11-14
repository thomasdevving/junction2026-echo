"""Probe the real video upload limit through the full POST /recipes flow.

    python scripts/upload_limit_probe.py --base https://statai-production.up.railway.app \
        --mb 53 --method tus [--method put] [--mb 45] [--poll 180]

For each size and method: re-encode the team's real chef take to a constant-bitrate MP4 of
about that size (ffmpeg, temp dir, deleted afterwards), POST /recipes, upload it exactly as
the clients do (TUS to `resumable_endpoint` with `x-signature` and 6 MB chunks, or one PUT to
`upload_url`), call
/process, poll the status, then DELETE the recipe (always, even after a failure).

The demo key comes from --key, else $ECHO_DEMO_KEY, else backend/.env (DEMO_API_KEY).
Never prints the key or the upload token.

The real take is not in git (public repository): it is read from $ECHO_REAL_TAKE, else
ai/footage/chef-take-sandwich.mp4 (git-ignored; get it privately from the team).
"""

from __future__ import annotations

import argparse
import base64
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

CHUNK = 6 * 1024 * 1024  # contract §2: TUS chunk size exactly 6 MB
MARKS = [0, 10, 20, 30, 40, 50]
REAL_TAKE = Path(
    os.environ.get("ECHO_REAL_TAKE")
    or Path(__file__).resolve().parents[2] / "ai" / "footage" / "chef-take-sandwich.mp4"
)


def _key(cli: str | None) -> str:
    if cli:
        return cli
    if os.environ.get("ECHO_DEMO_KEY"):
        return os.environ["ECHO_DEMO_KEY"]
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app.config import get_settings

    return get_settings().demo_api_key.get_secret_value()


def _duration_s(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return float(out.strip())


def make_mp4(target_mb: float, out: Path) -> int:
    """~target_mb MB (10^6 bytes): the real chef take re-encoded at the constant bitrate that
    gives that size over its full length (picture and sound are the real lesson)."""
    if not REAL_TAKE.is_file():
        sys.exit(
            f"Real chef take missing: {REAL_TAKE} (not in git; set ECHO_REAL_TAKE or copy it there)"
        )
    duration = _duration_s(REAL_TAKE)
    audio_kbps = 64
    video_kbps = max(100, int(target_mb * 8_000 / duration) - audio_kbps)
    rate = f"{video_kbps}k"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(REAL_TAKE),
         "-c:v", "libx264", "-preset", "ultrafast",
         "-b:v", rate, "-minrate", rate, "-maxrate", rate, "-bufsize", "2000k",
         "-x264-params", "nal-hrd=cbr", "-c:a", "aac", "-b:a", f"{audio_kbps}k",
         "-movflags", "+faststart", str(out)],
        check=True,
    )
    return out.stat().st_size


def _short(r: httpx.Response) -> str:
    return f"{r.status_code} {r.text.strip()[:140]!r}"


def tus_upload(rec: dict, data: bytes) -> bool:
    def b64(s: str) -> str:
        return base64.b64encode(s.encode()).decode()

    tus = {"Tus-Resumable": "1.0.0", "x-signature": rec["upload_token"]}
    meta = ",".join(
        f"{k} {b64(v)}"
        for k, v in [("bucketName", rec["bucket"]), ("objectName", rec["object_path"]),
                     ("contentType", "video/mp4")]
    )
    t0 = time.monotonic()
    with httpx.Client(timeout=120) as c:
        r = c.post(rec["resumable_endpoint"],
                   headers={**tus, "Upload-Length": str(len(data)), "Upload-Metadata": meta,
                            "x-upsert": "true"})
        print(f"    TUS create: {_short(r)}")
        if r.status_code != 201:
            return False
        loc = httpx.URL(rec["resumable_endpoint"]).join(r.headers["Location"])
        off = n = 0
        while off < len(data):
            r = c.patch(loc, content=data[off:off + CHUNK],
                        headers={**tus, "Upload-Offset": str(off),
                                 "Content-Type": "application/offset+octet-stream"})
            if r.status_code != 204:
                print(f"    TUS patch @ {off}: {_short(r)}")
                return False
            off, n = int(r.headers["Upload-Offset"]), n + 1
    print(f"    TUS patch: 204 x{n}, final offset {off:,}, {time.monotonic() - t0:.1f} s")
    return True


def put_upload(rec: dict, data: bytes) -> bool:
    t0 = time.monotonic()
    with httpx.Client(timeout=300) as c:
        r = c.put(rec["upload_url"], content=data, headers={"Content-Type": "video/mp4"})
    print(f"    PUT: {_short(r)} ({time.monotonic() - t0:.1f} s)")
    return r.status_code == 200


def probe(c: httpx.Client, path: Path, size: int, method: str, poll_s: float) -> None:
    print(f"  [{method}] {size:,} bytes ({size / 2**20:.2f} MiB)")
    r = c.post("/recipes", json={"title": f"upload probe {method} {size}", "consent": True,
                                 "step_marks_s": MARKS})
    print(f"    POST /recipes: {r.status_code}")
    r.raise_for_status()
    rec = r.json()
    rid = rec["recipe_id"]
    extra = {k: v for k, v in rec.items() if k.startswith("upload_max")}
    if extra:
        print(f"    {extra}")
    try:
        data = path.read_bytes()
        (tus_upload if method == "tus" else put_upload)(rec, data)
        r = c.post(f"/recipes/{rid}/process")
        print(f"    POST /process: {_short(r)}")
        if r.status_code == 202:
            t0, last = time.monotonic(), None
            while time.monotonic() - t0 < poll_s:
                body = c.get(f"/recipes/{rid}").json()
                st = body.get("status")
                if st != last:
                    print(f"    t+{time.monotonic() - t0:4.0f}s status={st} "
                          f"error={body.get('error')!r} steps={len(body.get('steps') or [])}")
                    last = st
                if st in ("review", "failed", "published"):
                    break
                time.sleep(3)
    finally:
        r = c.delete(f"/recipes/{rid}", params={"force": "true"})
        print(f"    DELETE: {r.status_code}; GET after: {c.get(f'/recipes/{rid}').status_code}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--key")
    ap.add_argument("--mb", type=float, action="append", required=True,
                    help="target size in MB (10^6 bytes); repeatable")
    ap.add_argument("--method", choices=["tus", "put"], action="append")
    ap.add_argument("--poll", type=float, default=180, help="seconds to poll after /process")
    a = ap.parse_args()
    methods = a.method or ["tus", "put"]
    with tempfile.TemporaryDirectory(prefix="echo-upload-probe-") as tmp, \
            httpx.Client(base_url=a.base, headers={"X-Demo-Key": _key(a.key)}, timeout=60) as c:
        print(f"{a.base} /health: {httpx.get(a.base + '/health', timeout=20).text}")
        for mb in a.mb:
            path = Path(tmp) / f"probe-{mb}.mp4"
            size = make_mp4(mb, path)
            for m in methods:
                probe(c, path, size, m, a.poll)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
