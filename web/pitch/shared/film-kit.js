// Timing and motion helpers shared by the film and the deck.
// Every helper is a pure function of its inputs, so a frame depends only on t.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;

// cubic-bezier(x1, y1, x2, y2) as a function of x in [0, 1]
function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

/** The brand ease: web/shared/ui.css --ease-out, cubic-bezier(0.16, 1, 0.3, 1). */
export const ease = bezier(0.16, 1, 0.3, 1);
/** Linear progress of t through [a, b]. */
export const lin = (t, a, b) => clamp((t - a) / (b - a));
/** Eased progress of t through [a, b]. */
export const seg = (t, a, b) => ease(lin(t, a, b));
/** In over [a, b], out over [c, d]. */
export const win = (t, a, b, c, d) => seg(t, a, b) * (1 - seg(t, c, d));

export function setStyle(el, styles) {
  for (const [k, v] of Object.entries(styles)) el.style[k] = v;
}

/**
 * Builds a headline of masked words.
 * lines: [[{ t: "The video can't see" }], [{ t: "your board.", accent: true }]]
 * Returns the inner word spans in reading order.
 */
export function buildHeadline(el, lines) {
  el.textContent = "";
  const words = [];
  lines.forEach((line, li) => {
    if (li > 0) el.append(document.createElement("br"));
    line.forEach((part) => {
      part.t.split(" ").filter(Boolean).forEach((w) => {
        const mask = document.createElement("span");
        mask.className = "mask";
        const inner = document.createElement("span");
        if (part.accent) inner.className = "accent";
        inner.textContent = w;
        mask.append(inner);
        el.append(mask, document.createTextNode(" "));
        words.push(inner);
      });
    });
  });
  return words;
}

/** Words rise into their masks from `start`, one every `stagger` s, each over `dur` s. */
export function riseWords(words, t, start, { stagger = 0.06, dur = 0.8 } = {}) {
  words.forEach((w, i) => {
    const p = seg(t, start + i * stagger, start + i * stagger + dur);
    w.style.transform = `translateY(${(1 - p) * 135}%)`; // starts below the mask, which has room for descenders
    w.style.opacity = String(clamp(p * 1.6));
  });
}

const lengths = new WeakMap();
function shapes(el) {
  return typeof el.getTotalLength === "function" ? [el] : [...el.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon")];
}

/** Stroke draw-on for an SVG shape or every shape in a group; p in [0, 1]. */
export function drawOn(el, p) {
  for (const s of shapes(el)) {
    let len = lengths.get(s);
    if (len === undefined) {
      len = s.getTotalLength();
      lengths.set(s, len);
    }
    s.style.strokeDasharray = `${len} ${len}`;
    s.style.strokeDashoffset = String(len * (1 - p));
  }
}
