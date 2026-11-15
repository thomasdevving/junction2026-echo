# `web/`: browser tools and the public site

Plain HTML, CSS and ES modules, with no build step and no framework. The FastAPI backend serves it under `/app/`. It contains three tools plus the public pages:

| Page | Path | What it is for |
|---|---|---|
| **Home** | `index.html` | Public landing page: how one chef take becomes a reviewed lesson, with links to everything |
| **Review** | `review/` | The chef's side after recording. Recipes uploaded from the iOS Chef mode appear here. Edit each step's text, visible success criteria and known mistakes, re-pick the reference frame from the source video, then publish. Delete requires typing the title |
| **Monitor** | `monitor/` | The audience's window into the lens. It follows the newest active session and shows the chef's reference, the wearer's latest frame, the lens card and the event timeline, readable from three metres away |
| **Simulator** | `sim/` | The full cook-along loop (checks, watcher, lens card) with a webcam or an uploaded photo. A development tool and fallback, not the glasses product |
| **Technology** | `technology/` | Public explainer for the Meta, Gemini and ElevenLabs integrations and their current limits |
| **Brand** | `brand/` | Logo files |

## How it works

- **One lens renderer.** `shared/lens.js` draws the glasses display spec: black background, white and grey only, at most two short lines, state shown by icon and words. The real DAT display has no colour text, so the mock doesn't suggest any. The simulator and the monitor share it.
- **Same client rules as the iPhone app.** `shared/debounce.js` implements the watcher debounce from [../docs/API-CONTRACT.md](../docs/API-CONTRACT.md) §3.3, and the simulator applies the stale-result rule (§3.4).
- **Honest labelling.** Every page shows the connected API, `ai_mode` and `storage` from `/health`, and turns red in fake-AI mode. Local backup recordings on the monitor are always marked `REPLAY`.
- **Sign-in.** On the same origin, a shared login code goes to `POST /app/auth/login` and is exchanged for an expiring HttpOnly, Secure, SameSite=Strict cookie. The code and the backend API key are never stored by web code. For a separate development server, a manual `X-Demo-Key` can be entered under Advanced connection settings.

Endpoints used, from `shared/api.js`:

| Page | Calls |
|---|---|
| Simulator | `/recipes`, `/sessions`, `/check`, `/watch`, `/sessions/{id}/events` |
| Review | `/recipes` (CRUD, `process`, `publish`), `PATCH /steps/{id}`, plus a signed-URL `PUT` for the dev-fallback MP4 upload |
| Monitor | `/sessions?active=true`, `/sessions/{id}/monitor`, `/recipes/{id}` |
| Public pages | `/health` only |

## Run it

```bash
# Served by the backend (same origin): start ../backend, then open
open http://localhost:8000/app/

# Or as a standalone static server against any backend
python -m http.server 5173 --directory web     # then set API base + key under Settings
```

Browsers allow the camera only on `https://` or `localhost`. From another device over plain HTTP, use "Upload a photo" in the simulator.

Tests: `node --test "web/tests/*.test.mjs"` runs 5 files covering debounce, monitor state, review validation, connection, and browser session.

**Monitor keys:** **F** fullscreen, **B** load a local backup recording, **S** session picker, **H** toggle details. URL options: `?session=<id>` pins a session, `?clean=0` opens details.

## What has been verified

- The pages were verified locally against the backend in fake-AI and memory mode on 14 Nov. Details are in [STATUS.md](STATUS.md).
- On production (15 Nov) every page is served (HTTP 200) and the API behind it passed the smoke test; a visual walk-through of each page there is not recorded.
- The review flow has not yet been run by the chef on the real chef take.

## Layout

```
web/
  index.html home.css motion.js assets/    public landing page
  sim/ review/ monitor/ technology/ brand/ pages
  shared/      api.js config.js lens.js debounce.js connection.js browser-session.js chrome.js setup.js ui.css
  tests/       node:test suites
  pitch/       demo film source (video/), deck (deck/), run sheet, submission draft
  PRODUCT.md   design brief for these pages
  STATUS.md  tasks/   build log and the team's task batches
```

`pitch/video/` renders the product film from `film.html` (Node 24, ffmpeg, Chrome, ElevenLabs key; see `pitch/video/HANDOFF.md`). The rendered MP4 is not committed.
