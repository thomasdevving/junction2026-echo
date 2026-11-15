# `ai/`: the `echo_ai` package (every Gemini call)

A Python package that holds every prompt and every Gemini call in Echo. The backend imports it. It has no HTTP, database or ffmpeg code of its own.

## Public functions

From `src/echo_ai/__init__.py`. Each one switches to a deterministic fake when `ECHO_AI_FAKE=1`.

| Function | Gemini model (default) | What it does |
|---|---|---|
| `extract_recipe(video_path, title_hint=, step_marks_s=)` | `gemini-3.5-flash` | Uploads the chef's MP4 through the Files API. One structured call returns a `RecipeDraft`: title, transcript and up to 10 steps, each with an instruction, the chef's own words, a reference timestamp, a clip window, visible **success criteria** and known mistakes (`watch_fors`). The chef's pinch marks are hints. Invalid output is repaired, then retried once. The upload is always deleted |
| `check_frame(frame, step, ref_image)` | `gemini-3.5-flash-lite` | Sends two labelled images, **REFERENCE (chef)** and **LEARNER (now)**, plus the step's criteria. The model records evidence per criterion, then returns `pass`, `fix` or `unsure`. Code then applies rules: unknown mistake IDs are dropped, chef-written fix text replaces model text, and any verdict under 0.5 confidence becomes `unsure` |
| `watch_frame(frame, step)` | `gemini-3.5-flash-lite` | Sends one low-resolution frame against the step's known mistakes only. It returns `ok`, or `warn` with a mistake ID and confidence. The model writes no free text. Steps without `watch_fors` make no call |
| `build_live_config(...)` | — | Builds the Gemini Live setup from the chef's transcript and steps, with 5 voice functions (`check_my_work`, `next_step`, `previous_step`, `show_me`, `repeat_instruction`) and session resumption |
| `mint_live_token(cfg)` | `gemini-3.8-live` | Mints a single-use **ephemeral token** (`v1beta`, 30 min) locked to the model, system instruction and tools, so the phone can open Live without holding a key |

**Gemini features used:**
- video understanding (Files API)
- structured output (`response_json_schema`, with a mistake-ID enum built per step)
- multi-image input
- `media_resolution` (MEDIUM for check, LOW for watch)
- minimal thinking, temperature 0
- Live API with function calling and transcription
- ephemeral tokens

The SDK is `google-genai==3.3.0`. Model IDs are in `config.py` and can be overridden per call type with `ECHO_MODEL_VIDEO|CHECK|WATCH|LIVE`. Prompts are plain files in `src/echo_ai/prompts/`.

## Measured so far

From [STATUS.md](STATUS.md). All runs were on 14 Nov from a laptop at the venue (network not recorded), on warm processes:

| Call | n | p50 | max |
|---|---|---|---|
| `check_frame`, 1280 px | 9 | 1017 ms | 1931 ms |
| `watch_frame`, 512 px | 9 | 902 ms | 1518 ms |
| `mint_live_token` | 4 | 295 ms | 636 ms |
| Live: first audio after a question | 5 | 594 ms | 697 ms |
| `extract_recipe` (21.6 s stock clip) | 1 | 9.4 s upload + 4.5 s generate | — |

**Not measured yet: accuracy.** The labelled evaluation set (`eval/cases.csv`) is still empty, so there are no false-approval or detection numbers. Prompt tuning used 9 unlabelled stock frames, and on those the lite check model approved 1–2 of 9 clearly unfinished frames. `gemini-3.8-flash` approved none of them but had p50 2.5 s. Picking between them is an open decision (`ECHO_MODEL_CHECK` switches models without a code change). `eval/qa.csv` holds 15 voice Q&A cases built from the real transcript (10 answerable from the lesson, 5 not). They have not been scored yet.

## Run it

Python 3.11+.

```bash
cd ai
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env          # fake mode by default; set GEMINI_API_KEY and ECHO_AI_FAKE=0 for real calls
pytest
```

Command line:

```bash
python -m echo_ai models
python -m echo_ai check --step 4 --frame frame.jpg --ref fixtures/images/step-4.jpg   # --no-ref, -v
python -m echo_ai watch --step 4 --frame frame.jpg
python -m echo_ai extract chef.mp4 -o out.json
python -m echo_ai live-config
python -m echo_ai.eval --split dev --config full|no-ref|generic                       # ablation runner
```

`--step N` reads `fixtures/sushi_recipe.json`. Despite the file name, it now holds the six-step ham-and-cheese sandwich lesson from the real chef take. Its reference stills in `fixtures/images/` are frames from that take.

**Fake mode** (`ECHO_AI_FAKE=1`) needs no network or key:
- extraction returns the fixture
- `check` returns `unsure` for tiny frames, otherwise `fix`/`pass` alternately
- `watch` cycles 3 `ok`, then 3 `warn`

The backend's tests and early client work run on fake mode.

## Layout

```
ai/
  src/echo_ai/   __init__ (public surface) · check · watch · ingest · live · client · config · schemas · fake · eval · cli
    prompts/     extract.md · check.md · watch.md · live_system.md · generic_check.md
  fixtures/      the demo recipe (JSON) and its reference stills
  footage/       chef-take-sandwich.mp4: the real chef take the demo recipe was extracted from
  eval/          cases.csv (labelled frames, empty) · clips.csv · qa.csv · frames/
  scripts/       smoke tests, frame extraction, dev evaluation, side-by-side tools
  tests/
  STATUS.md  tasks/   build log and the team's task batches
```

`ECHO_PROVIDER=openai` selects a stand-in that was used before the Gemini key arrived. It is unused now and kept only for emergencies. Gemini is the default and the product.
