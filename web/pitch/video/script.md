# Pitch video: VO script and storyboard (Gate 1 draft)

> Part of the [Gate 1 package](../gate1.md). Planned length **1:52**, hard limit **1:58** (ffprobe). Audio leads, picture follows: once the VO is generated and measured, scene lengths follow the clips. If the VO runs long, parts may stretch up to a total of 1:56, never more.
> VO pace assumed: 145 words per minute (2.42 words/s). Claim ids (C1…C24) refer to the claims table in [gate1.md §2](../gate1.md#2-a-claims-table).

## 0. v1 as built (Phase 4, 2026-11-14)

Measured, not estimated: VO by **Eric** (`eleven_v4`), sentence pauses lengthened by 0.32 s in post (`build.mjs`), picture cued to word timestamps from ElevenLabs (`timing.json`).

| Part | Slot | VO (paced) |
|---|---|---|
| A | 0:00.0–0:15.0 | 11.68 s from 0:00.6 |
| B | 0:15.0–0:55.0 | none (placeholder slates, labelled "Placeholder") |
| C | 0:55.0–1:20.0 | 21.52 s from 0:55.6 |
| D | 1:20.0–1:32.0 | 10.32 s from 1:20.5 |
| E (E2) | 1:32.0–1:42.0 | 8.16 s from 1:32.5 |
| F + end card | 1:42.0–1:54.5 | 9.68 s from 1:42.4 |
| **Total** | **1:54.5** (limit 1:58) | |

Changes from the storyboard below, made while building: part C opens straight on the diagram with the headline "Four jobs for Gemini." (the two-frame intro needs real stills; it comes back with the footage); D adds the headline "It tells you when it can't tell."; E adds "Wrong approvals come first."; the end card is part of F. The placeholder block is labelled "Placeholder · real footage from the glasses goes here", never "Real footage".

## 1. Timeline at a glance (Gate 1 plan)

| Part | Time | Length | Type | VO words / budget | Est. VO length | Peer-review criterion it serves |
|---|---|---|---|---|---|---|
| A. The moment | 0:00–0:15 | 15 s | Motion graphics | 33 / 35 | 13.7 s | Impact (a real, common problem) |
| B. Real footage | 0:15–0:55 | 40 s | Real footage + overlay | none (captions + live audio) | — | Implementation (it runs) |
| C. How it works | 0:55–1:20 | 25 s | Motion graphics | 51 / 60 | 21.1 s | Innovation (the chef's view as the reference) + Implementation |
| D. Trust | 1:20–1:32 | 12 s | Motion graphics | 26 / 30 | 10.8 s | Meta: UX, accessibility, trust |
| E. Evidence | 1:32–1:42 | 10 s | Motion graphics | 20 / 25 | 8.3 s (+ numbers spoken) | Implementation (measured) |
| F. Who + next | 1:42–1:52 | 10 s | Motion graphics | 24 / 25 | 9.9 s | Impact + feasibility (pilot path) |
| **Total** | | **1:52** | | **154** | **~64 s of VO in 77 s of MG** | |

## 2. VO script

**A. The moment** (33 words)
> Your hands are full of bread and filling. The recipe video keeps playing, but it can't see your board. It can't tell you the filling is piled in the middle. This is Echo.

Claims: C1 (problem framing, `docs/PRODUCT.md` §2).

**C. How it works** (51 words)
> Here's how. The glasses stream what the cook sees to the phone. Gemini turns the chef's video into checkable steps. It compares the cook's view with the chef's reference frame: pass, fix, or can't tell. A fast watcher looks for known mistakes. And Gemini Live answers questions from the chef's narration.

Claims: C2, C5, C6, C7 (exists, not "catches"), C9. "From the chef's narration" here describes the design (Live is grounded in the recipe transcript); it is not a claim about the filmed demo (that is C10, handled by the beat-4 caption).

**D. Trust** (26 words)
> It shows when it's watching. The chef agrees before recording, and can delete everything. And when it can't see clearly, it says so instead of guessing.

Claims: C12, C13, C14, C15.

**E. Evidence**, two versions; which one ships depends on [gate1 Q5](../gate1.md#5-g-open-questions-for-you)

E1, with numbers (20 words; every ⟨slot⟩ must first appear in `docs/EVALUATION.md` §4):
> On our held-out test, Echo caught ⟨X⟩ of ⟨Y⟩ mistakes and wrongly approved ⟨FA⟩. A check takes about ⟨CHECK_P50⟩ seconds.

E2, no numbers yet (20 words):
> We built an evaluation that counts wrong approvals and response time. The method and its limits are in our repository.

Claims: E1 → C17, C18, C19. E2 → AI-07 tooling exists (`ai/STATUS.md:15`).

**F. Who + next** (24 words)
> Echo is for anyone learning a chef's dish with their hands busy. Next: a proposed pilot with one cooking class, then other hands-on skills.

Claims: C21; "next" is labelled on screen.

**Voice audition line (Phase 2):** the whole of part A (33 words, ~14 s). It has a problem statement, a turn and the product name, so it shows warmth, pacing and how the voice lands a name.

## 3. Storyboard

Global rules for every MG frame: background = the website gradient (`web/shared/ui.css` body), Manrope, white headlines with one light-blue gradient accent phrase, uppercase eyebrow with ring dot, glass cards (surface + hairline, 28 px radius), brand ease `cubic-bezier(0.16, 1, 0.3, 1)` on every move, nothing snaps. Few elements per frame, big type, lots of air. Safe area: 96 px on all sides. Label chips sit bottom-left, 22 px uppercase letter-spaced, mist on a dark glass pill.

### A. The moment (0:00–0:15)

| Time | On screen | Motion | Labels |
|---|---|---|---|
| 0:00–0:05 | Line-art illustration (2 px mist strokes, sky accents): two hands over a board, two bread slices, a phone propped on a jar showing a play icon. Eyebrow: "THE MOMENT" | Strokes draw on (path length by `seg`), slow drift to 1.02 scale | `Illustration` |
| 0:05–0:11 | The phone's line of sight drawn as a dashed sky line that ends short of the board in a small "?" ring. Top-down glyph of a slice with the filling heaped in the centre; its bare edges outlined in amber. Headline rises in: "The video can't see **your board.**" (accent on "your board.") | Words rise through masks, stagger 0.06 s; amber outline pulses once (opacity, not scale) | `Illustration` |
| 0:11–0:15 | The heaped slice splits gently along a diagonal (falls apart). A soft light streak sweeps left to right and reveals the logo **echo.** (ring mark + blue period) and the tagline "Cook from the chef's **point of view.**" | Streak 0.8 s; logo fades and rises 12 px; tagline words rise | — |
| 0:15 | **Hard cut** into the real block | | |

### B. Real footage (0:15–0:55)

Layout (1920×1080): left, the POV panel (portrait 9:16 frame, 900 px tall, glass card); right, a second panel for the lens view or the tripod shot; captions bottom-right in 44 px Manrope 700, max two lines, white on a dark glass pill. Persistent chip top-left for the whole block: **REAL FOOTAGE · META RAY-BAN DISPLAY · RECORDED ⟨date⟩**. If a beat uses the monitor's lens reconstruction, that panel carries **Lens view, reconstructed by the monitor**; if it uses Meta's display recording, **Lens view, recorded on the glasses**. Nothing is sped up; a beat that must be shorter is trimmed, not accelerated. Placeholder version: each beat is a slate "PLACEHOLDER: real footage, beat X" with its caption, so timing can be reviewed now.

| Beat | Time | Shows | Caption | Audio |
|---|---|---|---|---|
| 1 Chef records | 0:15–0:22 (7 s) | Chef's POV in Chef mode: lens "● REC 00:42", pinch → "Step 4 marked" | "The chef cooks once, wearing the glasses. A pinch marks each new step." | Chef's live voice, low |
| 2 Mistake → catch → fix | 0:22–0:38 (16 s) | Learner's POV: ham and cheese piled in the middle, bare bread around it → the warning appears with the chef's reference → they spread it to the edges | 0:22 "A first-timer piles the filling in the middle." · 0:27 "Echo compares the view with the chef's reference, and speaks first." · 0:33 "One instruction. They spread it to the edges." | The app's spoken sentence, full volume: "The filling is all in the middle — spread it out so it reaches the edges of the bread." (fixture string, step 4) |
| 3 Check → pass | 0:38–0:48 (10 s) | Pinch or "check" → "Checking…" → ✓ "Looks right" + chime | "They ask it to check. It passes." | Chime + spoken pass |
| 4 Question | 0:48–0:55 (7 s) | Learner asks aloud; mic icon; answer caption | "They ask. The answer comes from the chef's own narration." | Question "Where should the cheese go?" + spoken answer ("The chef says the cheese should reach the edges…") |
| — | 0:55 | **Hard cut** out | | |

Caption rule (C10): beat 4 says "the recipe's narration" while the narration is the placeholder text; it becomes "the chef's own words" only if a real chef narration is in the fixture when we film. Fallback if the watcher does not fire on camera: beat 2 shows the wearer asking for a check, which returns the fix, and caption 0:27 becomes "They ask Echo to check. It compares the view with the chef's reference." Never stage a warning that did not happen.

### C. How it works (0:55–1:20)

| Time | On screen | Motion | Labels |
|---|---|---|---|
| 0:55–1:01 | Eyebrow "HOW IT WORKS". Two portrait frames side by side in glass cards: **Chef's reference** (still from the chef take) and **Cook's view** (still from beat 2). Headline: "Same view as **the chef.**" | Cards slide in from the sides 40 px; headline words rise | `Real frames` (if from the footage) |
| 1:01–1:20 | The frames shrink into the diagram's first node. Architecture diagram, max 10 boxes: **Glasses** → **iPhone app** → **Backend** (FastAPI) → **Gemini**; **Supabase** below the backend; a separate line **iPhone app → Gemini Live** (the phone opens Live with a short-lived token). Four Gemini job chips light up in sync with the VO: 1:04 "Video → steps", 1:08 "Your view vs the chef's: pass · fix · can't tell", 1:13 "Watcher: known mistakes", 1:16 "Live voice" | Nodes and links draw on along the data flow; each chip gets a sky glow when its VO line starts and dims to resting state after | Small print bottom: "Gemini 3.5 Flash · 3.5 Flash Lite · 3.8 Live" (C11) |

### D. Trust (1:20–1:32)

| Time | On screen | Motion | Labels |
|---|---|---|---|
| 1:20–1:24 | Eyebrow "TRUST". Glass card: green dot + "● watching" (how the cook knows) | Card rises; dot breathes once | — |
| 1:24–1:28 | Second card: "Consent before recording" + "Delete removes the video and everything made from it" | Rises beside the first | — |
| 1:28–1:32 | Third card: a lens card in the web-mock style showing "Can't tell" + "Look at the board" (sky tone, icon + words, not colour alone) | Rises; the first two dim slightly | `Lens view, illustration` |

### E. Evidence (1:32–1:42)

| Version | On screen | Labels |
|---|---|---|
| E1 (numbers) | Eyebrow "MEASURED". Three large counts in Manrope 800: "⟨X⟩ of ⟨Y⟩ mistakes caught", "⟨FA⟩ wrong approvals", "~⟨CHECK_P50⟩ s per check". Small print under them: "One recipe · ⟨N⟩ steps · held-out set · our own footage · measured ⟨date⟩" | Counts written exactly as in EVALUATION §4; no percentages |
| E2 (no numbers) | Eyebrow "HOW WE MEASURE". Two cards: "Wrong approvals: the error that matters most" and "Response time from the deployed backend". Small print: "Method and limits: github.com/thomasdevving/junction2026-echo" | — |

Counts reveal with a short number roll (pure function of `t`, ends exactly on the value).

### F. Who + next (1:42–1:52)

| Time | On screen | Motion | Labels |
|---|---|---|---|
| 1:42–1:47 | Headline: "For anyone learning **a chef's dish.**" Under it a glass card: "PROPOSED PILOT · one cooking class · one instructor · shared glasses · measured by instructor interventions per student" | Headline rises; card rises | `Proposed`, not a partnership |
| 1:47–1:49 | Chip **NEXT**: "Other hands-on skills" | Fades in beside the card | `Next` |
| 1:49–1:52 | End card: **echo.** logo, "Cook from the chef's point of view.", "Built at Junction 2026", `github.com/thomasdevving/junction2026-echo`, and "Voice: ElevenLabs" if the free plan is used (gate1 Q1) | Everything else fades out; the logo settles last | — |

## 4. Transitions

- A → B and B → C: hard cuts (the only ones; they mark the real footage clearly).
- C → D → E → F: the outgoing scene's cards dim and drift up 24 px while the next eyebrow rises (0.6 s overlap), or a light streak sweep. No wipes, no bounce.
- Inside C: the reference and cook frames shrink into the "Glasses" node, so the diagram grows out of the real images.

## 5. What is measured after the VO exists (Phase 4)

Each VO clip's duration (ffprobe) → scene lengths updated in `film.html`; the timeline table above is regenerated with real numbers; the total is re-checked against 1:58.
