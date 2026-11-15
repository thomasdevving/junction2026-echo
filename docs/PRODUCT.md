# Echo — product

## One sentence

A chef records a recipe once through smart glasses. Anyone wearing the glasses can then cook it hands-free while Gemini compares what they are doing with the chef's own point-of-view footage, corrects mistakes as they happen, and answers questions in the chef's method.

## The problem

Learning a hands-on technique from a video breaks at the moment it matters:

- **Your hands are wet, sticky, or holding a knife.** You can't pause, scrub or search a phone.
- **The video can't see your board.** You find out the filling was all in the middle when the sandwich falls apart at the first bite.
- **A teacher's attention doesn't scale.** A teacher fixes this by glancing at your hands and saying one sentence, but that only works for a small class.

The usual alternatives each miss something:

| Alternative | What it misses |
|---|---|
| A phone propped against a jar | No feedback, and you have to touch it |
| A recipe app with voice control | Nothing watches your work |
| A generic visual assistant | It doesn't know this chef's method or which step you're on |

## Who it is for

| Who | Situation | What they get |
|---|---|---|
| **A home cook learning a specific dish from a specific chef** | Hands busy, following the dish for the first or second time | Step cards in the lens, a check against the chef's reference on request, a warning when a known mistake appears, spoken answers |
| **The chef or instructor** | Teaches the same technique again and again | Records once while cooking normally, pinching to mark steps. Reviews and corrects the extracted steps on a web page |

## Why glasses

- **Same viewpoint on both sides.** The chef's reference is filmed from eye level looking down at the board. The learner's frame comes from the same place. Comparing like with like is what makes "does mine look like the chef's?" answerable.
- **Hands stay on the food.** Input is a pinch, a swipe or speech. Output is two short lines in the lens and one spoken sentence.
- **The system can speak first.** The camera already sees the work, so a known mistake can be flagged before the learner knows to ask.

The phone stays in a pocket during the cook-along. The lens is not a mirrored phone screen.

## User journeys

**Chef, once per recipe:**
1. Open Echo in **Chef mode** and consent to recording.
2. Cook wearing the glasses and talk through it, pinching at each new step. The lens shows "● REC".
3. Stop. The take uploads.
4. Gemini returns steps with timestamps, the chef's quotes, success criteria and common mistakes, using the pinch marks as hints.
5. Fix wording and re-pick reference frames on the review page, then publish.

**Cook, every time:**
1. Open **Cook mode** and pick a recipe. All images and clips download before cooking starts.
2. For each step, see the step card with the chef's reference still.
3. If the watcher spots a known mistake, it warns you; you can also pinch or say "check" yourself. *Pass* moves you to the next step. *Fix* shows the reference and one instruction: fix it, re-check, pass.
4. Ask a question out loud at any time.
5. At the end, a Done summary.

**Demo:**
1. A volunteer makes a ham-and-cheese sandwich and piles the cheese in the middle.
2. The watcher catches it and shows the chef's reference with "spread it to the edges".
3. They fix it, and the check passes.
4. They ask "Where should the cheese go?" and hear the answer from the chef's own narration.

## What "correct" means

A step is judged only on criteria that are **visible in a single first-person frame**: coverage, placement, margins, alignment, shape. For example, "the cheese reaches the edges of the bread". Each step's `success_criteria` and `watch_fors` are written, and can be edited by the chef, to be that kind of criterion.

- **When the frame can't show the criteria, the verdict is `unsure`.** It comes with how to give a better view. Verdicts under 0.5 confidence are turned into `unsure` in code.
- **When a verdict matches a known mistake, the chef-reviewed text for that mistake is shown instead of the model's own words.** Unknown mistake IDs are dropped.
- **No claims about taste, temperature, doneness or food safety.**

## Trust, consent, accessibility

| Topic | What the code does |
|---|---|
| Chef consent | Chef mode asks for consent before recording. `POST /recipes` rejects requests without `consent: true` and stores the consent time. The lens shows "● REC" while recording |
| Deletion | `DELETE /recipes/{id}` removes the video and everything derived from it. The review page requires typing the title |
| Wearer awareness | The lens shows "● watching" whenever watcher frames are being sent, and grey when paused or offline |
| Frame retention | Only frames from `/check` calls and from `/watch` calls that returned a warning are stored, in a private bucket. Ordinary watcher frames are not kept |
| Keys | Gemini, Supabase and ElevenLabs keys stay on the server. The phone gets a single-use Live token and signed URLs |
| Uncertainty | `unsure` verdict. The watcher warns only after two consecutive confident hits for the same mistake |
| Audio-only parity | Every lens state has a spoken form, and an audio-only mode serves glasses without a display |
| Display-only parity | Every spoken result is also shown as a heading and a fix line |
| No colour-only meaning | Pass and fix are told apart by icon and words. The glasses display has no colour text anyway |

## Pilot path (proposed, not a partnership)

The first pilot would be a cooking class with one instructor and shared glasses. The instructor records one technique, and each student takes a turn following it. We would measure two things:

- instructor interventions per student
- whether students complete the step unaided

Nobody outside the team has used Echo yet.

## What we claim and what we don't

| We say | Because |
|---|---|
| "Recorded on Meta glasses" | One real Chef-mode take on borrowed glasses is recorded in `ios/STATUS.md` |
| "Gemini turns a chef's video into checkable steps" | That take was processed on production into a published recipe |
| Latency numbers | Only the measured values in [EVALUATION.md](EVALUATION.md) |

**We don't say** "works for any recipe", "first", "only", or any accuracy percentage. Accuracy has not been measured on labelled frames.

**Related work:** AROMA connects a wearable camera, recipe video and cooking assistance for blind and low-vision users ([paper](https://arxiv.org/abs/2507.10963)). The difference we aim to show: checkpoints the chef has approved, with source evidence, and a correct-and-recheck loop.
