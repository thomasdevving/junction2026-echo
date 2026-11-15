# Real-footage shot list (the 40 s block, 0:15–0:55)

> Part of the [Gate 1 package](../gate1.md). For whoever films. Beats and captions are in [script.md §3 B](script.md#b-real-footage-015055).
> Footage files **never go into the repository**: put them in `web/pitch/video/footage/` (gitignored) or the team drive, and note where in `footage.json`.

## 1. Before the first take

**The 10-second rung-0 test (do this the moment the glasses arrive):** on the glasses, swipe left from the display home → Display recording (or Meta AI app → Glasses → Record display). Record 10 s while our app shows a step card in the lens. Check on the phone's camera roll: (a) does the recording exist at all (Meta says the feature may be US-only), (b) is **our app's card** visible in it, (c) resolution and frame rate. Write the answer in `ios/STATUS.md` → Device facts (ask Thomas) and tell the video owner. This decides rung 0.

**Kit** (from `docs/DEMO-AND-SUBMISSION.md` §4): sliced bread, a coloured spread that shows on camera (pesto, or hummus with paprika), lettuce, sliced ham and cheese, a butter knife, a plain dark matte board, wet wipes, paper towels, a small light if the room is dim. Same kit serves the AI-03 evaluation clips: film both in one session (see §4).

**Devices:**
- Glasses paired, Developer Mode on, our app on the iPhone in Cook mode (and Chef mode for beat 1), pointed at **production** (`https://statai-production.up.railway.app`), the sandwich recipe published.
- Laptop with the monitor open (`/app/monitor/`) and a screen recorder. ffmpeg is already on the video laptop: `ffmpeg -f gdigrab -framerate 30 -i desktop -c:v libx264 -crf 18 monitor_take.mp4`, or Windows Game Bar (Win+Alt+R).
- A second phone on a tripod, 1080p or 4K at 30 fps, landscape.

**Sync:** at the start of every take, one clap in view of the tripod, close enough for the glasses' mic to hear it. It lines up all rungs in the edit.

**Consent:** everyone visible agrees to appear in a public video, out loud on camera at the start of the first take ("I agree to be filmed for the Echo pitch video"). Hands and board only where possible. No bystanders, no faces of people who did not agree, no screens showing private chats or notifications (phone on Do Not Disturb).

## 2. Rungs (sources), in order of preference

| Rung | Source | Gives us | Label in the film |
|---|---|---|---|
| 0 | Meta "Record display" on the glasses | True lens + POV + audio in one file, max 1 min | "Lens view, recorded on the glasses" |
| 1 | Our app's Chef-mode MP4 (glasses camera + mic) | POV only, no lens | "Glasses camera" |
| 2 | Screen recording of `/app/monitor/` | Wearer frame + chef reference + lens reconstruction + event timeline with latency | "Lens view, reconstructed by the monitor" |
| 3 | Tripod phone, third person | Hands, board, the wearer's glasses and pinch from outside | "Real footage" |
| 4 | Phone filming through the lens | Only if readable; last resort | "Filmed through the lens" |

**Always record rungs 2 and 3 in parallel with rung 0 or 1.** If rung 0 fails, nothing has to be re-shot.

## 3. Beats

Record each beat **at least 3 times**. Each take runs well past the beat's length (the film uses the best 7–16 s). Rung 0 stops at 1 minute, so keep each take under 55 s and restart the recording between takes.

### Beat 1: the chef records (film length 7 s, 0:15–0:22)

| | |
|---|---|
| Who | The "chef" (a teammate who knows the recipe), wearing the glasses |
| App state | Chef mode → consent screen accepted → recording → at the fillings step, pinch to mark a step |
| Framing | POV looking down at the board from standing height; the whole board in frame, both bread slices visible. Tripod: side-on, chest height, hands and the pinch visible |
| Must be visible | "● REC" with a running timer in the lens (rung 0) or on the phone screen (rung 2/3); the pinch; "Step N marked" |
| Rungs | 0 (lens + POV) or 1 (POV, the take itself); 3 always |
| Say | The chef narrates naturally, e.g. "Ham first, then cheese, in one even layer, right to the edges. Don't pile it up in the middle." |
| Needs | Chef mode working on the glasses (IOS-08 has not run on a device yet, `ios/STATUS.md:16`). **If it does not work in time: drop this beat (gate1 Q10)** |

### Beat 2: mistake → catch → fix (film length 16 s, 0:22–0:38)

| | |
|---|---|
| Who | The "learner", wearing the glasses, Cook mode at step 4 "Add fillings" |
| Action | Put the ham and cheese **piled in the middle**, bare bread all around. Then hold still, looking down, and **wait** for the warning (the watcher needs two hits about 2.5 s apart, so expect 5–8 s). After the spoken warning, spread the filling to the edges in an even layer |
| Framing | POV: the slice fills about half the frame, centred, head still. Tripod: hands, board and the glasses visible |
| Must be visible | The pile with bare bread around it; the warning card with the chef's reference (lens or monitor); the fix happening; the spoken sentence audible |
| Rungs | 0 or 1 for POV; 2 always (the monitor shows the warning, reference and latency); 3 always |
| If the watcher does not fire in 15 s | Ask for a check instead (pinch or say "check"). That take becomes the "check catches it" fallback in script.md; caption changes. **Do not fake or re-stage a warning that did not happen** |

### Beat 3: check → pass (film length 10 s, 0:38–0:48)

| | |
|---|---|
| Action | With the filling spread to the edges, pinch or say "check". Hold still until the pass and the chime |
| Must be visible | "Checking…" then ✓ "Looks right"; the chime and spoken pass audible; the monitor shows the pass event with its latency |
| Rungs | 0/1, 2, 3 |

### Beat 4: a question (film length 7 s, 0:48–0:55)

| | |
|---|---|
| Action | Ask aloud, clearly: **"Where should the cheese go?"** (the demo question since 2026-11-15; the real chef narration answers it: "don't put it in the middle like this, it should reach the edges"). Wait for the spoken answer |
| Must be visible / audible | The mic or "listening" state; the question; the full spoken answer |
| Rungs | 0/1 (audio matters most), 2, 3 |
| Room | Quiet. If the room is noisy, use push-to-talk (Settings) and say so in the log |

### Stills for part C (0:55–1:01)

- **Chef's reference:** the step-4 reference still from the chef take (after AI-03.5 puts real stills in the fixture), or a clean frame from beat 1's POV.
- **Cook's view:** one clean POV frame from beat 2 showing the pile.
- Both portrait, no faces.

## 4. Same session, two jobs

This shoot can also give the AI evaluation set: the expert take, mistake clips and the `unsure` cases (hand over the bread, half out of frame). Follow `ai/STATUS.md` "Filming-day workflow" (`scripts/intake_clips.py`, `eval/clips.csv`). Film the eval clips **after** the film beats so the kit is still fresh for the film.

## 5. After each take, write a row

Keep the log in `web/pitch/video/footage.json` (one entry per take; the build reads it):

| Field | Example |
|---|---|
| `beat` | 2 |
| `take` | 3 |
| `rung` | 0 |
| `file` | `footage/beat2_rung0_take3_1432.mp4` |
| `recorded` | `2026-11-14T14:32` |
| `device` | glasses model + firmware, phone model |
| `in_s`, `out_s` | best segment |
| `what_happened` | e.g. "watcher fired at 6.1 s, spoken warning clear, fix + pass" |
| `consent` | who appears, consent given on camera at take 1 |
| `usable` | yes / no + why |

File names: `beat{N}_rung{R}_take{T}_{HHMM}.mp4`, no spaces.
