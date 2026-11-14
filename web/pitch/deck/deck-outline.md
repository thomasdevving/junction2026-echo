# Pitch deck: outline, 3-minute stage talk, 60-second table version (Gate 1 draft)

> Part of the [Gate 1 package](../gate1.md). Same visual system as the film (see gate1 §4). 8 slides, 1920×1080, built as `deck.html` → `deck.pdf`. The demo is the centre; slides are what we show when the demo is not running.
> Stage rules (organizers): **exactly 3 minutes, the mic is cut**, then 3 minutes of questions; one handheld mic; a live demo from our own laptop is allowed. Target spoken length **2:52** to keep margin.
> Claim ids refer to [gate1.md §2](../gate1.md#2-a-claims-table). Placeholders ⟨…⟩ follow the same rule as the film: nothing goes on a slide before it is in `docs/EVALUATION.md` §4.

## 1. Slides

| # | Slide | On the slide (few words, big type) | Speaker notes / claims |
|---|---|---|---|
| 1 | **The moment** | Line-art illustration from film part A. Headline: "The video can't see **your board.**" Eyebrow "THE MOMENT". Chip `Illustration` | C1. The pain: hands busy, no feedback, the mistake shows up at the first bite |
| 2 | **Echo in one sentence** + demo | Logo **echo.** "Cook from the chef's **point of view.**" One line under it: "A chef records once through smart glasses. You cook it hands-free while Gemini compares your view with the chef's." During the demo the laptop switches to the monitor | C1. Switch to the monitor (`/app/monitor/`) for the demo; press B there for the labelled backup if needed |
| 3 | **Why glasses** | Three glass cards: "Same viewpoint as the chef" · "Hands stay on the food" · "It can speak first" | C2. PRODUCT §4. "A propped phone sees a different angle from the one the lesson was filmed at" |
| 4 | **How it works** | The architecture diagram from the film (≤10 boxes) with the four Gemini jobs as chips. Small print: "Meta Device Access Toolkit iOS 1.0.1 · Gemini 3.5 Flash · 3.5 Flash Lite · 3.8 Live · FastAPI · Supabase" | C3, C5, C6, C7, C9, C11. For the Gemini judges: video understanding (steps with timestamps), multi-image comparison against the chef's frame, a fast watcher, Live with function calls. Control lives in our code (debounce, stale-answer rejection, uncertainty) |
| 5 | **Evidence** | E1: "⟨X⟩ of ⟨Y⟩ mistakes caught · ⟨FA⟩ wrong approvals · ~⟨CHECK_P50⟩ s per check" + small print "One recipe · ⟨N⟩ steps · held-out set · our own footage · ⟨date⟩". E2 (no numbers yet): "How we measure: wrong approvals first, then response time" + a "Limits" list | C17–C20 placeholders. Limits list always shown: one recipe, small set, our own footage, borrowed device, ⟨anything that failed⟩. If no user sessions: "Not yet tested with users" (C22) |
| 6 | **Trust** | Cards: "● watching while frames are sent" · "Consent before recording; delete removes everything" · "Can't tell, instead of guessing" · "Warns only after two confident hits" | C12–C15, C8. Audio-only only as "designed for" until IOS-07 runs (C16) |
| 7 | **Who and next** | "For anyone learning **a chef's dish.**" Card: "PROPOSED PILOT · one cooking class · one instructor · shared glasses · success = fewer instructor interventions per student, more steps completed unaided". Chip **NEXT**: "Other hands-on skills" | C21. Say "proposed". Name a contact only if a conversation really happened (WEB-04.3) |
| 8 | **Close** | **echo.** · "Built this weekend at Junction 2026" · `github.com/thomasdevving/junction2026-echo` · team first names | C23. Leave it up during Q&A |

Every slide: eyebrow + one headline + at most three supporting elements. Text readable from 3 m (body ≥ 36 px at 1920 wide; checked by rendering at 25 % size in Phase 5). Nothing carried by colour alone (pass / fix / unsure always have an icon and a word).

## 2. The 3-minute stage talk (one presenter, one mic)

Speaking pace ~140 words per minute. Times are cumulative.

| Time | Slide | Say (about) |
|---|---|---|
| 0:00–0:15 | 1 | "You're making a sandwich from a recipe video. Your hands are full of bread and filling. The video keeps playing, but it can't see your board. It can't tell you the filling is all in the middle." |
| 0:15–0:25 | 2 | "This is Echo. A chef records a recipe once, wearing smart glasses. Then you cook it with the same glasses, and Gemini checks your work against the chef's own view." |
| 0:25–1:10 | 2 → monitor | **Live demo** (a teammate wears the glasses at the board; the monitor is on the big screen). "My teammate is on step four, the fillings. They pile it in the middle, the most common mistake. … Echo compares this view with the chef's reference frame, and speaks first. … One instruction. They spread it to the edges and ask it to check. … It passes." If there is time: "Why spread it to the edges?" and let the answer play |
| 1:10–1:25 | 3 | "Why glasses? The cook's camera sits where the chef's camera sat, so we compare like with like. The hands never leave the food. And because the camera already sees the work, it can speak first." |
| 1:25–1:50 | 4 | "Under the hood, Gemini does four jobs. It turns the chef's video into checkable steps. It compares your view with the chef's frame and says pass, fix, or can't tell. A fast watcher looks only for the chef's known mistakes. And Gemini Live answers questions from the chef's narration. Our own code decides when to speak." |
| 1:50–2:05 | 5 | E1: "On a held-out set from one recipe, it caught ⟨X⟩ of ⟨Y⟩ mistakes and wrongly approved ⟨FA⟩. A check takes about ⟨CHECK_P50⟩ seconds." E2: "We measure wrong approvals first, because telling someone a mistake is fine is the worst failure. The method and its limits are in our repo." |
| 2:05–2:20 | 6 | "It shows when it's watching. The chef agrees before recording and can delete everything. And when it can't see, it says so instead of guessing." |
| 2:20–2:45 | 7 | "Echo is for anyone learning a chef's dish with their hands busy. Our proposed pilot is one cooking class: the instructor records a technique once, every student follows it, and we count how often the instructor still has to step in. After that: any hands-on skill you learn by watching." |
| 2:45–2:52 | 8 | "Echo. Cook from the chef's point of view. Thank you." |

**No-demo fallback line** (glasses or network fail on stage, at 0:25): "Let me show you a run from earlier today, recorded on the glasses." Play the 40 s real block from the film (labelled, from the laptop), then continue at slide 3. It still fits: the block is 40 s against a 45 s demo slot.

**What not to say:** "first", "only", "works for any recipe", a percentage, "pilot partner", "works on the glasses" before `ios/STATUS.md` records an end-to-end run.

## 3. The 60-second table version (peer review)

For reviewers at our table (Innovation, Impact, Implementation). Show, don't describe: start the demo within the first 10 s.

> "Echo: cook from the chef's point of view. A chef records a recipe once with smart glasses; you follow it wearing the same glasses. [Start: filling piled in the middle.] Gemini compares what you see with the chef's own frame, and here it speaks first: filling piled up, spread it to the edges. [Fix, check, pass.] That's the loop. It's new because the reference is the chef's own view from the same angle. It matters because one instructor's attention can reach every learner. And it runs: glasses, iPhone, our backend, Gemini. Want to try it on?"

About 85 words; with the demo running it fits in ~60 s. Timed by reading aloud in Phase 5 (WEB-04.1 acceptance: under 65 s).

## 4. Q&A preparation

Answers to the questions in `docs/DEMO-AND-SUBMISSION.md` §8 go in `web/pitch/qa.md` (WEB-04.7), written after Gate 1 from the claims table only. Not part of this gate.
