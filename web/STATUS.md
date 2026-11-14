# `web/` status

> Updated by the track owner after every batch. Also the live state of the demo and submission checklists from docs/DEMO-AND-SUBMISSION.md. Write only what was done and observed.

## Batches

| # | Batch | Status | Date / commit | Notes |
|---|---|---|---|---|
| 01 | Foundation and simulator | PARTIAL | 2026-11-14 | 01.1–01.5 pass against BE-01 in **fake mode** (memory store, `ai_mode: fake`). 01.6 first real loop not run: needs the backend on real Gemini (BE-03.1). Webcam path built but not yet tried by a person with a real camera. Details below. |
| 02 | Review page | PARTIAL | 2026-11-14 | WEB-02.1–02.4 implemented and verified locally with fake AI, memory storage and generated MP4; 33 web tests pass. Real chef-take review (02.5), production upload and Safari remain pending. |
| 03 | Demo monitor | PARTIAL | 2026-11-14 | WEB-03.1–03.5 implemented; 23 web tests pass; local fake-AI/memory browser verification below. WEB-03.6 needs a real iOS session; three-metre readability and physical wake-lock behaviour need a human. |
| 04 | User evidence and pitch pack | BLOCKED (finalization) | 2026-11-14 · sources checked at `4f146ff` | User scope: WEB-04 final using AI-07 results and IOS-06 device facts; no demo work. AI-07 results are absent and IOS-06 has no hardware validation. Details below. |
| 05 | Demo ops and submission | PARTIAL | 2026-11-14 | 05.4 run sheet drafted (`pitch/run-sheet.md`, unknowns marked ⟨fill⟩, not yet used by a teammate). 05.6 secret scan and image check done (below); README and LICENSE not touched (need owners' agreement and Q-08d). Submission text drafted in `pitch/submission-draft.md`. 05.1, 05.2, 05.3, 05.5, 05.7, 05.8 need a human. |

Status words: `DONE`, `DONE (fake)`, `PARTIAL`, `BLOCKED`, `NOT STARTED` (defined in docs/PLAN.md §8).

## WEB-01 verification (2026-11-14, fake mode)

Run against `backend/` at commit 14a8623 on `localhost:8000`, `STORAGE=memory`, `ECHO_AI_FAKE=1`, in the Claude desktop app's built-in Chromium. Served both from the backend (`/app/`) and standalone (`python -m http.server 5173`, cross-origin). All results below are **fake-mode**; no Gemini call was made.

| Criterion | Result |
|---|---|
| `node --test "web/tests/*.test.mjs"` | 11/11 pass (Node 24) |
| Landing page shows `ai_mode` and `storage` | Pass: strip shows `ai_mode fake`, `storage memory`, contract 2.0, red "Fake AI" |
| Wrong or missing key | Pass: strip shows "Key rejected" + "Open settings"; recipe list explains the key problem |
| API down | Pass: strip shows "API unreachable"; a check shows "No connection" |
| `?gallery=1` renders every lens kind | Pass: 12 cards (step ×4 watch states, checking, pass, fix, proactive fix, unsure, notice, done, recipePick) |
| "Spread rice": 1st check fix, 2nd pass + auto-advance | Pass: fix "Too much rice" (751 ms server), then pass, advanced to step 4 after 2 s |
| Nearly black tiny JPEG gives "Can't tell" | Pass (782-byte frame), returns to the step after 4 s |
| Step change during a slow check discards the result | Pass: `/check` delayed 3 s in the page, moved to step 5 mid-flight; the step-4 `fix` arrived and was ignored |
| Watcher warns after the fake's 4th and 5th calls, not before | Pass: calls 1–3 ok, 4 warn (no alert), 5 warn → amber "Spotted" card, `warning_shown` posted |
| No overlapping watch requests | Pass: 0 overlaps; gaps between end and next start 2.6–3.7 s at the 2.5 s setting |
| Dismiss mutes the id for 20 s | Pass: `warning_dismissed` posted; later `rice_too_thick` warns inside 20 s raised nothing |
| Ignored warning dismisses itself after 12 s | Pass: 12.0 s, posted as `warning_dismissed` |
| Watch errors are silent; 3 in a row pause 15 s | Pass: dot "offline", line "Watcher paused for 15 s after three errors" |
| Done card from `GET /sessions/{id}` summary | Pass |
| Phone width (375 px) | No horizontal scroll |

Not verified: webcam capture with a real camera and a person; speech output by ear; Safari; the deployed HTTPS URL.

## Visual refresh (2026-11-14)

User-requested Meta-inspired visual treatment implemented within `web/`: glass panels, white text and Manrope. The final hero copy is “Cook from the chef’s point of view.” A generated blue titanium material is confined to the hero; shared page backgrounds and tool cards keep their earlier styling.

The final transparent PNG is an image-tool cutout of the user-identified floating-glasses photo, flipped horizontally toward the left-hand headline. The original crossed open temples are retained, with readable Ray-Ban lettering on the viewer-left lens. The final user-requested correction removes the band and shifts the larger glasses left toward the hero centre, retaining cool blue-silver reflections. The recipe preview follows the sandwich fixture’s step 4, “Add fillings,” with a clearer tilt and restrained skew. An earlier quality rerender was rejected for reducing lens clarity. The subsequent resolution correction uses a tightly framed 1774×887 transparent render, with roughly 1.7 times as many pixels across the product as the earlier padded cutout. It is mapped into the same fixed hero composition; vector card lettering remains proportional. A generated sandwich-filling thumbnail appears in a glowing illustrative card with a restrained tilt and skew. The glasses and card are now one fixed SVG composition, so the lettering scales uniformly with the product instead of being stretched by a responsive projection. The glasses are slightly smaller. No person, product blending or duplicate frame layer is used. The simulator's actual lens renderer retains its black display background and status colours.

Observed in shared Chromium during the visual refresh: desktop home and simulator render; simulator links navigate; settings opens and closes; a narrow viewport stacks the hero and cards and keeps the simulator header and camera controls within the screen. Review was labelled Coming soon at that point; WEB-02 below replaces it with the review workspace. Monitor is linked after WEB-03 implementation. Backend availability is reported by the existing shared status strip. The earlier projected card was checked at desktop and narrow phone-sized widths; the replacement fixed composition was also observed in desktop Chromium. The dynamic projection and resize observer have been removed. The static server responds HTTP 200 at localhost:5173 in the cloud workspace. No cooking-session or real-camera verification was performed for this visual-only change.

## Echo branding and homepage follow-up (2026-11-14)

The user selected the first design from the second logo batch: three concentric open circular arcs. Its smaller symbol is used in the home, simulator and monitor headers. SVG marks and wordmarks are available under `assets/logos/`, with a download gallery at `brand/`. The later chain-logo upload and background-removal request were cancelled; that image was not processed or used.

The homepage now explains reference-led steps, checks and known-mistake watching, contextual voice questions, and the current simulator/monitor capabilities. The Review workspace is added in WEB-02 below; real chef-take and physical-glasses validation remain pending. Entrance, scroll-reveal and gentle glasses-float animations respect reduced-motion preferences. The lens card is part of `assets/hero-glasses-scene.svg`, retaining its text proportions during resizing.

Observed in shared Chromium: selected smaller arc mark, complete desktop hero, and revealed workflow/feedback sections. Existing 23 web tests pass; no new real-camera or hardware claim is made.

## WEB-02 verification (2026-11-14, fake mode)

Implemented `review/` with the existing API contract, shared Settings, status strip and lens renderer. The library follows recordings from Chef mode or another client, with five-second refresh and three-second polling for uploading/processing recipes; polling pauses while hidden. Cards preserve unsaved edits during library refresh, validate lens word limits and known mistakes, and save individually. Metadata edits, source video seeking (±0.1/±1 second), reference-frame selection, numeric fallback, transcript, publish and typed-title deletion are included. The MP4 dev fallback requires consent, validates format/size, uses a raw signed PUT without the demo key, and retries the same recipe/link. Configuration changes abort an in-flight upload and ignore stale responses. Source video is labelled recorded / REPLAY; the connection/fake-mode strip remains visible while scrolling.

The homepage now links Review and explains how a lesson is made: the chef wears the glasses once while demonstrating and narrating the recipe, Gemini drafts the steps, the chef reviews before publishing, and learners follow that method. The prototype note keeps the distinction between this workflow and the still-unvalidated real chef take.

Verification observed in this session:

- `node --test web/tests/*.test.mjs`: **33/33 pass** (23 existing plus 10 review tests). Syntax and `git diff --check` pass. New tests cover consent/MP4/size validation, word and numeric limits, stable unique mistake IDs, duplicate/blank watch-fors, independent drafts, signed reference URLs, authenticated API shapes and unsigned upload headers/progress/abort/errors.
- An isolated local BE-07 server ran on `localhost:8101`, **`ECHO_AI_FAKE=1`, `STORAGE=memory`**, with its own data directory. A generated 160-second colour-pattern MP4 was used; no person, chef footage, production mutation or Gemini request was involved.
- DOM integration walk-through (temporary jsdom harness, real local HTTP/XHR): missing consent makes no create call; MP4 PUT sends only its Content-Type header; upload → processing → review completes without a page reload. Five-word title makes no PATCH; valid text and added watch-for persist in backend reads, with ID fixed after saving. Metadata persists; publishing adds the recipe to `GET /recipes?status=published` (the simulator’s picker source). Typed-title deletion removes the disposable recipe (subsequent GET 404).
- Re-picking a numeric timestamp changes the actual JPEG byte hash returned by ffmpeg, and the reference preview gets a cache-busting parameter. `422` for a timestamp beyond the source video is displayed beside the step. List refresh preserves unsaved text and blocks publish until saved.
- Failed PUT is retried using the same recipe/upload URL, with no duplicate create. Library, pending-status and shared health polling make no new calls while hidden and resume on visibility. Protected-demo deletion returns its refusal without offering force-delete. A recipe created by another client appears automatically; invalid MP4 content reaches `failed` and shows the backend’s “not a readable MP4” reason. Wrong-key Settings state recovers after restoring the local test key. The integration runs reported no DOM runtime exceptions.
- Shared Chromium: desktop metadata, source video, step/reference/lens layout and Settings render. The generated source video decodes and displays. Clicking **+1 s** then **Use current frame** changes the saved time from 12 to 1 second and visibly updates both the reference and lens image, showing “Step saved”. Reload retains it. Narrow effective viewport (~400 CSS px via zoom) switches to the stacked layout; no horizontal scrollbar observed. Homepage chef-records-once copy renders.

Not verified: real Gemini extraction through this page, production signed-video upload/CORS, Safari, actual iOS Chef-mode ingestion, or a real chef reviewing the results. WEB-02.5 processing/review time, number of hand edits and re-picked frames on a **real take** are therefore not measured; generated-video checks are not substitutes. Batch remains PARTIAL.

## WEB-03 verification (2026-11-14, fake mode)

Implemented `monitor/` using the existing session/monitor API, shared settings, shared lens renderer and status strip. One-second feed polling never overlaps; discovery checks every five seconds, follows new sessions, respects a picker or URL pin, and pauses while hidden or playing backup video. Last good data stays visible on connection loss. The actual lens panel remains black and is explicitly labelled as a reconstruction. Frame URLs are changed only when `last_frame_at` changes, preserving signed query parameters.

The local backend ran on port 8100 with `ECHO_AI_FAKE=1`, `STORAGE=memory`, isolated data under `/tmp`, and the sandwich fixture. No Gemini, production database or physical glasses were used.

- `node --test "web/tests/*.test.mjs"`: **23/23 pass**. Covers reconstruction precedence and expiration, stale-step results, LIVE/IDLE/OFFLINE/REPLAY boundaries, signed frame URL handling, session switching/pinning, no overlapping slow polls, and hidden/replay pause behaviour.
- Shared Chromium: started the sandwich recipe in the simulator in another tab; the monitor attached automatically. Restarted the simulator and selected the recipe again; the monitor moved to the new session and cleared old frames/events.
- Local API-driven watcher/check requests on the simulator session: `ok` watcher results, a `Filling piled up` warning, check fix, and check pass appeared in the feed/timeline. The warning/reference/fix lens reconstruction and portrait frames rendered correctly. The transient three-second pass window is covered by the unit tests; no screenshot timing measurement is claimed.
- Stopped the local backend: the badge became OFFLINE, retaining the reference, wearer frame, lens card, timeline and metrics. Restarted the backend and simulator, then confirmed fresh attachment.
- Backup playback: selected a local synthetic four-second MP4; the persistent `REPLAY — recorded …` badge stayed visible through playback and at the end, with the fake-AI banner retained. Native video-only fullscreen is removed in favour of document fullscreen controls so labels stay in the page.
- Desktop/laptop view fits one screen; portrait media is uncropped on black. `?clean=1` and H hide/show details; B opens backup. Fullscreen request is wired to F but was not observed entering fullscreen in the managed browser. Wake Lock is optional and denial is handled; actual sleep prevention is not verified.
- Homepage Monitor card now opens the monitor. Simulator recipe buttons wrap the longer sandwich title.

Pending: actual iOS/glasses session (WEB-03.6), observed end-to-end delay on hardware, comparison with the iPhone lens preview, readability from three metres, Safari, and real camera use. Batch remains PARTIAL until those acceptance checks are run.

## Public homepage connection and app entry (2026-11-14)

The public homepage and logo gallery now probe `/health` only. They no longer query the private recipe library or show “Key rejected” merely because a visitor has not entered the demo key. Healthy real-AI service reads **Service online**; fake and offline states remain explicit. Simulator, Review and Monitor still verify the key-protected library. Failed library requests no longer appear as live; settings changes and newer probes supersede older status responses. No key was embedded and no backend access rule was changed.

The header and hero both have **Open web app** links to the browser cook-along (`sim/`), with a browser-demo note. The technical Simulator label remains in the tools section.

Verification: **37/37 web tests pass**, including public health without a private-library request, retained tool-key checks, fake/offline warnings and library-failure reporting. Real production `/health` is public; private tool use still requires the team’s demo key in Settings.

## Tool navigation, setup and monitor follow-up (2026-11-14)

Simulator, Review and Monitor now retain all three tool links, including the active page, with shared header/navigation typography. The Review link no longer disappears on arrival. A shared **Glasses setup** guide explains Meta AI pairing, the Echo iPhone test build’s actual `Settings → Glasses Lab → Register with Meta AI` path, Cook mode, and using the same server/demo key for Monitor. Simulator has an introductory connection step. The guide does not claim browser pairing or verified physical hardware; it states the current test-build and phone-audio limits.

A missing key is now a distinct **Connect this browser** state with a Settings action. The tools do not query private recipe/session data until a key is entered. An entered key refused by the API still reports rejection. No key was embedded or backend rule relaxed. Shared Settings now uses standard named form controls.

Monitor defaults to the three session views and one latest-activity strip. **Details** / H reveals session selection, backup controls, the full timeline and metrics; S also reveals/focuses the picker. `?clean=0` opens details, while `?clean=1` preserves the default. Live/offline/replay state, the fake-AI banner, lens reconstruction label and shared status strip remain visible. Main panel labels and captions are larger, while ordinary camera-status copy omits latency telemetry in clean mode.

Verification: **38/38 web tests pass**. Temporary DOM integration against the isolated fake-AI/memory backend checks identical persistent navigation/current-page state on all three tools, guide → Settings handoff, missing-key state, and Monitor’s clean/details/H/S behaviour with an actual local fake session feed. No production mutation or physical-glasses run was performed. Native Chromium observed the Simulator intro/header and full glasses guide, connected Monitor through shared Settings to the local fake backend, displayed the clean three-view layout and latest correction, verified readable media plus scrollable details, and confirmed that opening Review leaves its selected tab visible.

## WEB-04 finalization dependencies (2026-11-14)

Scope confirmed by the web owner: finalize WEB-04 using AI-07 numbers and IOS-06 device facts. Pitch slot: **3 minutes** (user-confirmed; not independently checked with organizers). The user confirmed that no external user sessions or instructor conversation have happened. **Not yet tested with users. No instructor conversation happened.** Any pilot remains a proposed pilot.

Checked the latest GitHub `main` at `4f146ff`:

- `ai/STATUS.md` → AI-07 is PARTIAL; “Results” says **“Nothing measured yet.”** There are no committed runs under `ai/eval/results/`. Held-out verdict counts, false approvals, ablation results and watcher evaluation cannot be inserted into a final pitch. Earlier development latency measurements are not AI-07 accuracy results.
- `ios/STATUS.md` → IOS-06 is **“PARTIAL (code + logic tests only; no glasses, no Xcode build)”**. Glasses model/firmware are blank and the end-to-end glasses run table is empty. MockDeviceKit results from IOS-02 cannot be presented as IOS-06 hardware facts. Audio through the glasses is not implemented per the IOS-06 row.

WEB-04 is blocked on those final inputs. No demo, recording, fabricated metrics or hardware claims were created. The existing pitch drafts are not marked final. Once the owning tracks publish the results and device run, copy their dated conditions and limits into the evidence sheet and claims audit before signing off the pitch.

## Submission

| Item | State | When / by whom | Link or note |
|---|---|---|---|
| Preliminary submission (Fri night) | Not missed (per Türker, 2026-11-14) | ⟨fill: time and who submitted⟩ | Text kept in `pitch/submission-draft.md` |
| Challenges selected on the platform: Meta main + Gemini technology | NOT DONE | | |
| Final submission | NOT DONE | | |
| Confirmation saved | NOT DONE | | |

## Open questions for organizers and partners

| # | Question | Answer | Source / when |
|---|---|---|---|
| Q-07 | What does the preliminary submission require, and by exactly when (23:55 or 23:59)? | — | |
| Q-08a | Final submission fields? Is a video required; maximum length? | — | |
| Q-08b | Pitch length and format for partner judging, peer review, and the final? | — | |
| Q-08c | Must the repository be public? Rules on code written before the event? Edits after the deadline? | — | |
| Q-08d | Is the MIT licence required for the repository? | — | |
| Q-09 | Are cooked food and knives allowed at the stand and on stage? | — | |
| Q-10 | A cooking instructor or school we can talk to before Sunday? | — | |
| Q-12 | Final product name (repository is `statai`) | **Echo** (was "Ghost Chef"); renamed in every folder | Team, 2026-11-14 |

## Demo kit

| Item | Have it? | Who brings it |
|---|---|---|
| Cooked sushi rice (enough for ~15 attempts) | — | |
| Nori (20+ sheets) | — | |
| Bamboo mats ×2, cling film | — | |
| Filling (cucumber sticks), bowl of water | — | |
| Dark matte surface, small light | — | |
| Wet wipes, paper towels, gloves | — | |
| Tripod / second phone for recording | — | |
| Power bank, cables, hotspot phone | — | |
| External screen or laptop for the monitor | — | |

## User evidence

| Date | Who (role only) | What they used | Completed unaided? | Notes file |
|---|---|---|---|---|
| — | — | — | — | — |

Pilot conversation: none yet.

## Rehearsals

| Date / time | Operator | Wearer | Device | Clean? | What went wrong |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

Backup recording: none yet.

## Claims audit (before the deck is final)

| Claim in the deck | Source file and value | OK? |
|---|---|---|
| — | — | — |

## Repository checks (WEB-05.6, 2026-11-14 01:20)

- Secret scan: `git log --all -p | grep -n -i -E "service_role|api[_-]?key\s*=|AIza|secret"` over all branches. Every hit is code that reads a key, an empty `.example` value, or a test placeholder (`dev-key`, `replace-me`, `secret-demo`). No real key, no `AIza`, no `service_role` value. **Clean.** Re-run before the final submission.
- Committed images: only the 12 generated step placeholders (`ai/fixtures/images/`, `ios/Echo/Resources/Fixtures/images/`, made by `ai/scripts/make_placeholders.py`). No faces or bystanders. `ai/eval/frames/` and `web/pitch/` hold no images yet.

## Needs from other tracks

- WEB-02.5: iOS/AI owners to provide one consented real chef take, uploaded in Chef mode or identified as the MP4 fallback, so extraction and human review can be measured on real material.
- WEB-04 final: AI owner to publish AI-07 measured results (set sizes, verdict/false-approval counts, ablation and watcher results, model IDs, date and conditions); iOS owner to publish IOS-06 real-device model/firmware, what actually ran and its limitations. Finalization is blocked until these exist.
- WEB-03.6: iOS owner to run one real session while the monitor is attached; compare the reconstructed lens to the phone preview and record observed delay/mismatches. A human should also check the monitor from three metres away.

## Browser sign-in (2026-11-14)

Added a shared **Sign in** dialog for the user-requested demo login code. Same-origin Simulator, Review and Monitor restore an expiring HttpOnly session after reload; login codes/API credentials are not returned by the auth API or persisted by this flow. Advanced connection settings retain manual API-key access for separate development servers. Sign-out clears the browser session and legacy saved key. Public homepage health remains accessible without signing in.

Observed: **40/40 web tests pass**, including cookie-flow request options, no secret persistence, session restoration, signed-out connection state and legacy cross-origin header compatibility. Chromium on the isolated `localhost:8102` fake-AI/memory server successfully signs in with Enter, opens the sandwich lesson and restores it after reload. Fake mode remains visibly labelled. Backend auth/security tests pass 34/34. No production recipe, real Gemini or hardware validation is implied.
