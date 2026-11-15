# `backend/`: the Echo API

A FastAPI service that sits between every client (the iPhone app and the web tools) and everything that needs a secret: Gemini, Supabase and ElevenLabs. It stores recipes and sessions, runs the video ingestion job with ffmpeg, answers the cook's `/check` and `/watch` frames through the [`echo_ai`](../ai/README.md) package, mints short-lived Gemini Live tokens for the phone, and serves the [web app](../web/README.md) at `/app/`.

## Endpoints

The full specification is [../docs/API-CONTRACT.md](../docs/API-CONTRACT.md) (contract v2.2), and the generated schema is in `openapi.json`. Interactive `/docs` is turned off in the running service.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status: `contract_version`, `ai_mode` (`gemini` / `fake`), `storage`, `ffmpeg` |
| POST | `/recipes` | Create a recipe from a chef take. Returns a signed Supabase upload URL (TUS and `PUT`) and `upload_max_bytes` |
| POST | `/recipes/{id}/process` | Start ingestion (202) |
| GET / PATCH / DELETE | `/recipes`, `/recipes/{id}` | List (filter by `status`), read, edit, purge |
| POST | `/recipes/{id}/publish` | `review` to `published`. Every step must have a reference image |
| PATCH | `/steps/{id}` | Edit a step. A new `timestamp_s` re-cuts the reference still from the source video |
| POST | `/check` | Multipart frame. Compares it with the step's reference (`check_frame`) and returns `pass` / `fix` / `unsure` plus `latency_ms` |
| POST | `/watch` | Multipart low-res frame. Checks it against the step's known mistakes (`watch_frame`) and returns `ok` / `warn` |
| POST / GET | `/sessions`, `/sessions/{id}`, `/sessions/{id}/events` | Cook-along sessions, event log, end-of-session summary |
| GET | `/sessions/{id}/monitor`, `/sessions/{id}/latest-frame.jpg` | Live data for the audience monitor |
| GET | `/live-token` | Single-use ephemeral Gemini Live token plus the Live config for a published recipe |
| GET | `/tts-token` | Single-use ElevenLabs TTS token (503 if not configured) |
| POST / GET | `/app/auth/login`, `/app/auth/session`, `/app/auth/logout` | Browser sign-in with an access code, exchanged for a cookie |

Every endpoint except `/health`, the sign-in routes and the per-session monitor frame requires the `X-Demo-Key` header or a valid browser session cookie.

## How a chef take becomes a recipe

`app/jobs/ingest.py`:

1. `POST /recipes` returns a signed upload URL. The phone uploads the MP4 **straight to Supabase Storage**, never through FastAPI.
2. `POST /recipes/{id}/process` starts one background job at a time.
3. The job downloads the video in chunks with a size cap, then `ffprobe` validates it.
4. `echo_ai.extract_recipe(video, title_hint, step_marks_s)` returns steps, timestamps, success criteria, known mistakes and the transcript.
5. Timestamps are clamped to the video length. ffmpeg cuts a JPEG reference still (≤1280 px) and an optional silent clip (≤720 px, ≤6 s) per step. ffmpeg is called with argument lists, never a shell, and only the mp4 demuxer and file protocol are allowed.
6. Status becomes `review` and the web review page takes over. Any failure sets `failed` with a fixed message.

Stuck jobs are swept on startup: `processing` recipes older than 15 min and `uploading` ones older than 2 h become `failed`.

## Data

Postgres tables (`migrations/001_init.sql`):

- `recipes`: status `uploading | processing | review | published | failed`, step marks, consent time
- `steps`: instruction, success criteria, `watch_fors`, reference image, clip window, timer
- `sessions`
- `session_events`

Row Level Security is on with no policies, so only the service role can read or write and clients never touch tables.

There are three private buckets:

- `videos`: chef takes. 50 MiB per file in practice, the Supabase Free-plan cap
- `media`: reference stills and clips
- `frames`: cook frames from `/check` and `/watch`, written after the response

Storage sits behind a `Store` protocol with two implementations. `MemoryStore` keeps local files and is used for tests and emergency mode. `SupabaseStore` is used in production.

## Security

- Gemini, Supabase and ElevenLabs keys exist only on the server.
- The phone gets ephemeral Live tokens (at most 1 per session every 3 s, never cached or logged), signed download URLs and one signed upload URL per take.
- The demo key is compared in constant time. The server refuses to start with an empty or `dev-key` demo key on Railway, or anywhere it runs with Supabase plus real Gemini.
- **Browser sign-in:** an opaque HttpOnly, SameSite=Strict cookie (`__Host-` prefix over HTTPS). It requires `X-Echo-Browser: 1` and an exact same-origin `Origin`. Attempts are rate limited at 8 per client and 120 overall per window. Sessions are kept in memory, capped at 256.
- **Body caps:** 64 KB JSON, 2 MB frames, 4 KB login.
- **`/watch`:** one request in flight per session. After a Gemini quota error it pauses for 10 s.

## What has been verified

From [STATUS.md](STATUS.md), all dated 14 Nov 2026:

- **Production** runs on Railway with real Gemini and Supabase (`https://statai-production.up.railway.app`, deployment `f5850324` = commit `280f664`). Smoke runs against it passed, and `/live-token` returned a real locked `gemini-3.8-live` token.
- **Two-session load run on production** (103 calls, server-measured model time): `/check` p50 1032 ms, max 1455 ms. `/watch` p50 728 ms, max 1188 ms. On the client side, Railway's proxy added occasional multi-second stalls (one client timeout, p90 `/watch` 5.0 s), so treat the server numbers as model time, not end-to-end.
- **The ingestion pipeline on production with a real chef take** (recorded on the glasses, recorded in [../ios/STATUS.md](../ios/STATUS.md)): the take was uploaded, processed, and became a 5-step recipe with stills and clips in about 33 s, then was published. The pipeline's automated tests run on fake AI with generated videos.
- **The demo recipe** is the curated six-step fixture (real transcript and stills from that take), seeded with `scripts/seed.py --publish --replace`.
- **Tests:** `pytest -q` gives 307 passed, 5 skipped (fake AI, memory store, no network).

## Setup

Requires Python 3.11+ and `ffmpeg` + `ffprobe` on the PATH.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -e ../ai                 # the echo_ai package
pip install -e ".[dev]"
cp .env.example .env                 # defaults: memory store + fake AI, no keys needed
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pytest -q
python scripts/smoke.py --base http://localhost:8000 --key dev-key
```

Open `http://localhost:8000/app/` for the web tools. Live Supabase tests are opt-in: `RUN_SUPABASE_TESTS=1 pytest -q tests/test_supabase_integration.py`.

## Layout

```
backend/
  app/
    main.py config.py auth.py guard.py browser_sessions.py errors.py schemas.py views.py
    ai.py            imports echo_ai; reports ai_mode
    routers/         health recipes steps frames (/check, /watch) sessions live tts latest_frame browser_auth local
    store/           Store protocol, MemoryStore, SupabaseStore
    media/           JPEG handling, ffmpeg probe / still / clip, source-video cache
    jobs/ingest.py   ingestion job
    faults.py metrics.py refcache.py logs.py seed.py
  migrations/001_init.sql
  scripts/         seed smoke load_watch cleanup upload_limit_probe emergency.sh/.ps1
  tests/
  Dockerfile  railway.json  openapi.json
  STATUS.md  tasks/   build log and the team's task batches
```

## Configuration

Every variable is read in `app/config.py` and listed in `.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `DEMO_API_KEY` | `dev-key` | Value clients send in `X-Demo-Key`. Use a long random string in production |
| `WEB_LOGIN_CODE`, `WEB_SESSION_TTL_S` | — | Browser sign-in code and cookie lifetime (see [Browser sign-in](#browser-sign-in)) |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL` | — | Optional: enables `/tts-token` |
| `ECHO_MODEL_VIDEO` / `_CHECK` / `_WATCH` / `_LIVE` | from `echo_ai` | Gemini model overrides (read by `echo_ai`) |
| `STORAGE` | `memory` | `memory` or `supabase` |
| `DATA_DIR` | `.data` | Local file root for the memory store |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | — | Required when `STORAGE=supabase` |
| `ECHO_AI_FAKE` | `1` | `1` = fake AI, `0` = real Gemini (read by `echo_ai`) |
| `GEMINI_API_KEY` | — | Required when fake is off (read by `echo_ai`) |
| `CHECK_BUDGET_S` / `WATCH_BUDGET_S` | `8` / `3.5` | Model time budgets from the contract |
| `SIGNED_URL_TTL_S` | `7200` | Signed URL lifetime |
| `MAX_VIDEO_MB` | `50` | Video size limit in MiB: returned as `upload_max_bytes` by `POST /recipes`, enforced by the ingestion job while it downloads the video in chunks and by the memory-mode upload route. Must not exceed Supabase's global upload limit (50 MiB on the Free plan) |
| `CORS_ORIGINS` | `*` | Comma-separated origins; restrict in production |
| `WEB_DIR` | `../web` | Static web app, mounted at `/app/` when the directory exists |
| `PUBLIC_BASE_URL` | derived from the request | Used to build local file URLs in memory mode |
| `FAULT_INJECT` | empty | `timeout`, `quota` or `unavailable`: the failure to rehearse (see below). Anything else fails at startup |
| `FAULT_INJECT_ENABLED` | empty | Must be exactly `1` for fault injection to do anything. **Never set in production for the demo** |

### Startup refusals

The server refuses to start (`check_deploy_settings`) when `DEMO_API_KEY` is unset or `dev-key` and it is either on Railway or running with `STORAGE=supabase` and the real AI (`ECHO_AI_FAKE=0`).

### Quota cool-down

When the model answers `/watch` with a quota error, the process stops calling the model for `/watch` for 10 s: every `/watch` in that window answers `429 quota_exhausted` (`retryable: true`, the client's `request_id`) immediately, with `"cooldown": true` in its call log line. The check runs after `request_id` / `step_id` parsing (so a malformed request still gets `422`) and before the in-flight claim, the frame and the model. Only a quota error from `/watch` starts it; `/check` is never blocked by it and a quota error from `/check` does not start it. The state is per process (one worker), kept in `app/faults.py` (`WATCH_COOLDOWN_S`).

### Rehearsing failures (fault injection)

With `FAULT_INJECT=timeout|quota|unavailable` **and** `FAULT_INJECT_ENABLED=1`, a `/check`, `/watch` or `/live-token` request that carries the header `X-Fault: 1` fails with that error instead of calling the model: `504 model_timeout`, `429 quota_exhausted` (on `/watch` this also starts the cool-down) or `503 model_unavailable`. Requests without the header are untouched. Without `FAULT_INJECT_ENABLED=1` the header is ignored. The server logs a WARNING at startup when it is enabled. `X-Fault` is in the CORS allowed headers so the web app can send it. It is deliberately **not** blocked on Railway (recovery tests run against the deployed server): switch it on for the test, remove both variables afterwards, and never during the demo.

```bash
FAULT_INJECT=quota FAULT_INJECT_ENABLED=1 uvicorn app.main:app
curl -H 'X-Demo-Key: dev-key' -H 'X-Fault: 1' -F step_id=... -F request_id=$(uuidgen) -F frame=@f.jpg localhost:8000/watch
```

## Scripts

| Script | Purpose |
|---|---|
| `scripts/seed.py` | Seed the demo recipe (`--publish --replace`, optionally `--video <take.mp4>`) |
| `scripts/smoke.py` | End-to-end smoke test of every endpoint |
| `scripts/load_watch.py` | Watcher-cadence load check: `--sessions 2 --minutes 3 --frame x.jpg`. Per session: a `/watch` on a fixed 2.5 s grid (a tick is skipped and counted if the previous `/watch` of that session is still running), a `/check` every 20 s, then `session_end`. Prints status counts, error codes, p50 / p90 / max client latency, 429s and skipped ticks; exits 1 on any 5xx or transport error. It sends real frames: against production with real Gemini it spends quota, run it once and not right before the demo |
| `scripts/cleanup.py` | Data hygiene: `--hours 6` (default), dry run unless `--yes`. Deletes sessions older than N hours with their events and `frames/<session>/` blobs, and `failed` recipes (blobs first). Never deletes the seeded recipe; its old sessions are cleaned. With `STORAGE=supabase` it works on the real project (put the service key in `backend/.env`). With `STORAGE=memory` the rows live only inside the running server, so the script can only remove stale `DATA_DIR/frames/<session>` folders and says so |

## Docker image

The image needs `backend/`, `ai/` and `web/`, so the **build context is the repository root**:

```bash
docker build -f backend/Dockerfile -t echo-backend .                 # from the repo root
docker run -p 8000:8000 -e DEMO_API_KEY=dev-key echo-backend         # memory + fake AI
```

`python:3.12-slim` + `ffmpeg`, runs as a non-root user with **one** uvicorn worker (session state is in process memory, so never scale it out), listens on `$PORT` (default 8000). Inside the image: `ECHO_FIXTURE_DIR=/srv/ai/fixtures`, `WEB_DIR=/srv/web`, `DATA_DIR=/srv/data`. `backend/Dockerfile.dockerignore` keeps `.env`, `.venv`, `.git`, `ios/`, footage and `backend/.data` out of a local build context; the Dockerfile also copies only the backend paths it needs.

## Deploying (Railway)

**Note on `railway.json`.** Railway now calls config-as-code files deprecated. Its docs (read 2026-11-14) say they keep working only for *legacy* services, and only until **2026-12-01**. A service created today may ignore `backend/railway.json`, so step 2 sets the same values in the dashboard as well. Setting them in both places does no harm.

1. **Create the service.** In Railway: New Project → Deploy from GitHub repo → this repository, branch `main`.
   - Root directory: leave empty, so the repository root is used. The image needs `ai/` and `web/`.
   - Settings → Config-as-code / Railway config file: `backend/railway.json`, if the field is offered.
2. **Set the build and deploy settings in the dashboard.** These match `railway.json`.
   - Variable `RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`. This is Railway's documented way to use a Dockerfile that is not at the root.
   - Settings → Deploy:
     - Healthcheck path `/health`
     - Healthcheck timeout 120
     - Restart policy "On failure", max retries 10
   - Leave the start command empty. The Dockerfile's `CMD` starts uvicorn on `$PORT`.
3. **Set the variables** (Variables tab). Never commit them.

   | Variable | Value |
   |---|---|
   | `DEMO_API_KEY` | required: the server refuses to start on Railway with an empty key or `dev-key`. A new long random string: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
   | `STORAGE` | `supabase` |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | from the Supabase project (service role key) |
   | `ECHO_AI_FAKE` | `0` |
   | `GEMINI_API_KEY` | the event key |
   | `ECHO_MODEL_VIDEO` / `_CHECK` / `_WATCH` / `_LIVE` | from `ai/STATUS.md` → "Gemini account facts". On 2026-11-14 these were `gemini-3.5-flash` / `gemini-3.5-flash-lite` / `gemini-3.5-flash-lite` / `gemini-3.8-live`. Re-check before you deploy |
   | `CORS_ORIGINS` | `https://<your-domain>.up.railway.app,http://localhost:5173` (fill in after step 4) |
   | `RAILWAY_DOCKERFILE_PATH` | `backend/Dockerfile` (step 2) |

4. **Get a public URL.** Settings → Networking → Generate Domain. If Railway asks for a target port, enter the port the app logs. It listens on Railway's `PORT`, so normally you accept the default. Then go back and finish `CORS_ORIGINS`.
5. **Keep it at one replica.** Settings → Deploy → Replicas = 1, and no multi-region setup.
6. **Deploy and watch the build log.** The build should print that it uses `backend/Dockerfile`. If it says Railpack instead, `RAILWAY_DOCKERFILE_PATH` was not picked up, so fix it and redeploy. Then verify:

   ```bash
   curl https://<domain>/health        # expect "ai_mode":"gemini","storage":"supabase"
   python scripts/smoke.py --base https://<domain> --key <demo key> --frame <real frame.jpg>
   ```

   Then open `https://<domain>/app/` on a phone.
7. **Share the URL and the new demo key privately** with the team, never in the repo. Record the URL and the smoke run in `STATUS.md`.

Supabase needs no seeding for production if `scripts/seed.py --publish --replace` has already run against the same project. Run it again whenever the fixture changes.

### Keeping production current

Production deploys are **manual**. After step 1, turn off automatic deploys for `main` in the service settings ("Disable"). To release:

1. Run `pytest -q` and the local smoke script on the commit.
2. In the Railway dashboard, press `Cmd/Ctrl + K` → **Deploy Latest Commit**.
3. Run `curl /health` and the smoke script against production.

If a deploy breaks, use Railway's redeploy on the previous deployment to roll back.

## Emergency mode (laptop on a phone hotspot)

Use this when the venue Wi-Fi or Railway fails. It runs the same server on a laptop, with `STORAGE=memory`, real Gemini, and the fixture recipe seeded at startup.

```bash
backend/scripts/emergency.sh            # macOS / Linux   (--fake to rehearse without Gemini)
backend\scripts\emergency.ps1           # Windows         (-Fake, -Port 8001)
```

**Before you run it**, check the laptop is ready:
- The backend venv is set up, as in [Setup](#setup).
- `backend/.env` holds `GEMINI_API_KEY` and a private `DEMO_API_KEY`. With real Gemini the script refuses the public default `dev-key`. The `ECHO_MODEL_*` values are optional.
- Values in `.env` are plain `KEY=value` lines. Quotes and trailing ` # comments` are handled.

**What the script does:**
- Binds to `0.0.0.0:8000`.
- Prints the laptop's LAN addresses (`http://<ip>:8000`). Type one of them into the app's server setting, with the same demo key.
- Never prints a key.

**Steps:**
1. Turn on the phone's hotspot.
2. Join it from the laptop.
3. Run the script.
4. Point the app at the printed address.
5. Run one check.

**Limits:**
- **Plain HTTP on a LAN address.** Browsers allow the camera only on HTTPS or `localhost`. The web simulator's camera therefore works only on the laptop itself (`http://localhost:8000/app/`), not from a phone or another laptop. Photo upload still works.
- **The iOS app** needs local-network permission and an App Transport Security exception to reach an `http://` address.
- **Memory store.** Recipes recorded in production are not here, only the seeded fixture recipe. Everything is lost when the process stops.
- On Windows, allow Python through the firewall for private networks.

## Browser sign-in

Set `WEB_LOGIN_CODE` privately in Railway service variables to enable the same-origin web app's **Sign in** dialog. Keep `DEMO_API_KEY`, Gemini and Supabase credentials on the server; no endpoint returns them. iPhone and separate development clients continue using `X-Demo-Key`.

The login issues an opaque HttpOnly, Secure, SameSite=Strict cookie over HTTPS. HTTP is allowed only on localhost for development. Browser requests require `X-Echo-Browser: 1`; unsafe requests also require an exact same-origin `Origin`. Login bodies are capped at 4 KB and attempts are rate limited. Responses use `Cache-Control: no-store, private`.

Sessions expire after `WEB_SESSION_TTL_S` (default 14,400 seconds, allowed 300–28,800), are revoked on sign-out/re-login, and reset on deployment/restart. The existing one-worker deployment stores at most 256 sessions in memory; multiple workers/replicas would require a shared session store. Login codes are never written into the repository.
