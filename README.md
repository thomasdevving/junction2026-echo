# Echo

**A chef records a recipe once through Meta AI glasses. Anyone wearing the glasses can then cook it hands-free. Gemini compares what the cook's camera sees with the chef's own point-of-view footage, flags mistakes as they happen, and answers questions using the chef's own words.**

Built at **Junction 2026** (Espoo, 13–15 Nov) for **Meta — AI Glasses for Everyone, Everyday** and **Google DeepMind — Best Use of Gemini API**.

- **Demo video:** https://www.youtube.com/watch?v=3_NyVYkBLWI
- **Live web app:** https://statai-production.up.railway.app/app/ (the home and technology pages are public; the review page, monitor and simulator load data only after sign-in with the team's access code)
- **Presentation:** [docs/echo-pitch.pdf](docs/echo-pitch.pdf)
- **Repository:** https://github.com/thomasdevving/junction2026-echo
- **Licence:** [MIT](LICENSE)

## The problem

Learning a hands-on technique from a video breaks at the moment it matters:

- Your hands are busy, so you can't pause or scroll.
- The video can't see your board, so you find out the filling was all in the middle when the sandwich falls apart.

A teacher fixes this with one glance and one sentence, but that doesn't scale. Echo gives every learner that glance, grounded in a specific chef's method rather than generic cooking advice.

**Why glasses:** the chef's reference was filmed from eye level looking down at the board, and the learner's camera sits in the same place. Comparing like with like is what makes "does mine look like the chef's?" answerable, while the learner's hands stay on the food.

## How it works

**1. The chef records once** (iPhone app, Chef mode)
- The chef cooks wearing the glasses and talks through it, pinching to mark each new step.
- The take uploads to the backend.
- **Gemini** watches the video and turns it into steps. Each step gets a reference frame, the chef's own words, visible success criteria, and the common mistakes to watch for.

**2. The chef reviews** (web review page)
- Fix the wording, re-pick any reference frame, publish.

**3. Anyone cooks along** (iPhone app, Cook mode)
- Each step appears in the lens as an icon, two short lines and the chef's reference still.
- **Check:** pinch or say "check". Gemini compares the cook's frame with the chef's reference against that step's criteria and answers *pass*, *fix* plus one instruction, or *can't tell* plus how to give a better view. It never guesses.
- **Watch:** every ~2.5 s a low-res frame is checked against the step's known mistakes only. The cook is warned after two consecutive hits, before they know to ask. A "● watching" indicator shows whenever frames are being sent.
- **Ask:** hold to talk. Gemini Live answers from the chef's transcript. Voice commands ("next", "check", "show me") run the same code as gestures.

```
 Meta glasses ⇄ iPhone app ──HTTPS──► FastAPI backend ──► echo_ai ──► Gemini API
   (DAT SDK)       │                    │      ▲
                   │                    │      └── web: review page · audience monitor · simulator
                   │                    ▼
                   │                Supabase (Postgres + private Storage)
                   └── WebSocket (ephemeral token) ──► Gemini Live
```

## Technology

| | What we use it for |
|---|---|
| **Meta Device Access Toolkit** (iOS SDK 1.0.1) | Glasses camera stream for recording and checking, lens display cards, glasses inputs (select / swipe / back) mapped to Check / Next / Back / Dismiss |
| **Gemini: video understanding** (`gemini-3.5-flash`) | Chef video becomes structured steps with timestamps, criteria, mistakes and transcript (Files API + JSON schema) |
| **Gemini: multi-image vision** (`gemini-3.5-flash-lite`) | Cook's frame vs. chef's reference frame becomes pass / fix / unsure, with evidence recorded per criterion before the verdict |
| **Gemini: fast vision** (`gemini-3.5-flash-lite`) | Proactive watcher: one low-res frame vs. the step's known mistakes, enum-constrained output |
| **Gemini Live** (`gemini-3.8-live`) | Spoken Q&A grounded in the chef's transcript, with function calling for voice commands. The phone opens the session with a single-use **ephemeral token**, so no key ever reaches the device |
| **ElevenLabs** | Pre-rendered voice lines for results, and an optional TTS token endpoint |
| **FastAPI + Supabase**, on Railway | Keys stay server-side, plus ingestion with ffmpeg, sessions, events and latency logging |

Control logic is ordinary code, not the model: debounce, stale-answer rejection, the confidence floor that turns weak verdicts into *unsure*, and the pause rules.

## What works today

We only list what the code does and what the team recorded in the `STATUS.md` files.

| | Status |
|---|---|
| Chef take recorded **on real Meta glasses**, processed by Gemini on production into a recipe, published | Done once (14 Nov). A 2 min 14 s take became 5 steps with stills, clips, chef quotes and a watched mistake in ~33 s. The demo recipe uses its transcript and stills |
| Backend with real Gemini and Supabase on Railway | Running. Smoke and load tests passed (14 Nov) |
| Cook-along loop (check, watcher, warnings, fix, re-check, pass) on the iPhone | Done, but only with the backend in fake-AI mode |
| Gemini Live voice | Implemented. Real token minted and first-audio latency measured from a laptop. Not yet confirmed on the phone |
| Cook mode **on real glasses**, end to end | Not yet verified. Glasses features pass on Meta's MockDeviceKit |
| Web review page, audience monitor, browser simulator | Done. Verified locally |
| Accuracy on labelled frames | **Not measured.** The evaluation set and ablation runner exist, but no labelled frames yet |

**Measured latency** (14 Nov, real Gemini; end-to-end on venue Wi-Fi was slower, see [EVALUATION.md](docs/EVALUATION.md)):

| Call | Where it was measured | p50 | max |
|---|---|---|---|
| `/check` model time, production load run (n=18) | Railway logs | 1.03 s | 1.46 s |
| `/watch` model time, same run (n=85) | Railway logs | 0.73 s | 1.19 s |
| Gemini Live: question to first audio (n=5) | laptop | 0.59 s | 0.70 s |

Known limit: on unlabelled dev frames, the fast check model approved 1–2 of 9 clearly unfinished frames. A larger model approved none, but took about 2.5 s at p50. Which model ships is a configuration switch (`ECHO_MODEL_CHECK`), and labelled frames are needed before we can claim an accuracy figure.

## Run it locally

Without keys, using the memory store and fake AI:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ../ai && pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --port 8000
# open http://localhost:8000/app/  (review page, monitor, simulator)
```

For real Gemini, set `ECHO_AI_FAKE=0`, `GEMINI_API_KEY` and a private `DEMO_API_KEY` in `backend/.env`. The iPhone app needs a Mac with Xcode; see [ios/README.md](ios/README.md).

## Repository

| Folder | What it is |
|---|---|
| [`ios/`](ios/README.md) | SwiftUI app for iPhone and Meta glasses: Chef and Cook modes, watcher, Gemini Live client |
| [`backend/`](backend/README.md) | FastAPI API: recipes, ingestion with ffmpeg, `/check`, `/watch`, sessions, Live tokens, deployment |
| [`ai/`](ai/README.md) | `echo_ai`: every prompt and Gemini call, the demo recipe fixture, the evaluation runner |
| [`web/`](web/README.md) | Review page, audience monitor, browser simulator, public site, demo film source |

| Document | Content |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Audience, user journeys, what "correct" means, trust and accessibility |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, flows, failure behaviour, security |
| [docs/API-CONTRACT.md](docs/API-CONTRACT.md) | HTTP API, data model, `echo_ai` interface, client rules |
| [docs/EVALUATION.md](docs/EVALUATION.md) | Evaluation method, measured results, what remains to measure |
| [docs/TEAM.md](docs/TEAM.md) | How the team worked: tracks, task batches, planning documents |

Each folder's `STATUS.md` is the dated build log. Nothing is marked done there unless someone ran it and saw the result.

## Team

Thomas, Stelios, Aleksandr, Türker.
