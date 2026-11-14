# Echo film: handoff (state on 2026-11-15)

Everything needed to continue the pitch film on another computer. Owner: the deck/video/demo track (web/pitch).
Read this first, then `film/config.js` (picture) and `film/sound.js` (sound): those two files are the edit.
Supersedes `script.md` and `shot-list.md` (first pass, old timeline).

## What it is

A 1:37 product film (limit 2:00), 1920×1080, 30 fps, rendered from an HTML page. Picture first, then sound.
`film.html` is a player: `renderFrame(t)` draws any moment from scratch, so scrubbing, the browser preview and
the offline MP4 render all show the same frames.

| Time | Scene (`film/config.js` SCENES) | What happens |
|---|---|---|
| 0:00–0:14 | open | Glasses hinge macro → pull-back → push through the lens → POV with the phone recipe video → Echo lockup |
| 0:14–0:50 | footage (`film/footage.js`) | The chef's **real** recording: montage with REC + pinch marks → upload + Gemini finds the steps → the generated six-step lesson (stills from the take) → following it, other cuts of the take with the lens card composited in (labelled "Lens view · simulated") + a voiced Q&A |
| 0:50–1:17 | how | Source frames → instruction card → comparison (bare bread at the edges → looks right) → under the hood |
| 1:17–1:26 | trust | The board leaves the view → "Can't tell" → watching indicator |
| 1:26–1:37 | end | Sandwich hero → pull back out through the lens (roll, motion blur, flare, focus pull; the sandwich ends small and see-through in the lens as display content) → Echo lockup, pilot line, "Junction 2026 · Meta × Google DeepMind challenge" |

Transitions are central (`film/main.js`): `in: {type: match|left|up, dur}` moves the outgoing and incoming scene together.

## Decisions made with the user (keep them)

- Picture-first motion graphics; no "one frame appears over another" cuts: every scene change is a move.
- The lens card in the footage uses the app's real renderer (`web/shared/lens.js` + `lens.css`), monochrome, 16:10
  reference image. The film never says it is the real dashboard. The small "Lens view · simulated" tag stays because
  it is the chef's footage with the card added afterwards, not a learner's real run (CLAUDE.md: report honestly).
- Sound: the chef's own voice where the chef speaks (montage), ElevenLabs for every scripted line, ElevenLabs Music
  for the bed (original, cleared on the paid plan). Chef lines have subtitles (accent + crowd noise).
- Chef voice cleaned with ElevenLabs Voice Isolator (user approved uploading only the two ~4.5 s clips). Local
  denoisers can't remove crowd babble. Transcription of the take was done locally (whisper.cpp), never uploaded.
- Voices: Eric `cjVigY5qzO86Huf0OWal` (narrator), Jessica `cgSgspJ2msm6clMCkdW9` (learner question), Sarah
  `EXAVITQu4vr4xnSDxMaL` (Echo's answer). TTS model `eleven_v4`, music model `music_v2_5`.
- End-card credit is text only, no logos (no implied endorsement).

## Files that are NOT in git (public repo) — copy them or regenerate

| Path (under `web/pitch/video/`) | What | How to get it on a new computer |
|---|---|---|
| `.env.local` | `ELEVENLABS_API_KEY=…` | Copy, or `npx -y @elevenlabs/cli@latest onboard init` (template: `.env.example`) |
| `footage/chef-take.mp4` | The chef's real take (133.7 s). Original download name `1eaa19bd-840e-4bf9-8764-e0cc90cfc24c.mp4` | **Copy it** (USB/drive). Then `npm run footage:prep` |
| `footage/chef-take-30.mp4`, `footage/stills/` | Smooth 30 fps picture + lesson stills | `npm run footage:prep` (several minutes) |
| `audio/film-vo/`, `audio/music/bed.mp3`, `audio/chef/` | Generated VO lines, music, isolated chef clips | **Copy `audio/` to save credits**, or `npm run sound:vo`, `npm run sound:music`, `npm run sound:isolate` (each costs ElevenLabs credits; music comes out different each time) |
| `audio/models/ggml-base.en.bin` | whisper.cpp model (local transcription only) | Optional; from Hugging Face `ggerganov/whisper.cpp` |
| `audio/soundtrack.*`, `frames/`, `out/` | Build outputs | Rebuilt by the commands below |
| `assets/library-v2/models/` | 3D models (50 MB), unused by film and deck | Copy only if needed |

## Commands (run in `web/pitch/video/`)

```
npm install                          # ElevenLabs SDK (node_modules is ignored)
node serve.mjs 5173                  # preview: http://127.0.0.1:5173/pitch/video/film.html (needs Range: not python http.server)
npm run footage:prep                 # 30 fps picture + stills from footage/chef-take.mp4
npm run sound:check                  # cue timeline + overlap warnings (no network)
npm run sound:vo [-- v05 q1]         # generate missing / listed VO lines (credits)
npm run sound:music [-- --force]     # compose the music bed (credits)
npm run sound:isolate [-- --force]   # chef clips through Voice Isolator (credits; uploads ~9 s)
npm run sound:mix                    # mix -> audio/soundtrack.m4a (the player plays it) + stems + loudness
npm run film [-- --fresh]            # render all frames + mix + encode -> out/echo-film.mp4 (+ checks)
node render.mjs stills "pitch/video/film.html?render" 15,40.5,90 <outDir>   # spot-check frames
```

Player keys: Space, ←/→ (2 s), Shift+←/→ (0.1 s), Home, F, C (clean), M (mute). `?t=42` opens at 42 s.
After a picture change run `npm run film -- --fresh` (frames are cached and resumable; ~20–25 min for all 2,910).
After a sound-only change `npm run film` reuses the frames.

Requirements: Node 24, ffmpeg (the whisper filter only for transcription), Chrome at the default path (or `CHROME_PATH`).

## Where things are

- `film.html` — player page + all film CSS. `film/main.js` — clock, transitions, soundtrack sync, chef subtitles.
- `film/config.js` — timeline, footage cuts (`FOOTAGE`: in/out seconds in the take), the lesson.
- `film/scenes.js` — open, how, trust, end. `film/footage.js` — the real-footage scene.
- `film/sound.js` — every spoken line with its film time, chef clips (`CHEF`, also the subtitles), music prompt.
- `soundtrack.mjs` — VO/music/isolation generation and the mix (fixed per-clip gains, music ducked ~10 dB under
  speech, master −16 LUFS / −1.5 dBFS). Writes `audio/stems/` for checking the balance.
- `build.mjs` — the MP4. `render.mjs` — headless Chrome renderer. `serve.mjs` — preview server.
  `prep-footage.mjs` — footage preparation.
- `../shared/` — film kit, photo plates + glasses rig, tokens (fonts, headline). `assets/` — images.
- Retired: `script.md`, `shot-list.md`, `vo.json`, `tts.mjs` (first VO pass; `npm run voices` still lists voices).

## Last measured (2026-11-15, before the open items below)

- `out/echo-film.mp4`: 97.00 s; video and audio both start at 0 and are 97.00 s; −16.2 LUFS, −1.4 dBFS peak.
- Speech lines all ≈ −17 LUFS; music −27…−33 LUFS under speech, −21…−25 between lines.
- Whisper on the mix recovers every narration line verbatim; the chef lines as well as the raw take allows.
- Isolator: chef voice-to-background gap 16 → ~24 dB and 9 → ~24 dB (with 0.18 of the room blended back).

## Open items (in order)

1. **Footage judder (user: "hand is shaking, like glitching").** Cause: the take is variable frame rate with dropped
   frames (gaps 15–107 ms), and seeking it to exact 1/30 s boundaries could pick neighbouring frames out of order.
   Fix written but **not yet verified**: `FOOTAGE.src` points at `footage/chef-take-30.mp4` (motion-interpolated
   constant 30 fps, keyframe every 15 frames) and paused seeks aim at frame centres (`film/footage.js`). To do:
   `npm run footage:prep`, check the interpolated picture for warping on hands/knife (if bad, replace `minterpolate`
   with plain `fps=30` in `prep-footage.mjs`), then `npm run film -- --fresh` and step through 0:21–0:23 and 0:44–0:47.
2. Fixed in the page, MP4 not rebuilt yet: lens card corners (counter and watching dot were clipped), black bands
   around the source boards, clipped "g" descender / "s" overhang in gradient headlines (`shared/tokens.css`).
   Covered by the `--fresh` rebuild in 1.
3. Listen to the whole MP4 once with sound (music taste, voices, chef isolation): numbers were checked, ears weren't.
4. For the web app (not the film): `web/shared/lens.css` rounds `.lens` with `border-radius: 6cqw`, which resolves
   against an outer container rather than the card; the film overrides it with `6%`. Worth fixing in the app.
