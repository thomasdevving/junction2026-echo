# Echo pitch: visual system (film + deck)

> One system for the film, the deck and the website. Values come from `web/shared/ui.css` and `web/home.css`; [shared/tokens.css](shared/tokens.css) imports `ui.css` directly, so the website stays the source of truth.

## Stage
- 1920×1080, 30 fps. Safe area 96 px. Background = the website's body gradient (`--stage-bg-image`).
- Few elements per frame, big type, lots of air. One idea per frame or slide.

## Type (Manrope, vendored in `shared/fonts/`, SIL OFL 1.1)
| Role | Size / weight / tracking | Notes |
|---|---|---|
| Headline | 104 px (deck 84–96) / 500 / −0.065em, line-height 1.06 | White; **one** accent phrase in `--accent-gradient` (the website's "point of view." treatment) |
| Eyebrow | 22 px / 700 / 0.19em, uppercase | `#c6dffb` with the ring dot (`.eyebrow-orbit`) |
| Lede (deck) | 40 px / 400 | `--text-dim`, max 40ch |
| Small print | 24 px | `--text-faint` |
| Label chip | 20 px / 700 / 0.16em, uppercase | Dark glass pill, bottom-left: `Illustration`, `Real footage`, `Next`… |
| Logo | `echo` 500 / −0.055em | The **ripple mark** (`web/assets/logos/echo-ripple-mark.svg`: three open arcs, white / `#9ddcff` / white). No period. In the film it is drawn by `shared/echo-mark.js` and is the recurring motif (ripples). |

## Colour
Brand blues `--echo-sky #0082fb`, `--echo-blue #0064e0`, sky text `#3d9dfc`; text `#fff` / dim `#ccdaef` / faint `#adc4df`; glass surface + hairline from `ui.css`. Status colours only where they mean status: amber `#ffb020` fix/warning, green `#34d27b` pass. Never colour alone: every status also has an icon and a word.

## Components (built once in `shared/`, used by film and deck)
- `film-kit.js`: brand ease `cubic-bezier(0.16, 1, 0.3, 1)`, `seg`, `win`, masked rising headlines (`buildHeadline` / `riseWords`), stroke draw-on.
- `moment-art.js`: the part A / slide 1 line-art (Illustration).
- `arch-diagram.js`: the architecture diagram (part C / slide 4), 9 boxes, animatable per node, link and chip.
- Lens card and caption overlay: built in Phase 4 (lens reuses `web/shared/lens.css`).

## Motion
- Every move uses the brand ease; nothing snaps, nothing bounces.
- Headlines: words rise through masks, 0.06 s stagger, 0.8 s each.
- Line-art draws on along its strokes. Scene changes: content dims and blurs out while the next eyebrow rises, or a soft light streak sweeps across. Hard cuts only into and out of the real footage.
- Every frame is a pure function of `t` (`window.renderFrame(t)`), so any frame can be re-rendered on its own.

## Labels (honesty rules, gate1 §2)
`Illustration` on drawn scenes · `Real footage · Meta Ray-Ban Display · recorded ⟨date⟩` on the real block · `Lens view, reconstructed by the monitor` / `Lens view, recorded on the glasses` · `Next` on future features · `Proposed` on the pilot.
