# Track: `web/` — simulator, review page, demo monitor, pitch and submission

**Owner: Türker**

You own three small browser apps and everything that faces people outside the team: user conversations, the pitch pack, demo operations, and the submission. The code here is the lightest of the four tracks; the non-code work (users, deck, rehearsal, forms) is what usually gets forgotten at hackathons, so it has an owner: you.

New here? Read [../README.md](../README.md), [../docs/PRODUCT.md](../docs/PRODUCT.md), [../docs/API-CONTRACT.md](../docs/API-CONTRACT.md) §1–§4, [../docs/DEMO-AND-SUBMISSION.md](../docs/DEMO-AND-SUBMISSION.md), then this file.

## What you deliver

| Deliverable | Why it exists |
|---|---|
| **Simulator** (`sim/`) — the cook-along loop in a browser with a webcam or uploaded photos | Lets `backend/` and `ai/` be tested end to end without the Mac or the glasses; last-resort demo fallback |
| **Review page** (`review/`) — review, edit, publish recipes the iOS app recorded; plus an MP4 upload as a **dev fallback** | A Must in the spec; the chef records in the app's Chef mode (`ios/`), and reviews here on a laptop |
| **Demo monitor** (`monitor/`) — live view of a running session | The audience cannot see inside a lens |
| **Pitch pack** (`pitch/`) — one-liners, deck, evidence, Q&A, user notes | Judging |
| Demo kit, run sheet, backup recording, **submission** | Deadlines |

The simulator is a development tool and a fallback. It is never presented as the Meta deliverable.

## Setup

No build step, no framework, no package install. Plain HTML, CSS, and ES modules.

```bash
# Option A — served by the backend (same origin, no CORS, works on phones over HTTPS in production)
#   start the backend (see ../backend/README.md), then open  http://localhost:8000/app/

# Option B — standalone static server, talking to any backend
python -m http.server 5173 --directory web
#   open http://localhost:5173/  and set the API base URL + demo key in Settings (gear icon)
```

Optional: Node 18+ to run the web tests (`node --test "web/tests/*.test.mjs"`; Node 22+ no longer accepts a bare directory, so `node --test web/tests/` fails there).

**Camera note:** browsers allow camera access only on `https://` or `localhost`. The simulator's webcam works on your own laptop at `localhost` and on the deployed HTTPS URL, but not when another device opens `http://<LAN-IP>:…`. Use "Upload a photo" there.

## Target layout

```
web/
  index.html              landing page: Simulator · Review · Monitor · Settings
  shared/
    config.js             API base + demo key (localStorage; defaults to same origin under /app/)
    api.js                fetch wrapper: X-Demo-Key, error envelope → ApiError, multipart helpers, signed-URL video PUT
    lens.js  lens.css     renderLens(element, lensScreen) — the lens card, shared by sim and monitor
    debounce.js           watcher debounce (same rules as the iOS app) — pure, unit-tested
    ui.css                shared page styling
  sim/       index.html  sim.js
  review/    index.html  review.js  review.css  validation.js
  monitor/   index.html  monitor.js  monitor.css  state.js  polling.js
  tests/     debounce.test.mjs  monitor.test.mjs  review.test.mjs
  pitch/     one-liners.md  deck-outline.md  evidence.md  qa.md  user-notes.md  run-sheet.md  architecture.svg  deck.pdf
  README.md  STATUS.md  tasks/
```

## Design rules for the three apps

- **The lens card looks the same everywhere.** `shared/lens.js` renders the display spec from [../docs/TECH-SPEC.md](../docs/TECH-SPEC.md): black background, bright elements, at most two short text lines, amber for fix, green for pass. The simulator and the monitor both use it.
- **Client rules are the contract's rules.** The simulator implements the stale-result rule (§3.4) and the watcher rules (§3.3) exactly as the iOS app does.
- **Always show what you are connected to.** Every page has a footer strip with the API base, `ai_mode`, and `storage` from `/health`, turning red when `ai_mode` is `fake`.
- **Readable from three metres.** The monitor is shown on a laptop to people standing at a table: large type, high contrast, no clutter.
- **Label recordings.** Anything not live carries a visible `REPLAY` badge.
- Everything works with the keyboard; images have alt text; no information by colour alone.

## Batches

One Claude session per batch. Kickoff prompt: [../docs/PLAN.md §7](../docs/PLAN.md#7-working-with-claude-on-each-laptop).

| # | Batch | Gate | Needs | A human must |
|---|---|---|---|---|
| 01 | [Foundation and simulator](tasks/01-foundation-and-simulator.md) | G0→G1 | BE-01 reachable | Point a webcam at things |
| 02 | [Review page](tasks/02-review-page.md) | G3 | BE-01 (fake ingestion) to build; BE-06 for real | Review a real ingested recipe |
| 03 | [Demo monitor](tasks/03-demo-monitor.md) | G2 | BE-01 to build; BE-03.5 + BE-05 for the full feed | Check it from across a table |
| 04 | [User evidence and pitch pack](tasks/04-user-evidence-and-pitch-pack.md) | G3→G4 | A working loop to show people; AI-07 numbers; IOS-06 device facts | Talk to people; build the deck |
| 05 | [Demo ops and submission](tasks/05-demo-ops-and-submission.md) | **Starts tonight** (preliminary submission), ends G5 | — | Shop, rehearse, submit |

**Do WEB-05 task 1 (preliminary submission) immediately**, before any code. Then 01. Build 03 before 02: the monitor is needed for G2, the review page for G3.

## Rules for this track

- Deck and spoken claims use **only** measured values from `ai/STATUS.md`, `backend/STATUS.md`, `ios/STATUS.md`, and [../docs/EVALUATION.md](../docs/EVALUATION.md). The allowed-claims table is in [../docs/PRODUCT.md §10](../docs/PRODUCT.md#10-what-we-can-and-cannot-claim).
- No names, faces, or quotes of people outside the team in the repository without their permission. The repository is public.
- Submitting forms, publishing videos, and messaging organizers or partners are done by **you, the human owner**. Claude drafts; you send.
- Do not edit other tracks' folders. API problems go in [STATUS.md](STATUS.md) → "Needs from other tracks" and to the backend owner.
- The demo key is typed into Settings and kept in the browser's localStorage. It is never written into a file in this folder.

## Running the demo monitor

Open `/monitor/` (standalone server) or `/app/monitor/` (backend server). Enter the API base URL and demo key in Settings. The monitor automatically follows the newest active simulator/iOS session. Choose a session in the picker to pin it, or use `?session=<id>`. The default view keeps the three session views and latest activity prominent. **Details** reveals session selection, backup playback, the full timeline and metrics; `?clean=0` opens that view directly. `?clean=1` keeps the clean view.

Keyboard: **F** document fullscreen (if allowed), **B** choose a local backup recording, **S** open details and focus the session picker, **H** toggle details. Backup files stay on the device and are permanently marked REPLAY; fake-AI mode is always labelled. Start a new simulator session to demonstrate automatic reattachment.

Verification: `node --test "web/tests/*.test.mjs"`. Hardware and three-metre checks still pending are recorded in `STATUS.md`.

## Reviewing a chef recording

Open `/review/` on the standalone server or `/app/review/` on the backend. Use the shared Settings to enter the API base and demo key. Recipes recorded and uploaded in iOS Chef mode appear automatically; `?recipe=<id>` opens one directly. Uploading/processing recipes update every three seconds while visible; the library refreshes every five seconds.

Review each step’s text, visible success criteria and known mistakes, with the shared lens preview beside the reference. Save each changed card before publishing. With source video available, pause on a clear moment and use **Use current frame**; ±0.1 s / ±1 s controls and numeric timestamps are also available. Published recipes hide the source video per the API contract; numeric re-picking still asks the backend to extract a still if it has the source.

The collapsed **Dev fallback: upload an MP4** is for pipeline testing. It requires consent and a non-empty MP4 up to 500 MB; it sends the raw video to the signed upload URL without the demo key. Retry keeps the existing recipe/upload link while valid. Upload state stays in memory: keep the tab open until processing starts. A connection change stops the current upload. Delete requires typing the saved title; the protected demo recipe cannot be force-deleted from this page.

Local fake-AI/memory verification with a generated test video is recorded in `STATUS.md`. A real chef-take review and production upload still need validation; do not use the generated test results as extraction-quality evidence.

## Glasses and browser setup

Simulator, Review and Monitor keep the same three navigation links, with the current page highlighted. **Glasses setup** on each tool opens the shared connection guide. Simulator also has **Connect this browser** and **How to use glasses** actions.

The browser cannot pair with the glasses. Pair them with an iPhone in the Meta AI app, then use the team’s Echo iPhone test build (`Settings → Glasses Lab → Register with Meta AI`). Choose Cook for a lesson or Chef to record one. Monitor follows that app’s session when both use the same backend and demo key. The guide records the prototype limits: physical-device validation and glasses audio routing are still pending, and no public iPhone download link exists yet.

A browser with no key shows **Connect this browser**, rather than **Key rejected**. Enter the private team demo key in Settings; it is never shipped in the website source. An entered key actually refused by the API still shows an error. The public homepage and brand gallery need no key.
