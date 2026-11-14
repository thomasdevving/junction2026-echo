# Echo — demo run sheet

> One printed page for the operator. Source: [docs/DEMO-AND-SUBMISSION.md](../../docs/DEMO-AND-SUBMISSION.md) §2, §4, §5.
> **⟨fill⟩** = not known yet; fill in on site and reprint. Last updated: 2026-11-14 01:20, before any rehearsal.

## Judging slots (WEB-05.8)

| Slot | When | Where | Presents | At the table |
|---|---|---|---|---|
| Meta partner judging | ⟨fill⟩ | ⟨fill⟩ | ⟨fill⟩ | ⟨fill⟩ |
| Google DeepMind partner judging | ⟨fill⟩ | ⟨fill⟩ | ⟨fill⟩ | ⟨fill⟩ |
| Peer review | Sun from 10:30 (homepage) or 14:00 (platform) ⟨confirm⟩ | Our table | ⟨fill⟩ | ⟨fill⟩ |

## Roles

- **Presenter:** ⟨fill⟩ — talks, never touches the laptop.
- **Operator:** ⟨fill⟩ — runs the monitor laptop and this sheet; calls resets.
- **Wearer:** a volunteer, ideally not on the team. Brief in two sentences:
  *"You're making a ham and cheese sandwich with the chef's help in the glasses. Add the filling the way you think is right, and if the glasses tell you something, do what they say."*

## Thirty minutes before

- [ ] Glasses charged, paired, Developer Mode on, app registered. Device: ⟨fill: model + name⟩
- [ ] Phone on charger, Do Not Disturb on, auto-lock off. Phone: ⟨fill⟩
- [ ] Production health shows `ai_mode: gemini`, `storage: supabase`: open ⟨fill: production URL⟩`/health`. **If it says `fake`, stop and tell the backend owner.**
- [ ] App Settings → base URL = production URL; demo key entered; watch threshold = **0.7** (untuned contract default; replace with the value in `ai/STATUS.md` once AI-07 tunes it).
- [ ] Recipe "Ham and cheese sandwich" is `published` and every reference image loads (open it in the simulator: ⟨fill: production URL⟩`/app/sim/`).
- [ ] One full dry run on this table, under this light.
- [ ] Monitor open on ⟨fill: production URL⟩`/app/monitor/` and showing **LIVE**. Backup recording open in another tab (**REPLAY** badge visible).
- [ ] Hotspot on: ⟨fill: hotspot name⟩. Emergency laptop backend running: ⟨fill: emergency URL⟩.
- [ ] Bread, spread, lettuce and filling portions laid out for three runs (fillings kept cool); wet wipes. Kit list: `docs/DEMO-AND-SUBMISSION.md`.

## The demo (~100 s)

| # | Wearer does | They should see / hear | Presenter says |
|---|---|---|---|
| 1 | Puts on glasses, looks down at the board with the bread already spread | Step card "4/6 Add fillings" with the chef's reference | "A chef recorded this once, wearing the same glasses." |
| 2 | **Scripted mistake:** piles all the ham and cheese in the middle of the slice, bare bread all around | — | "Our volunteer is making this sandwich the chef's way for the first time." |
| 3 | Keeps working | ⚠ "Filling piled up" / "Spread it to the edges" + reference + one spoken sentence (icon and words: the lens has no amber or green) | "Nobody asked. The glasses compared this view with the chef's and spoke first." |
| 4 | Spreads the filling out in an even layer to the edges | Warning clears | "One instruction, in the chef's words." |
| 5 | Pinches, or says "check" | "Checking…" → ✓ "Looks right" + chime | "Now they ask, and it passes." |
| 6 | Asks aloud: **"Why spread it to the edges?"** ⟨confirm against the real chef transcript: the current fixture narration is a placeholder⟩ | Caption + spoken answer | "The answer comes from the chef's own narration." |
| 7 | Covers the bread with a hand, then checks | "Can't tell — look at the board" | "When it can't see, it says so instead of guessing." |
| 8 | — | — | Evidence slide: measured numbers only, pilot, what's next |

Short slot: drop 6 and 7. Watcher cut: beat 3 becomes beat 5 doing the catch.
**Peer-review table (~60 s):** 1 → 2 → 5 (check shows the fix) → 4 → 5 (pass).

## Reset between runs (target < 30 s)

1. Two fresh slices of bread on the board, already spread; the old sandwich off the board.
2. App: **Restart session** (Demo menu). With Settings → Demo set to start at step 4, it lands on step 4.
3. Check the monitor re-attached to the new session (LIVE, on the same step as the app).
4. Wearer wipes hands.

## When something breaks — decide, don't debug

| Symptom | Do this | Say this |
|---|---|---|
| Venue Wi-Fi unusable | Phone + laptop onto hotspot ⟨fill: name⟩ | Nothing |
| Production backend down | App base URL → emergency laptop ⟨fill: URL⟩ | Nothing |
| Watcher silent after 15 s | Wearer says "check" | "Let's ask it." |
| Watcher false alarm | Dismiss, carry on | "It's cautious. Two hits in a row are needed, and you just saw the second." |
| Voice not responding | Skip beat 6, or push-to-talk | "It's loud here; the answer is also on the lens." |
| Lens display fails | Audio-only; point at the monitor's lens card | "Audio-first works on glasses without a display too." |
| Glasses won't connect | Phone camera at chest height, lens preview on the phone | "This is our development fallback on the phone camera." (say it **explicitly**) |
| Everything fails | Play the backup recording in the monitor | "This is a recording from ⟨fill: when⟩." |

## Who to call

| Subsystem | Owner | Phone / handle |
|---|---|---|
| iOS app, glasses, Device Access Toolkit | Thomas | ⟨fill⟩ |
| Backend, Railway, Supabase, emergency laptop | Stelios | ⟨fill⟩ |
| Gemini, prompts, watch threshold | Aleksandr | ⟨fill⟩ |
| Monitor, simulator, this sheet, submission | Türker | ⟨fill⟩ |
