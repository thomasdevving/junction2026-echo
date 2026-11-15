# Working on Echo (team guide)

How the four of us worked during Junction 2026. Judges and readers can skip this; the product is described in the [README](../README.md).

## Tracks

Four people, four laptops, four folders. Each track folder has a `README.md` (what it is, how to run it), a `STATUS.md` (what is actually done and measured, with dates) and `tasks/` (one markdown file per batch, each with acceptance criteria).

| Track | Folder | Machine |
|---|---|---|
| iPhone / glasses app | [`ios/`](../ios/README.md) | The Mac + an iPhone |
| API, storage, deployment | [`backend/`](../backend/README.md) | Any |
| Prompts, Gemini calls, evaluation | [`ai/`](../ai/README.md) | Any |
| Web tools, pitch, demo, submission | [`web/`](../web/README.md) | Any |

## Running a batch with Claude Code

Clone, open Claude Code in the repository root (so [CLAUDE.md](../CLAUDE.md) loads), and start one batch with:

```
I own the <track> track. Read CLAUDE.md, README.md, docs/API-CONTRACT.md and <track>/README.md,
then carry out <track>/tasks/<NN-name>.md completely. Work only inside <track>/.
Run the batch's verification commands. When every acceptance criterion passes, update
<track>/STATUS.md and stop. If something outside <track>/ blocks you, write it under
"Needs from other tracks" in STATUS.md and tell me instead of working around it.
```

Review the result, commit with the track prefix (`[ios]`, `[backend]`, `[ai]`, `[web]`, `[docs]`), `git pull --rebase origin main`, push. Fresh session per batch.

## Ground rules

- One folder per person. Shared documents change deliberately, in their own commit.
- Change an interface in [API-CONTRACT.md](API-CONTRACT.md) first, then in code.
- Write down only what you ran and saw. Targets and results are kept apart.
- The repository is public: no keys, tokens, faces, or raw footage of people.

## Where things are

| Question | Look at |
|---|---|
| Which batches are done? | each track's `STATUS.md` |
| What works on the glasses? | [ios/STATUS.md](../ios/STATUS.md) → Device facts, Chef takes |
| Where is the API running? | [backend/STATUS.md](../backend/STATUS.md) |
| Which Gemini models, limits, latency? | [ai/STATUS.md](../ai/STATUS.md) |
| Is it submitted? | [web/STATUS.md](../web/STATUS.md) → Submission |

## Planning documents

Written before and during the build. Some status lines in them are older than the code; the `STATUS.md` files and the code win.

| Document | Content |
|---|---|
| [TECH-SPEC.md](TECH-SPEC.md) | The original concept: flows, display spec, scope |
| [PLAN.md](PLAN.md) | Tracks, batch dependencies, gates G0–G5, cut order |
| [DECISIONS-AND-RISKS.md](DECISIONS-AND-RISKS.md) | Settled decisions, risks, open questions |
| [DEMO-AND-SUBMISSION.md](DEMO-AND-SUBMISSION.md) | Demo script, failure playbook, submission checklist |
| [EVENT-CONTEXT.md](EVENT-CONTEXT.md) | Schedule, challenge briefs, judging |
| [research/JUNCTION_2026_CONTEXT.md](research/JUNCTION_2026_CONTEXT.md) | Background research with sources |
