# Echo — architecture

> How the pieces fit, what each technology is responsible for, how the system behaves when something fails, and what has been verified on real hardware.
> Interfaces are specified in [API-CONTRACT.md](API-CONTRACT.md). Dated evidence lives in each folder's `STATUS.md`.

## 1. Components and folders

| Folder | Component | Runs on | Talks to |
|---|---|---|---|
| [`ios/`](../ios/README.md) | iOS app (Swift, SwiftUI, Meta DAT SDK), **one app with two modes: Chef (record a recipe) and Cook (follow along)** | iPhone paired with the glasses | Glasses (DAT over Bluetooth), backend (HTTPS), Supabase Storage (one signed upload per recording), Gemini Live (WebSocket) |
| [`backend/`](../backend/README.md) | FastAPI service: recipes, check, watch, sessions, live tokens, ffmpeg, storage | Laptop in development, Railway in production | Supabase, `echo_ai` package |
| [`ai/`](../ai/README.md) | Python package `echo_ai`: every prompt and every Gemini call; fixture recipe; evaluation | Imported by the backend; CLI on a laptop | Gemini API |
| [`web/`](../web/README.md) | Static web app: cook-along **simulator**, recipe **review page** (review / edit / publish, plus a dev-fallback MP4 upload), demo **monitor**; plus the pitch pack | Any browser; served by the backend at `/app/` | Backend (HTTPS); Supabase Storage only for the dev-fallback upload |

```
 ┌──────────────────────┐  Bluetooth / DAT  ┌─────────────────────────────┐
 │ Meta Ray-Ban Display │ ◄───────────────► │ ios/  iPhone app            │
 │ camera · mic · lens  │                   │  FrameSource (swappable)    │
 │ speakers · inputs    │                   │  Chef mode: Recorder + marks│
 │                      │                   │  CookSession state machine  │
 └──────────────────────┘                   │  Watcher loop + debounce    │
                                            │  LensModel → 2 renderers    │
                                            │  LiveClient (voice)         │
                                            └──────┬───────────────┬──────┘
                                         HTTPS     │               │ WebSocket, ephemeral token
                                                   ▼               ▼
 ┌───────────────────────┐  HTTPS   ┌───────────────────────┐   ┌──────────────────┐
 │ web/  browser         │ ───────► │ backend/  FastAPI     │   │ Gemini Live API  │
 │  simulator (webcam)   │          │  /recipes /steps      │   └──────────────────┘
 │  review page          │          │  /check /watch        │
 │  demo monitor         │          │  /sessions /live-token│
 └───────────────────────┘          │  ffmpeg · jobs        │
                                    └──────┬──────────┬─────┘
                                 import    │          │ service role
                                           ▼          ▼
                              ┌────────────────┐   ┌──────────────────────┐
                              │ ai/            │   │ Supabase             │
                              │ echo_ai   │   │ Postgres + Storage   │
                              └───────┬────────┘   └──────────────────────┘
                                      ▼
                              Gemini API (video, vision, token minting)
```

Two pieces exist for practical reasons rather than as product features:

- **Web simulator.** A browser client that runs the same cook-along loop with a webcam. It lets `backend/` and `ai/` be tested end to end without the Mac, the iPhone, or the glasses, and it is the demo of last resort. It is a development tool and a fallback, never presented as the Meta deliverable.
- **Demo monitor.** Glasses are personal: the audience cannot see the lens. The monitor shows the wearer's latest frame, the chef's reference, the verdict, and the event timeline on a laptop or projector.

## 2. Technology roles

| Technology | Its job here | Why it is not replaceable by something simpler |
|---|---|---|
| **Meta glasses + DAT** | First-person camera frames, in-lens step cards, hands-free input, audio in/out | The learner's viewpoint must match the chef's; hands are occupied |
| **Gemini — video understanding** (`extract_recipe`) | Turns one chef recording into ordered steps with timestamps, success criteria, common mistakes, transcript | Needs joint understanding of what is said and what the hands do, with timestamps |
| **Gemini — multi-image vision** (`check_frame`) | Compares the learner's frame with the chef's reference frame under the step's criteria → pass / fix / unsure | The judgment is "same as the reference in the ways that matter", not object detection |
| **Gemini — fast vision** (`watch_frame`) | Every 2.5 s, classifies a low-res frame against the step's known mistakes only | Open-vocabulary mistakes defined in plain language per recipe, no training |
| **Gemini Live** | Spoken questions answered from the chef's transcript; voice commands arrive as function calls | Natural interruption and low-latency audio |
| **Structured output** | Every non-Live Gemini call returns schema-validated JSON | The app logic must never parse prose |
| **Application code (ours)** | Step state, debounce, stale-answer rejection, timeouts, pause rules, uncertainty handling, session log | A model alone over-talks or stays silent; control lives in ordinary code |
| **FastAPI backend** | Keeps keys server-side, runs long ingestion jobs and ffmpeg, mints Live tokens, records events | No serverless timeout; single place for latency measurement |
| **Supabase** | Postgres for recipes/steps/sessions/events; private Storage for video, stills, clips, frames | Managed, signed URLs, quick to set up |

## 3. Flows

### 3.1 Ingestion (chef → recipe)

1. **Record (iOS, Chef mode).** The chef cooks wearing the glasses and narrates. The app writes the DAT camera stream and mic audio to an MP4 on the phone (no clip-length limit, unlike the glasses' built-in capture). The lens shows "● REC 03:12". Each glasses *select* input, lens button press, or "New step" tap saves a **step mark** (seconds since start) into `step_marks_s`.
2. **Create.** On stop: `POST /recipes` with title, `step_marks_s`, consent → `201 uploading` + a signed Supabase Storage upload URL.
3. **Upload.** Takes over 45 MB are re-encoded on the phone (Supabase caps files at 50 MiB). The app uploads the MP4 **directly to Supabase Storage** (resumable TUS, because of venue Wi-Fi), never through FastAPI. Dev fallback: the review page uploads any MP4 through the same signed URL with a simple `PUT`.
4. **Process.** `POST /recipes/{id}/process` → `processing`. The background job downloads the video from Storage and calls `echo_ai.extract_recipe(video_path, step_marks_s=…)` → `RecipeDraft` (steps, timestamps, transcript); the marks are hints.
5. Backend runs ffmpeg per step: reference still at `timestamp_s`, optional clip `clip_start_s…clip_end_s`; uploads them to Storage; sets status `review` (or `failed` with `error`).
6. **Review (web page).** The chef or a teammate opens the review page on a laptop, which polls the status, edits text / re-picks timestamps → `PATCH /steps/{id}` → `POST /recipes/{id}/publish` → `published`.

### 3.1b Delivery (recipe → cook's app)

1. Cook mode lists the library: `GET /recipes?status=published` (no accounts; every published recipe is visible).
2. The cook picks one: `GET /recipes/{id}` → steps + signed URLs.
3. **The app downloads every reference image and clip before cooking starts.** During cooking only `/check`, `/watch` and Gemini Live need the network.
4. The phone sends the current step's image or clip to the glasses display through DAT.

Not built: chefs sharing a recipe link or QR code. Every published recipe is visible to every cook (no accounts).

**The demo never depends on ingestion running live.** One seeded, reviewed recipe is always present.

### 3.2 On-demand check

Glasses select, tap, or "check" → client grabs one full-res frame → `POST /check` with `request_id`, `step_id`, `session_id` → backend loads the step and its reference image → `check_frame` → response → client applies the stale-result rule → Pass / Fix / Unsure screen + on-device TTS of `spoken`.

### 3.3 Proactive watcher

Client loop every 2.5 s → low-res frame → `POST /watch` → `watch_frame` against the step's `watch_fors` → client debounce (2 consecutive, same `mistake_id`, confidence ≥ threshold) → Warning screen + TTS. Rules: [API-CONTRACT §3.3](API-CONTRACT.md#33-client-rules-for-the-watcher-ios-and-web-implement-these-identically).

Gemini Live is deliberately **not** the watcher: a cheap, schema-constrained single-frame call every 2.5 s is easier to debounce, measure and pause than a streaming conversation.

### 3.4 Voice

Session start → `GET /live-token` → phone opens the Live WebSocket with the ephemeral token → microphone audio streams up, answers stream down → on each step change the phone sends a `[CONTEXT]` line → voice commands arrive as function calls and run the same code paths as gestures. Details: [API-CONTRACT §5](API-CONTRACT.md#5-gemini-live-voice).

## 4. Environments and configuration

| Environment | Backend | Storage | AI | Used for |
|---|---|---|---|---|
| **Mock** | Laptop, `uvicorn` | `STORAGE=memory` | `ECHO_AI_FAKE=1` | First hours; UI work; tests |
| **Local real** | Laptop, reachable on the LAN | `memory` or `supabase` | Real Gemini | Integration at the table |
| **Production** | Railway | Supabase | Real Gemini | The demo |
| **Emergency** | A laptop on a phone hotspot | `memory` + local files | Real Gemini | Venue Wi-Fi or Railway failure |

Secrets and where they live (never committed; `.example` files show the names):

| Variable | Used by | Notes |
|---|---|---|
| `GEMINI_API_KEY` | `ai/` (CLI, eval), `backend/` | Server-side only |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | `backend/` | Service role; never in a client |
| `DEMO_API_KEY` | `backend/` (expects it), `ios/` and dev web clients (send it) | A shared random string; rotate after the event |
| `WEB_LOGIN_CODE` | `backend/` | Browser sign-in code; exchanged for an HttpOnly session cookie |
| `ELEVENLABS_API_KEY` (+ voice, model) | `backend/` | Optional; enables `/tts-token` |
| `API_BASE_URL` | `ios/`, `web/` | Local LAN IP or the Railway URL |

Browsers only grant camera access on `https://` or `localhost`. The web simulator therefore works from `localhost` on a laptop or from the deployed HTTPS URL, but **not** from a LAN IP over plain HTTP.

## 5. What is verified, and where

| Item | Status | Evidence |
|---|---|---|
| Meta DAT iOS SDK pinned at **1.0.1**: camera, display, inputs, mock device | In code | `ios/project.yml` |
| Glasses camera recording in Chef mode on **real glasses** | Verified once (2026-11-14, borrowed pair; 2 min 14 s, 720×1280, audio present) | `ios/STATUS.md` → Chef takes |
| Registration, camera stream, image + text card, stream and display together, inputs | Pass on MockDeviceKit; not yet on real glasses | `ios/STATUS.md` → Device facts |
| Cook-mode loop on the glasses, audio routing through the glasses | Not verified | `ios/STATUS.md` |
| Cook-mode loop on the iPhone (watcher → warning → fix → re-check → pass; offline behaviour) | Verified with the backend in fake-AI mode | `ios/STATUS.md` |
| Gemini models: video `gemini-3.5-flash`, check/watch `gemini-3.5-flash-lite`, Live `gemini-3.8-live` | Verified callable with the team's key | `ai/STATUS.md` |
| Ephemeral Live token, locked to model, prompt and tools | Verified on production (`/live-token` 200) | `backend/STATUS.md`, `ai/STATUS.md` |
| Production backend on Railway with real Gemini and Supabase | Verified (smoke and two-session load run) | `backend/STATUS.md` |
| Ingestion of a real chef take on production | Verified once: 5 steps with stills and clips in ~33 s | `ios/STATUS.md` → Chef takes |
| Supabase upload limit | 50 MiB per file (Free plan); larger takes are re-encoded on the phone first | `backend/README.md` |

Meta's DAT display offers only primary and secondary text colours, so lens states are distinguished by icon and wording. Wearer input arrives through DAT `MWDATInputs` (select, left/right, up, back; seen on MockDeviceKit from the captouch source); lens buttons and voice commands are also offered.

## 6. Failure behaviour

The rule: **the wearer always knows whether the system is watching, and never receives a verdict about a state that is no longer true.**

| Failure | Detection | What the wearer experiences | Recovery |
|---|---|---|---|
| Camera permission denied | DAT / AVFoundation permission result | Phone screen explains what is needed; lens shows "Camera off" | Re-request; deep-link to Settings |
| Glasses disconnect mid-session | DAT device state listener | Spoken "Glasses disconnected"; phone shows status; session state is kept | Auto-resume on reconnect at the same step; option to continue with the phone camera |
| Display unavailable (Gen 2 pair, or display error) | `supportsDisplay` false or display start fails | Audio-only mode: step title + key line spoken on step change, results spoken | Automatic; no feature is lost except "show me" |
| Audio route lost / too noisy | Audio session route change; user toggle | Display-only mode: results as headline + fix; voice Q&A unavailable | Push-to-talk toggle; reconnect |
| Network offline | Request error | Dot turns grey; check shows "No connection" | Step cards and reference images keep working from cache; retry on next check |
| `/watch` error or timeout | Non-200 / client timeout 4 s | Nothing, except the grey dot | Next tick; 3 in a row → pause 15 s |
| `/check` error or timeout | Non-200 / client timeout 10 s | "Can't check right now" + spoken equivalent | One automatic retry for 503/504; then manual |
| Gemini quota exhausted | `429` | Watcher pauses 10 s; check says "Can't check right now" | Backoff; operator can switch the watch model or slow the interval in settings |
| Low-confidence or unjudgeable frame | `verdict: unsure` | "Can't tell" + how to give a better view | Wearer re-frames and re-checks |
| Stale answer | Stale-result rule | Nothing | Discarded silently |
| Step changed while a check is pending | Stale-result rule | The pending spinner clears | Discarded silently |
| Live session drops | WebSocket close | Mic icon shows unavailable; everything else works | Reconnect with session resumption, else fetch a new token |
| Live talks over a result | Arbitration in the audio layer | Result TTS wins; Live is ducked | Automatic |
| Backend down | `/health` fails | Phone shows "Server unreachable" | Operator switches base URL to the emergency laptop |
| Signed URL expired | Image load fails | Nothing: images are cached at session start | Refetch recipe |
| Chef upload interrupted | TUS error / app backgrounded | Chef mode shows upload progress and "Retrying…"; the MP4 stays on the phone | TUS resumes from the last chunk; else a simple `PUT` retry; after 2 h the recipe becomes `failed` ("upload never completed") |
| Ingestion fails | Job exception | Review page shows `failed` with the reason | Re-upload; the seeded recipe is unaffected |

Implemented in the iOS app (unit-tested against a mock API and clock) and the backend (fault injection: `FAULT_INJECT` + `X-Fault: 1`). The deliberate recovery run on a device is listed in [EVALUATION.md](EVALUATION.md#recovery-tests) and has not been done yet.

## 7. Security and privacy

- The Gemini API key and the Supabase service key exist only on the backend. The phone receives ephemeral Live tokens, signed Storage download URLs, and — in Chef mode — one signed **upload** URL scoped to `videos/<recipe_id>/source.mp4`.
- Every API endpoint except `/health` and the sign-in routes requires the shared `X-Demo-Key` or a browser session cookie. Browser sign-in exchanges a private code for an opaque HttpOnly, SameSite=Strict cookie; attempts are rate limited.
- Request bodies are capped (64 KB JSON, 2 MB frames). Live tokens are single-use, at most one per session every 3 s, never cached or logged.
- Uploads are limited by type (MP4) and size; because the video bypasses FastAPI, the ingestion job checks size and runs `ffprobe` before anything else, and marks the recipe `failed` if either fails. Frames are limited by type (JPEG) and size. Storage paths are scoped per recipe and per session.
- Row Level Security is on for all tables; clients never touch Supabase tables. The only direct client → Supabase call is the signed, single-object video upload.
- The repository is public and [MIT-licensed](../LICENSE): no key or token is ever committed. See `.gitignore`.
- Only frames from `/check` calls and from `/watch` calls that returned `warn` are stored. Deleting a recipe deletes its sessions and frames.
