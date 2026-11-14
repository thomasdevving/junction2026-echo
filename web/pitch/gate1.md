# Pitch video + deck: Gate 1 package

> Status: **awaiting approval** from the deck/video owner (Aleksandr). Nothing has been generated: no audio, no ElevenLabs calls, no renders, no slides, no installs, no commits.
> Written 2026-11-14 from the repository state at `cf93919` and the documentation listed in §6.
> Companion files: [video/script.md](video/script.md) (VO + storyboard), [video/shot-list.md](video/shot-list.md), [deck/deck-outline.md](deck/deck-outline.md).

## 1. What the repository can back up today (read this first)

| Area | State on `main` today | Consequence for the film and deck |
|---|---|---|
| Real glasses | **Not tested.** Every DAT proof ran on MockDeviceKit only; "End-to-end runs on the glasses" is empty (`ios/STATUS.md:47-54, 87-89`) | "Runs on Meta Ray-Ban Display" is **not yet allowed**. The 40 s real block can only show what actually runs when it is filmed |
| Gemini check / watch | Real on production (`backend/STATUS.md:11-12`), but no frame of a real mistake has ever been checked (`ai/STATUS.md:12`) | "Catches the mistake" is shown by the footage, not asserted by VO, until AI-07 numbers exist |
| Gemini Live voice | Real token + protocol PASS 5/5, on **placeholder narration** (`ai/STATUS.md:13, 148-165`) | Allowed as "answers from the chef's narration" only once a real chef narration exists; until then the caption says "the recipe's narration" (claim C10) |
| Recipe extraction | Code done; one run on a stock clip, no chef take (`ai/STATUS.md:14, 229-243`) | Describe it as how it works; no quality claim |
| Evaluation numbers | **None.** `docs/EVALUATION.md` §4 is empty; `ai/eval/results/` does not exist yet; `ai/STATUS.md:247` "Nothing measured yet" | Evidence part uses named placeholders and has a no-numbers fallback line |
| Users / pilot | No sessions, no instructor conversation (`web/STATUS.md:103-107`) | "Proposed pilot"; no user quotes |
| Chef take | Not filmed (`ai/STATUS.md:178, 257`) | Beat 1 of the real block (chef records) needs a Chef-mode take on the glasses |
| Website hero | Already shows the sandwich card ("STEP 04 · SANDWICH / Add fillings"), labelled "ILLUSTRATIVE PREVIEW" (`web/index.html:39-44`). The screenshot with "Spread the rice" was an older build | Reusable as an Illustration shot as is |
| Real lens colours | SDK 1.0.1 display text is only `primary` / `secondary`: **no amber / green in the actual lens** (`ios/STATUS.md:49`). The web lens mock does use amber/green and the monitor labels it a reconstruction (`web/STATUS.md:51`) | Coloured lens cards appear only as "Lens view, reconstructed by the monitor" or inside UI graphics, never as through-the-lens footage |

## 2. (a) Claims table

Status: **allowed** = a source in the repo backs it today · **not yet** = allowed only after the named evidence lands · **placeholder** = a slot whose value does not exist yet.

| # | Claim (as it would appear) | Where used | Source | Status |
|---|---|---|---|---|
| C1 | "A chef records a recipe once through smart glasses; anyone wearing them can follow it hands-free" (product description) | VO intro, slide 2 | `docs/PRODUCT.md:9` | allowed (as a description of the product) |
| C2 | "The learner's camera sits where the chef's camera sat" | VO how, slide 3 | `docs/PRODUCT.md:32` | allowed (design fact) |
| C3 | "Built on Meta's Device Access Toolkit, iOS SDK 1.0.1" | slide 4, end card small print | `ios/STATUS.md:10` (pinned exact 1.0.1) | allowed |
| C4 | "Runs on Meta Ray-Ban Display" / "works on the glasses" | real-block label, slide 2 | `ios/STATUS.md:87-89` empty | **not yet**: needs one recorded end-to-end run in that table |
| C5 | "Gemini turns the chef's video into checkable steps" | VO how, slide 4 | `ai/STATUS.md:14` (`extract_recipe` real, `gemini-3.5-flash`) | allowed as "how it works"; no quality claim |
| C6 | "Gemini compares your view with the chef's reference: pass, fix, or can't tell" | VO how, slide 4 | `ai/STATUS.md:12`, `backend/STATUS.md:11` (real `/check`, three verdicts) | allowed |
| C7 | "A fast watcher looks for known mistakes" | VO how, slide 4 | `ai/STATUS.md:12`, `ios/STATUS.md:12` | allowed (exists); "catches mistakes" = **not yet** (no real mistake frame tested) |
| C8 | "Warns only after two confident hits in a row" | slide 6 (trust) | `ios/STATUS.md:12` (WatchDebouncer tests), API-CONTRACT §3.3 | allowed |
| C9 | "Gemini Live answers spoken questions; check and next work by voice" | VO how, slide 4 | `ai/STATUS.md:13, 150-163` | allowed (protocol runs with real tokens); on the phone `ios/STATUS.md:13` has not run on a device, so do not say "on the glasses" |
| C10 | "Answers come from the chef's own narration" | caption beat 4, VO how | `ai/STATUS.md:280` (placeholder narration) | **not yet** in this strong form: the narration is placeholder text, not a chef recording. Allowed wording now: "answers from the recipe's narration" |
| C11 | Model names: `gemini-3.5-flash-lite` (check, watch), `gemini-3.5-flash` (video), `gemini-3.8-live` (voice) | slide 4 small print | `ai/STATUS.md:26-29` | allowed |
| C12 | "Shows '● watching' whenever frames are sent" | VO trust, slide 6 | `ios/STATUS.md:12` (04.4 dot) | allowed (built; seen in simulator) |
| C13 | "The chef agrees before recording" | VO trust, slide 6 | `ios/STATUS.md:16` (consent required per take; not run on device) | allowed as a built feature; not shown as footage unless filmed |
| C14 | "Deleting a recipe deletes its video and everything derived from it" | VO trust, slide 6 | `backend/STATUS.md:35, 124`; `docs/ARCHITECTURE.md:192` | allowed |
| C15 | "When it can't see clearly, it says so instead of guessing" | VO trust, slide 6 | `ai/STATUS.md:293` (`unsure`), `ios/STATUS.md:11` | allowed |
| C16 | "Audio-only mode for glasses without a display" | slide 6 | `ios/STATUS.md:15` (IOS-07 NOT STARTED) | **not yet**: say "designed for", or drop |
| C17 | `/check` latency "about ⟨CHECK_P50⟩ s" | VO evidence, slide 5 | `backend/STATUS.md:57,61` has production p50 983–1254 ms, **n=2, placeholder frames**; `docs/EVALUATION.md:86` forbids any number not in §4 | **placeholder** `⟨CHECK_P50⟩` until it is in EVALUATION §4 |
| C18 | Detection: "caught ⟨X⟩ of ⟨Y⟩ mistakes on our held-out set (one recipe, ⟨N⟩ steps)" | VO evidence, slide 5 | `docs/EVALUATION.md:61-74` empty | **placeholder** `⟨X⟩ ⟨Y⟩ ⟨N⟩` |
| C19 | "False approvals: ⟨FA⟩ of ⟨Y⟩" | slide 5 | same | **placeholder** `⟨FA⟩` (must be shown if it exists, `EVALUATION.md:86`) |
| C20 | Voice answer latency "first audio in about ⟨LIVE_P50⟩ s" | slide 5 (optional) | `ai/STATUS.md:114` 594 ms n=5, laptop, not deployed | **placeholder** until in §4 |
| C21 | "Proposed pilot: one cooking class, one instructor, shared glasses" | VO who, slide 7 | `docs/PRODUCT.md:78` | allowed, worded "proposed" |
| C22 | "Tested with ⟨K⟩ people outside the team" | slide 5/7 | `web/STATUS.md:103-105` (none) | **not yet**; otherwise the slide says "not yet tested with users" |
| C23 | "Built this weekend at Junction 2026" | end card, slide 8 | git history, PLAN §1 | allowed |
| C24 | Prior work (AROMA) acknowledged when asked | Q&A only | `docs/PRODUCT.md:91` | allowed |
| — | Never: "first", "only", "works for any recipe", any unmeasured percentage | everywhere | `docs/PRODUCT.md:91` | rule |

## 3. (d) Lens recording: what I found

- **Meta's own "Record display" feature exists** (Meta help page "How to record your display on Meta Ray-Ban Display glasses"). Per Meta's help text as returned by search: one video combining the **glasses display, the POV camera, microphone and system audio**; start from the glasses (swipe left from display home → Display recording) or the Meta AI app (Glasses → Record display); **max 1 minute**; saved to the phone's camera roll; bystander LED on; a persistent recording indicator shows on the display. **One Meta page says it is currently available in the US only.** The help page body itself did not load in my fetch (cookie wall), so these points come from the search summary of that page, not a full read.
- **Unknown, must be tested on the device:** whether a third-party DAT app's display content appears in that recording; whether it is enabled in Finland; whether Developer Mode affects it.
- **DAT SDK:** `ios/STATUS.md` records no screen-capture API in 1.0.1, and the display DSL is the only way our app draws to the lens. The Meta docs MCP (`https://mcp.developer.meta.com/wearables`, `ios/README.md:41`) is not connected in this session, so I could not query it.
- **Recommended rung order** (details in the shot list): **0** native Display recording (best: true lens + POV in one file; test a 10 s clip the moment the glasses arrive) → **1** Chef-mode MP4 from the app (POV camera only) → **2** screen recording of `/app/monitor/` (frame + reference + lens reconstruction + timeline) → **3** tripod phone, third person → **4** phone filming through the lens (last resort). Film rungs 2 and 3 **every time** in parallel, so a rung-0 failure never costs a re-shoot.

## 4. (f) Tech proposal

### Renderer: zero-install, our own code
- **Chosen:** frame-by-frame HTML rendering with the method in the brief (one page per film, `window.renderFrame(t)` pure in `t`), driven by a ~150-line Node script that speaks the **Chrome DevTools Protocol** to the locally installed **Google Chrome 157.0.8103.78** (headless) over **Node 24's built-in `WebSocket`** (checked: `typeof WebSocket === "function"` on Node v24.11.1). Screenshots via `Page.captureScreenshot`; transparent overlays via `Emulation.setDefaultBackgroundColorOverride` (alpha 0). Encode with the installed **ffmpeg 9.0.2**.
  - Nothing to install, so it respects `web/`'s "no build step, no package install" rule. Licence: our own MIT code; Chrome and ffmpeg are tools on this laptop, not shipped in the repo.
- **Rejected: Remotion.** Its pricing page: free licence "For individuals and companies of up to 3 people"; a company licence is "Required if you do not qualify". We are a team of 4, so the free licence does not clearly apply, and it needs an npm install.
- **Not evaluated:** Motion Canvas (not needed given the above).
- **Fallback if CDP proves flaky:** `playwright-core` driving the same local Chrome (an npm install into `web/pitch/video/` only; version checked at that time; **asks you first**).

### Deck
- `deck/deck.html`: 8 slides at 1920×1080, same tokens and components, arrow keys to advance (usable live on stage, offline). PDF via the same CDP script (`Page.printToPDF`, 1920×1080 pages). No dependency.

### Fonts
- Manrope is **not installed** on this laptop; the website loads it from Google Fonts. For deterministic, offline renders I propose vendoring Manrope `.woff2` files (SIL Open Font License 1.1, licence re-read when downloading) into `web/pitch/shared/fonts/` with the licence file. **This is a download: I need your OK.** Alternative: load from Google Fonts at render time (needs network every render).

### Folder layout (everything inside `web/pitch/`)
```
web/pitch/
  gate1.md                 this file
  style.md                 Phase 3: tokens, type scale, components, motion rules
  shared/
    film-kit.js            clamp, brand ease, seg(), win(), headline mask-rise, label chips
    tokens.css             @import of ../../shared/ui.css (the website's exact values) + film/deck sizes
    arch-diagram.js        architecture diagram (SVG), animatable by t; used by film and deck
    lens-card.js           wraps ../../shared/lens.css so the lens looks identical to the app's web mock
    fonts/                 Manrope woff2 + OFL.txt (after your OK)
  video/
    script.md, shot-list.md
    film.html              all MG scenes; window.DURATION, renderFrame(t), ready
    overlay.html           transparent labels/captions for the real-footage block
    render.mjs             CDP renderer: ranges, 2–3 workers, resumable, contact sheets
    build.mjs              VO placement, concat, overlay, encode, ffprobe checks
    footage.json           manifest: beat → file, in/out, recorded date, rung
    .env.example           ELEVENLABS_API_KEY=
    audio/  footage/  frames/  out/     (gitignored)
  deck/
    deck-outline.md, deck.html, deck.pdf (commit if < 10 MB)
  .gitignore               audio/, footage/, frames/, out/, .env
```

### How the film is assembled
1. `film.html` renders two MG clips: **A** 0:00–0:15 and **B** 0:55–1:52 (frames → H.264).
2. The real block (0:15–0:55) is built from `footage.json`: each beat's clip trimmed with ffmpeg, scaled into a 1920×1080 layout (POV main + optional picture-in-picture), then `overlay.html` renders the persistent "Real footage · Meta Ray-Ban Display · recorded ⟨date⟩" chip and captions as transparent PNGs, overlaid with ffmpeg. Until footage exists, each beat is a **slate**: "PLACEHOLDER: real footage, beat X" plus the caption text, so timing and captions are reviewable now.
3. Concat A + real block + B. Hard cuts only into and out of the real block.
4. VO: one ElevenLabs file per MG part, placed at its timecode (`adelay` + `amix`), loudness-normalised (`loudnorm=I=-16:TP=-1.5:LRA=11`). Audio leads, picture follows: scene lengths are set from the measured clip lengths.
5. Checks: `ffprobe` duration ≤ **118.0 s** (hard fail above), loudness report, every label present (contact sheet), claims table still true.
6. **Footage swap later = replace files + edit `footage.json` + rerun `build.mjs`.** No scene code changes.

### VO (Phase 2)
- Endpoint `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`, header `xi-api-key`, body `text`, `model_id`, `voice_settings` (ElevenLabs API reference, read 2026-11-14). Output `mp3_44100_128` (default; 192 kbps and 44.1 kHz WAV need higher tiers).
- Model: **`eleven_v4`** (the models page calls it the highest quality and lists audiobooks). Fallback `eleven_multilingual_v2` (the docs call it the most stable for long-form).
- Candidates found with `GET https://api.elevenlabs.io/v2/voices` (`category=premade`, filters on `use_cases`, `accent`, `age`), aiming for: calm, warm, confident, mid-pitch, neutral international English, product-film narration. No IDs picked from memory.
- **Licence (official ElevenLabs billing doc):** free plan = use "non-commercially with attribution"; paid plans = commercial rights. See Q1.

### Output spec
1920×1080, 30 fps, H.264 (`-crf 17 -preset slow`, BT.709, yuv420p, `+faststart`) + AAC 192 kbps. No music unless you supply a track with a clear licence.

## 5. (g) Open questions for you

| # | Question | Why it matters | My default if you don't answer |
|---|---|---|---|
| Q1 | ~~Which ElevenLabs plan?~~ **Answered 2026-11-14:** Creator plan, `active`, 131,000 characters / month (read from the API). Paid plan = commercial rights, so no attribution is needed on the end card. Key in `web/pitch/video/.env.local` via the ElevenLabs CLI onboarding | — | — |
| Q2 | OK to download Manrope (OFL) into `web/pitch/shared/fonts/`? | Deterministic offline renders | Load from Google Fonts at render time |
| Q3 | Who films, when, and who is the chef? The chef take does not exist yet (`ai/STATUS.md:178`) | Beat 1 and the voice beat depend on it | Shot list assumes a teammate as chef, another as learner |
| Q4 | Ask at the Meta booth: is "Record display" enabled on the event pairs (Meta says US-only), and does a DAT app's display content appear in it? | Decides rung 0 | Plan for rungs 2 + 3, try rung 0 as a bonus |
| Q5 | You own `ai/`: will AI-07 put numbers (check latency, held-out counts) into `docs/EVALUATION.md` §4 before Sun ~07:00? | `EVALUATION.md:86`: no number in the deck before it is in §4 | Ship the no-numbers evidence line (script.md, part E) |
| Q6 | On stage: will we have the glasses, a board and bread for a live demo, or is the live part the monitor on our laptop? | The 3-minute talk's demo minute | Script uses a live check with the monitor; fallback plays the 40 s real block |
| Q7 | "Echo" final? (Q-12 still open in `web/STATUS.md:85`) | Name is one constant either way | Echo |
| Q8 | End card shows `github.com/thomasdevving/junction2026-echo`: OK? | Public link in a public video | Yes |
| Q9 | OK to add one line to `web/STATUS.md` recording that you took over the deck/video part of WEB-04/05 from Türker? | CLAUDE.md hand-over rule | Add it in the first commit you approve |
| Q10 | If no chef take exists in time, drop beat 1 (chef records) and give its 7 s to beat 2? | Real block must stay true | Yes, with the caption changed |

## 6. Sources read in Phase 0

Repo: `CLAUDE.md`, `docs/PRODUCT.md`, `docs/DEMO-AND-SUBMISSION.md`, `docs/EVALUATION.md`, `docs/ARCHITECTURE.md`, `docs/EVENT-CONTEXT.md`, `docs/PLAN.md`, `ios/STATUS.md`, `ios/README.md` (MCP lines), `ai/STATUS.md`, `ai/fixtures/sushi_recipe.json` (now the sandwich), `backend/STATUS.md`, `web/STATUS.md`, `web/PRODUCT.md`, `web/index.html`, `web/shared/ui.css`, `web/shared/lens.css`, `web/tasks/04`, `web/tasks/05`, `web/pitch/submission-draft.md`. `ai/eval/results/` does not exist.

Web (2026-11-14): Meta help "How to record your display on Meta Ray-Ban Display glasses" (search summary only; page body blocked by a cookie wall); ElevenLabs API reference (text-to-speech convert, voices search `/v2/voices`, models overview); ElevenLabs billing doc (free plan: non-commercial with attribution); Remotion licence pricing page.

Machine: Chrome 157.0.8103.78 at `C:\Program Files\Google\Chrome\Application\chrome.exe`; Node v24.11.1 with global `WebSocket`; ffmpeg 9.0.2; Python 3.13.13; Manrope not installed.
