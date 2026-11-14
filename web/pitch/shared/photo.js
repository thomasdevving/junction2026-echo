// Echo film, final pass: photographic building blocks from video/assets (library-v2 + generated-v1).
// Paths are relative to web/pitch/video/film.html. Only these assets are loaded by the film.
//
// Physical scale is fixed: in a plate, 1000 units = the board's visible width = 40 cm (25 units/cm).
// Images are placed by their VISIBLE (alpha) bounds, not their canvas, so padding never changes apparent size.
import { sliceD } from "./board.js";

const LIB = "assets/library-v2/images/";
const GEN = "assets/generated-v1/";
export const ASSET = {
  board: { src: LIB + "walnut-board.png", w: 1536, h: 1024, vb: [66, 90, 1470, 934] },
  bread: { src: LIB + "bread-slice.png", w: 1254, h: 1254, vb: [122, 131, 1115, 1154] },
  lettuce: { src: LIB + "lettuce-leaf.png", w: 1312, h: 1199, vb: [66, 41, 1247, 1156] },
  gouda: { src: LIB + "gouda-slice.png", w: 1254, h: 1254, vb: [142, 154, 1107, 1100] },
  ham: { src: LIB + "ham-fold.png", w: 1254, h: 1254, vb: [74, 86, 1174, 1174] },
  pesto: { src: LIB + "pesto-smear.png", w: 1254, h: 1254, vb: [81, 367, 1173, 892] },
  sandwich: { src: LIB + "sandwich-hero.png", w: 1536, h: 1024, vb: [75, 76, 1439, 973] },
  phone: { src: LIB + "phone-blank.png", w: 1254, h: 1254, vb: [363, 84, 891, 1171] },
  hinge: { src: LIB + "glasses-hinge-macro.png", w: 1774, h: 887, vb: [0, 0, 1774, 887] },
  stage: { src: LIB + "midnight-product-stage.png", w: 1672, h: 941, vb: [0, 0, 1672, 941] },
  glasses: { src: GEN + "glasses-front-cutout.png", w: 1774, h: 887, vb: [0, 0, 1774, 887] },
};

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;
const io = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);

export function photo(parent, a, cls = "") {
  const img = document.createElement("img");
  img.src = a.src;
  img.alt = "";
  img.className = `ph ${cls}`;
  img.draggable = false;
  parent.append(img);
  return img;
}

/** Size and place `img` so its VISIBLE object is `width` units wide, centred at (cx, cy), rotated `rot` degrees. */
export function put(img, a, cx, cy, width, rot = 0) {
  const [x0, y0, x1, y1] = a.vb;
  const s = width / (x1 - x0), vx = ((x0 + x1) / 2) * s, vy = ((y0 + y1) / 2) * s;
  img.style.width = `${a.w * s}px`;
  img.style.height = `${a.h * s}px`;
  img.style.left = `${cx - vx}px`;
  img.style.top = `${cy - vy}px`;
  img.style.transformOrigin = `${vx}px ${vy}px`;
  img.style.transform = `rotate(${rot}deg)`;
}

// ---------- the plate: board, two slices, pesto, lettuce, and four filling pieces of fixed size ----------
const SIZE = { ham: 196, gouda: 166 }; // 7.8 cm ham, 6.6 cm Gouda, on 11.5 cm bread
// s = spread to the edges (each piece in its own quadrant, staying on the bread), p = piled in the middle.
// The same four pieces, at the same size, either way: only position and rotation change.
const PIECES = [
  { k: "ham", s: [660, 280, -10], p: [697, 322, 14] },
  { k: "gouda", s: [740, 278, 8], p: [704, 316, 32] },
  { k: "ham", s: [740, 362, 18], p: [703, 330, -22] },
  { k: "gouda", s: [660, 364, -6], p: [695, 326, -8] },
];
const BREAD_W = 288; // 11.5 cm

/**
 * createPlate(): a top-down board, 1000x640 units (the parent scales it).
 * set({ board, spread, lettuce, placed (0..1 pieces put down), fill (0 piled .. 1 spread), ghost (0..1 chef's
 *       arrangement as a cool ghost above), cue (0..1 single amber outline of the bread edge), left (left slice) })
 */
export function createPlate() {
  const el = document.createElement("div");
  el.className = "plate";
  const boardImg = photo(el, ASSET.board, "board");
  put(boardImg, ASSET.board, 500, 320, 1000);
  const breadL = photo(el, ASSET.bread);
  put(breadL, ASSET.bread, 300, 320, BREAD_W, -2);
  const breadR = photo(el, ASSET.bread);
  put(breadR, ASSET.bread, 700, 320, BREAD_W, 1);
  const pestoL = photo(el, ASSET.pesto);
  put(pestoL, ASSET.pesto, 300, 334, 196, -24);
  const pestoR = photo(el, ASSET.pesto);
  put(pestoR, ASSET.pesto, 700, 334, 196, -18);
  const lett = photo(el, ASSET.lettuce);
  put(lett, ASSET.lettuce, 700, 326, 232, 12);
  const pieces = PIECES.map((P) => ({ P, img: photo(el, ASSET[P.k], "piece") }));
  const ghosts = PIECES.map((P) => { const g = photo(el, ASSET[P.k], "ghost"); put(g, ASSET[P.k], P.s[0], P.s[1], SIZE[P.k], P.s[2]); return g; });
  const cue = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  cue.setAttribute("viewBox", "0 0 1000 640");
  cue.setAttribute("class", "plate-cue");
  cue.innerHTML = `<path d="${sliceD(700, 320, 268, 278)}" fill="none" stroke="#ffb020" stroke-width="5" stroke-linejoin="round"/>`;
  el.append(cue);

  return {
    el,
    set(s = {}) {
      boardImg.style.opacity = String(s.board ?? 1);
      breadL.style.opacity = String(s.left ?? 1);
      pestoL.style.opacity = String((s.left ?? 1) * (s.spread ?? 1));
      pestoR.style.opacity = String(s.spread ?? 1);
      lett.style.opacity = String(s.lettuce ?? 1);
      const placed = clamp(s.placed ?? 1) * pieces.length, f = clamp(s.fill ?? 1);
      pieces.forEach(({ P, img }, i) => {
        const q = clamp(placed - i);
        // pieces move one after another, each with a smooth start and stop; size never changes
        const fi = io(clamp(f * 1.6 - i * 0.2));
        put(img, ASSET[P.k], lerp(P.p[0], P.s[0], fi), lerp(P.p[1], P.s[1], fi) - 34 * (1 - io(q)), SIZE[P.k], lerp(P.p[2], P.s[2], fi));
        img.style.opacity = String(q > 0 ? Math.min(1, q * 3) : 0);
      });
      ghosts.forEach((g) => (g.style.opacity = String(0.95 * (s.ghost ?? 0))));
      cue.style.opacity = String(s.cue ?? 0);
    },
  };
}

// ---------- the glasses assembly: content below the frame, an exact lens clip, one parent transform ----------
// Lens guide for glasses-front-cutout.png (generated-v1/lens-masks.svg, viewer-left aperture), in image pixels.
export const LENS_PATH = "M260 328 C290 282 395 270 501 280 C622 282 714 308 743 357 C768 400 753 501 723 573 C696 647 661 679 599 689 C524 700 406 699 348 681 C301 663 281 620 261 553 C241 482 227 384 260 328Z";
export const LENS_C = { x: 500, y: 485 };
let rigs = 0;

/**
 * createGlassesRig(scene): a 1774x887 assembly inside `scene`:
 *   [in-lens cue, clipped to the aperture] < [frame PNG] < [reflection, clipped to the aperture] < [edge glint on the frame]
 * plus a screen-space clip (`clip`) with the SAME transform, for showing a full-screen view through the lens.
 * set({ x, y, s, r }): one transform (translate then scale, origin top-left) for everything; optional roll `r`
 * (degrees) about the lens centre, so the lens stays where x/y/s put it.
 */
export function createGlassesRig(scene) {
  const id = `lens-${++rigs}`;
  const defs = document.createElement("div");
  defs.innerHTML = `<svg width="0" height="0" style="position:absolute"><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><path d="${LENS_PATH}"/></clipPath></svg>`;
  scene.append(defs);
  const clipPathEl = defs.querySelector("path");
  const rig = document.createElement("div");
  rig.className = "rig";
  rig.innerHTML = `<div class="rig-cue" style="clip-path: path('${LENS_PATH}')"></div>
    <img class="rig-frame" src="${ASSET.glasses.src}" alt="" draggable="false">
    <div class="rig-glint" style="clip-path: path('${LENS_PATH}')"><i></i></div>
    <div class="rig-edge"><i></i></div>`;
  scene.append(rig);
  return {
    rig,
    cue: rig.querySelector(".rig-cue"),
    glint: rig.querySelector(".rig-glint i"),
    edge: rig.querySelector(".rig-edge i"),
    clip: `url(#${id})`,
    set({ x, y, s, r = 0 }) {
      const L = LENS_C, roll = Math.abs(r) > 0.001;
      rig.style.transform = `translate(${x}px, ${y}px) scale(${s})` + (roll ? ` translate(${L.x}px, ${L.y}px) rotate(${r}deg) translate(${-L.x}px, ${-L.y}px)` : "");
      clipPathEl.setAttribute("transform", `translate(${x} ${y}) scale(${s})` + (roll ? ` rotate(${r} ${L.x} ${L.y})` : ""));
    },
  };
}
