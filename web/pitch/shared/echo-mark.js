// The Echo ripple mark (web/assets/logos/echo-ripple-mark.svg): three concentric arcs, open to the right.
// createMark() animates it (draw-on, scale); createRipple() is the same arc family used as an expanding burst,
// the film's recurring motif: guidance echoing out from a point.
import { el } from "./board.js";

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;

/** Arc of radius r around (cx, cy), open on the right (from +45° round to -45°), like the logo. */
export function arcD(cx, cy, r) {
  const c = Math.SQRT1_2 * r;
  return `M ${cx + c} ${cy + c} A ${r} ${r} 0 1 1 ${cx + c} ${cy - c}`;
}

export const MARK = [
  { r: 25, color: "#f6fbff" },
  { r: 17, color: "#9ddcff" },
  { r: 9, color: "#f6fbff" },
];

/** The mark as an SVG (viewBox 64x64). set({ draw, spin, glow }): draw 0..1 draws the arcs outside-in. */
export function createMark({ stroke = 3.5 } = {}) {
  const svg = el("svg", { viewBox: "0 0 64 64", overflow: "visible" });
  const g = el("g", { fill: "none", "stroke-width": stroke, "stroke-linecap": "round" }, svg);
  const arcs = MARK.map((m) => {
    const p = el("path", { d: arcD(32, 32, m.r), stroke: m.color }, g);
    const len = 2 * Math.PI * m.r * 0.75;
    p.setAttribute("stroke-dasharray", `${len} ${len}`);
    return { p, len };
  });
  return {
    svg,
    set({ draw = 1, spin = 0, glow = 0 } = {}) {
      arcs.forEach(({ p, len }, i) => {
        const q = clamp(draw * 1.6 - i * 0.3);
        p.setAttribute("stroke-dashoffset", String(len * (1 - q)));
      });
      g.setAttribute("transform", `rotate(${spin} 32 32)`);
      svg.style.filter = glow > 0.01 ? `drop-shadow(0 0 ${18 * glow}px rgba(157,220,255,${0.7 * glow}))` : "none";
    },
  };
}

/** An expanding three-arc burst. set(p): 0..1 over the burst; colour per call. Lives in a 200x200 viewBox. */
export function createRipple({ color = "#9ddcff", width = 3 } = {}) {
  const svg = el("svg", { viewBox: "-100 -100 200 200", overflow: "visible" });
  const arcs = [0, 1, 2].map(() => el("path", { d: arcD(0, 0, 40), fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }, svg));
  return {
    svg,
    set(p, col) {
      arcs.forEach((a, i) => {
        const q = clamp((p - i * 0.12) / 0.76);
        a.setAttribute("transform", `scale(${lerp(0.25, 2.3, 1 - (1 - q) ** 3)})`);
        a.setAttribute("opacity", String(q > 0 && q < 1 ? Math.sin(q * Math.PI) * 0.95 : 0));
        if (col) a.setAttribute("stroke", col);
      });
    },
  };
}
