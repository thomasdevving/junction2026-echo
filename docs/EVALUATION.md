# Echo — evaluation

This page covers what we measured, how we measured it, and what has not been measured yet. Each number below gives its date, its conditions and the `STATUS.md` file where it was recorded. Targets are labelled **TARGET**.

## 1. Latency (measured)

All runs used real Gemini, on 14 Nov 2026.

| Call | Conditions | n | p50 | max | Source |
|---|---|---|---|---|---|
| `/check` model time | Production (Railway + Supabase), two-session load run, Railway call logs | 18 | 1032 ms | 1455 ms | `backend/STATUS.md` |
| `/watch` model time | Same run | 85 | 728 ms | 1188 ms | `backend/STATUS.md` |
| `check_frame`, 1280 px | Laptop at the venue, warm process | 9 | 1017 ms | 1931 ms | `ai/STATUS.md` |
| `watch_frame`, 512 px | Laptop at the venue, warm process | 9 | 902 ms | 1518 ms | `ai/STATUS.md` |
| Live token mint | Laptop, warm process | 4 | 295 ms | 636 ms | `ai/STATUS.md` |
| Live: question to first audio | Laptop, raw WebSocket using the ephemeral token | 5 | 594 ms | 697 ms | `ai/STATUS.md` |
| Ingestion of the real chef take | Production, 2 min 14 s glasses take → 5 steps with stills and clips | 1 | ~33 s | — | `ios/STATUS.md` |

**Targets:**

| Metric | TARGET | Measured (model time) |
|---|---|---|
| `/check` p50 | ≤ 2000 ms | 1032 ms |
| `/watch` p50 | ≤ 1500 ms | 728 ms |

**End-to-end latency is worse than model time.** In the same load run, the client saw `/watch` p50 1473 ms and p90 5012 ms, with one timeout. Railway's proxy logged gaps in which neither session sent anything. A ping test on the venue Wi-Fi straight afterwards averaged 1020 ms with 1.7 % loss, so the network was the likely cause, but that is not proven. The run had no 429s and no 5xx errors at two concurrent sessions.

## 2. Accuracy (not measured yet)

The evaluation set and runner are in place:
- `ai/eval/cases.csv` holds labelled frames, split into `dev` and `heldout`.
- `python -m echo_ai.eval` runs them.

**The set has no labelled frames yet, so there are no accuracy numbers.** Once frames are labelled, the planned measurements are:

| Metric | Definition | TARGET |
|---|---|---|
| False approvals (`/check`) | Label `fix`, model says `pass` | 0 on held-out |
| False rejections (`/check`) | Label `pass`, model says `fix` | ≤ 2 in 20 |
| Appropriate `unsure` | Label `unsure`, model says `unsure` | ≥ 80 % |
| Watcher false alerts | Alerts per minute on correct footage, after debounce | ≤ 1 in 5 min |
| Q&A grounding | `ai/eval/qa.csv`: 10 questions the chef's narration answers, 5 it doesn't | ≥ 8 of 10 answered with the chef's content; all 5 handled honestly |

**Ablation:** the runner already supports three configurations on the same set:
- `--config full`: reference image + criteria + mistakes. This is what ships.
- `--config no-ref`: criteria text only.
- `--config generic`: "is this step done correctly?"

This will show what the chef's reference frame and the written criteria add. If a simpler configuration does as well, we will say so.

### What prompt tuning showed (unlabelled dev material, not accuracy)

Over three prompt rounds we tuned on 9 unlabelled stock frames of unfinished work (`ai/STATUS.md`). By the third round, the default check model approved 1–2 of the 9 frames. The changes that helped were:
- recording evidence per criterion before the verdict
- the rule "unfinished work is never a pass"
- judging margins in proportion to the whole

`gemini-3.8-flash` approved none of the 9, but its p50 was 2.5–5.1 s and it hit one timeout in 27 calls. Choosing between speed and strictness is a configuration switch (`ECHO_MODEL_CHECK`).

**2026-11-15, decided:** check runs on `gemini-3.8-flash`. On 21 frames from the real chef take, labelled by eye (dev observations, not accuracy numbers), it wrongly passed 2 of 28 unfinished frames against 12 of 28 for lite, and said "can't tell" when hands covered the food; checks take ~3–5 s (up to ~9 s) instead of ~1 s. Details in `ai/STATUS.md`. A labelled held-out set is still needed for real numbers.

## 3. Rules for reporting

- Report counts ("17 of 20"), not bare percentages, and state the recipe, the number of steps, the set size, and that it was the team's own footage.
- Never hide a false approval inside an aggregate.
- Don't put a number in the deck or video unless it appears on this page.

## Recovery tests

The failure behaviour is defined in [ARCHITECTURE.md §6](ARCHITECTURE.md#6-failure-behaviour). It is covered by unit tests on iOS (mock API and test clock) and by backend tests with fault injection. The deliberate device run below has **not been done yet**:

- [ ] Deny camera permission, then grant it
- [ ] Glasses out of range mid-step, then back
- [ ] Airplane mode for 20 s during a step (done on the iPhone with fake AI: steps and images kept working)
- [ ] Backend stopped during a check
- [ ] Forced model timeout / quota error (`FAULT_INJECT` + `X-Fault: 1`)
- [ ] Five fast "check" inputs
- [ ] Step changed while a check is pending
- [ ] Camera covered, then check → `unsure`
- [ ] Live session dropped while asking a question
- [ ] Display unavailable → audio-only mode
