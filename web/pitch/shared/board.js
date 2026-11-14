// Echo film illustrations, art direction v2: a tactile, matte, top-down sandwich board (what the glasses see) and a
// finished sandwich. Texture comes from SVG noise filters (crumb grain, slate, pesto), light is directional, and there
// are no cartoon hands. Every visual state is set by `set(state)`, a pure function of its inputs.
const NS = "http://www.w3.org/2000/svg";
let uid = 0;

export function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.append(n);
  return n;
}

const lerp = (a, b, p) => a + (b - a) * p;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export const FOOD = { amber: "#ffb020", green: "#34d27b", cyan: "#9ddcff" };

/** Bread-slice silhouette (crown on top), centred on cx, cy. */
export function sliceD(cx, cy, w = 330, h = 350) {
  const L = cx - w / 2, R = cx + w / 2, T = cy - h / 2, B = cy + h / 2;
  return `M ${L + 30} ${B} L ${R - 30} ${B} Q ${R} ${B} ${R} ${B - 30} L ${R} ${T + 112}
    C ${R + 36} ${T + 100} ${R + 30} ${T + 16} ${R - 42} ${T + 8} C ${cx + 62} ${T - 10} ${cx - 62} ${T - 10} ${L + 42} ${T + 8}
    C ${L - 30} ${T + 16} ${L - 36} ${T + 100} ${L} ${T + 112} L ${L} ${B - 30} Q ${L} ${B} ${L + 30} ${B} Z`;
}

/** A closed wavy blob (ham, lettuce): n points, radius jitter `j`. */
function blobD(cx, cy, rx, ry, seed, j = 0.08, n = 26) {
  const r = seeded(seed);
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * j * 2;
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  let d = `M ${((pts[0][0] + pts[1][0]) / 2).toFixed(1)} ${((pts[0][1] + pts[1][1]) / 2).toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], q = pts[(i + 1) % n];
    d += ` Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  }
  return d + " Z";
}

function defsFor(svg, id) {
  const d = el("defs", {}, svg);
  const u = (n) => `url(#${id}-${n})`;
  const grad = (type, gid, stops, attrs = {}) => {
    const g = el(type, { id: `${id}-${gid}`, ...attrs }, d);
    stops.forEach(([o, c, op = 1]) => el("stop", { offset: o, "stop-color": c, "stop-opacity": op }, g));
  };
  grad("radialGradient", "crumb", [[0, "#f4e2bc"], [0.6, "#e8cd98"], [1, "#d3ad6c"]], { cx: "38%", cy: "32%", r: "80%" });
  grad("linearGradient", "crust", [[0, "#c8853f"], [0.55, "#9c5d27"], [1, "#6e3f18"]], { x1: 0.2, y1: 0, x2: 0.6, y2: 1 });
  grad("radialGradient", "slate", [[0, "#2e3136"], [0.6, "#202327"], [1, "#141619"]], { cx: "34%", cy: "28%", r: "90%" });
  grad("radialGradient", "ham", [[0, "#e7a3a1"], [0.7, "#d98785"], [1, "#c46e70"]], { cx: "38%", cy: "34%", r: "70%" });
  grad("linearGradient", "cheese", [[0, "#f4c65a"], [1, "#e3a33a"]], { x1: 0, y1: 0, x2: 1, y2: 1 });
  grad("radialGradient", "lett", [[0, "#8fb65a"], [0.6, "#618f38"], [1, "#3c6623"]], { cx: "46%", cy: "40%", r: "64%" });
  grad("radialGradient", "pesto", [[0, "#7e9f3c"], [1, "#536f24"]], { cx: "44%", cy: "38%", r: "66%" });
  grad("radialGradient", "key", [[0, "#ffe9c9", 0.2], [0.55, "#ffe9c9", 0.05], [1, "#000", 0]], { cx: "28%", cy: "18%", r: "85%" });
  grad("radialGradient", "vig", [[0.55, "#000", 0], [1, "#000", 0.55]], { cx: "50%", cy: "50%", r: "75%" });
  const filter = (fid, build, box = "-30%") => { const f = el("filter", { id: `${id}-${fid}`, x: box, y: box, width: "160%", height: "160%" }, d); build(f); };
  const shadow = (fid, dx, dy, sd, op) => filter(fid, (f) => el("feDropShadow", { dx, dy, stdDeviation: sd, "flood-color": "#000", "flood-opacity": op }, f));
  shadow("sh", 10, 22, 22, 0.55);
  shadow("sh2", 4, 8, 6, 0.4);
  // grain: noise coloured `rgb`, alpha from the noise, kept inside the shape it is applied to
  const grain = (fid, freq, [r, g, b], a, seed) => filter(fid, (f) => {
    el("feTurbulence", { type: "fractalNoise", baseFrequency: freq, numOctaves: 3, seed, result: "n" }, f);
    el("feColorMatrix", { in: "n", type: "matrix", values: `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${a} ${-a * 0.42}`, result: "c" }, f);
    el("feComposite", { in: "c", in2: "SourceAlpha", operator: "in" }, f);
  }, "0%");
  grain("gCrumb", 0.55, [0.42, 0.26, 0.1], 2.4, 3);
  grain("gCrumb2", 0.09, [0.36, 0.2, 0.05], 1.4, 8);
  grain("gSlate", 0.8, [0.75, 0.78, 0.82], 0.9, 5);
  grain("gPesto", 0.35, [0.12, 0.18, 0.05], 2.2, 2);
  grain("gHam", 0.06, [1, 0.85, 0.85], 1.2, 7);
  // organic edge for spread and lettuce
  filter("rough", (f) => {
    el("feTurbulence", { type: "fractalNoise", baseFrequency: 0.035, numOctaves: 2, seed: 4, result: "t" }, f);
    el("feDisplacementMap", { in: "SourceGraphic", in2: "t", scale: 22, xChannelSelector: "R", yChannelSelector: "G" }, f);
  });
  const hatch = el("pattern", { id: `${id}-hatch`, width: 16, height: 16, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, d);
  el("rect", { width: 16, height: 16, fill: FOOD.amber, opacity: 0.18 }, hatch);
  el("rect", { width: 5, height: 16, fill: FOOD.amber, opacity: 0.75 }, hatch);
  return { d, u };
}

function slice(parent, u, cx, cy, w = 330, h = 350) {
  const g = el("g", {}, parent);
  const d = sliceD(cx, cy, w, h);
  const inner = (s) => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;
  el("path", { d, fill: u("crust"), filter: u("sh") }, g);
  el("path", { d, fill: u("crumb"), transform: inner(0.9) }, g);
  el("path", { d, fill: "#000", transform: inner(0.9), filter: u("gCrumb2") }, g);
  el("path", { d, fill: "#000", transform: inner(0.9), filter: u("gCrumb") }, g);
  const spread = el("g", { opacity: 0 }, g);
  el("path", { d, fill: u("pesto"), transform: inner(0.72), filter: u("rough") }, spread);
  el("path", { d, fill: "#000", transform: inner(0.72), filter: u("gPesto") }, spread);
  return { g, d, inner, spread };
}

function ham(parent, u, seed) {
  const g = el("g", { filter: u("sh2") }, parent);
  const d = blobD(0, 0, 104, 98, seed, 0.06);
  el("path", { d, fill: "#f0c4c0" }, g); // fat rim
  el("path", { d: blobD(0, 0, 94, 88, seed, 0.06), fill: u("ham") }, g);
  el("path", { d: blobD(0, 0, 94, 88, seed, 0.06), fill: "#000", filter: u("gHam") }, g);
  el("path", { d: `M -60 -20 Q -10 -46 50 -28`, stroke: "#f6d2cf", "stroke-width": 5, fill: "none", opacity: 0.45, "stroke-linecap": "round" }, g);
  return g;
}

function cheese(parent, u) {
  const g = el("g", { filter: u("sh2") }, parent);
  el("rect", { x: -82, y: -82, width: 164, height: 164, rx: 6, fill: u("cheese") }, g);
  el("rect", { x: -82, y: -82, width: 164, height: 164, rx: 6, fill: "none", stroke: "#fbe0a0", "stroke-width": 3, opacity: 0.6 }, g);
  return g;
}

// Filling on the base slice, relative to its centre. s = spread (covers the slice to the crust), p = piled up.
const PIECES = [
  { k: "ham", seed: 3, s: [-70, -78, -10], p: [-10, 4, 24] },
  { k: "ham", seed: 5, s: [72, -74, 12], p: [14, -6, -34] },
  { k: "ham", seed: 7, s: [-70, 76, 6], p: [-4, 14, 70] },
  { k: "ham", seed: 9, s: [72, 78, -8], p: [10, 8, -60] },
  { k: "cheese", s: [-40, -8, 6], p: [0, 0, 40] },
  { k: "cheese", s: [44, 18, -10], p: [6, 4, -14] },
];

/**
 * A board seen from above: two slices; the right one carries lettuce and the filling.
 * state: { spread, lettuce, pieces (0..1 placed), fill (0 piled .. 1 spread to the crust), warn, ok,
 *          target (0..1 chef outlines where each piece belongs), targetColor, top, light }
 */
export function createBoard({ board = true } = {}) {
  const id = `bd${++uid}`;
  const svg = el("svg", { viewBox: "0 0 1000 640", width: 1000, height: 640, overflow: "visible" });
  const { d: defs, u } = defsFor(svg, id);
  const root = el("g", {}, svg);
  const boardG = el("g", { opacity: board ? 1 : 0 }, root);
  el("rect", { x: 26, y: 26, width: 948, height: 588, rx: 30, fill: u("slate"), filter: u("sh") }, boardG);
  el("rect", { x: 26, y: 26, width: 948, height: 588, rx: 30, fill: "#000", filter: u("gSlate"), opacity: 0.5 }, boardG);
  el("rect", { x: 27.5, y: 27.5, width: 945, height: 585, rx: 29, fill: "none", stroke: "#fff", "stroke-opacity": 0.07, "stroke-width": 3 }, boardG);
  const L = { cx: 285, cy: 322 }, R = { cx: 705, cy: 322 };
  const top = slice(root, u, L.cx, L.cy);
  const base = slice(root, u, R.cx, R.cy);
  const lett = el("g", { opacity: 0, filter: u("sh2") }, base.g);
  el("path", { d: blobD(R.cx, R.cy + 4, 134, 140, 9, 0.09, 40), fill: u("lett"), filter: u("rough") }, lett);
  el("path", { d: blobD(R.cx, R.cy + 4, 134, 140, 9, 0.09, 40), fill: "#000", filter: u("gPesto"), opacity: 0.8 }, lett);
  [[-70, -90], [60, -100], [-90, 50], [80, 70], [0, -120], [10, 110]].forEach(([dx, dy]) =>
    el("path", { d: `M ${R.cx} ${R.cy} Q ${R.cx + dx * 0.4} ${R.cy + dy * 0.6} ${R.cx + dx} ${R.cy + dy}`, stroke: "#d6efb3", "stroke-opacity": 0.4, "stroke-width": 2.5, fill: "none" }, lett));
  const clip = el("clipPath", { id: `${id}-fclip` }, defs);
  el("path", { d: base.d, transform: base.inner(0.97) }, clip);
  const fillG = el("g", { "clip-path": `url(#${id}-fclip)` }, base.g);
  const pileShadow = el("ellipse", { cx: R.cx + 6, cy: R.cy + 20, rx: 74, ry: 64, fill: "#1b0d04", opacity: 0, filter: u("sh2") }, fillG);
  const pieces = PIECES.map((P) => ({ P, g: P.k === "ham" ? ham(fillG, u, P.seed) : cheese(fillG, u) }));

  // where the chef's filling sits: outlines of each piece at its spread position (the reference, as lines)
  const targets = el("g", { opacity: 0, fill: "none", "stroke-width": 4, "stroke-linejoin": "round" }, base.g);
  const targetShapes = PIECES.map((P) => {
    const t = `translate(${R.cx + P.s[0]} ${R.cy + P.s[1]}) rotate(${P.s[2]})`;
    return P.k === "ham" ? el("path", { d: blobD(0, 0, 104, 98, P.seed, 0.06), transform: t, "stroke-dasharray": "10 8" }, targets)
      : el("rect", { x: -82, y: -82, width: 164, height: 164, rx: 6, transform: t, "stroke-dasharray": "10 8" }, targets);
  });
  el("path", { d: base.d, transform: base.inner(0.97), "stroke-width": 3, opacity: 0.6 }, targets);

  // bare bread: hatched amber where the crumb shows around a central pile
  const mask = el("mask", { id: `${id}-edge` }, defs);
  el("path", { d: base.d, fill: "#fff", transform: base.inner(0.9) }, mask);
  const hole = el("ellipse", { cx: R.cx + 4, cy: R.cy + 8, rx: 96, ry: 88, fill: "#000" }, mask);
  const warn = el("g", { opacity: 0 }, base.g);
  el("rect", { x: R.cx - 220, y: R.cy - 220, width: 440, height: 440, fill: u("hatch"), mask: `url(#${id}-edge)` }, warn);
  el("path", { d: base.d, transform: base.inner(0.9), fill: "none", stroke: FOOD.amber, "stroke-width": 4 }, warn);
  const ok = el("path", { d: base.d, transform: base.inner(0.92), fill: "none", stroke: FOOD.green, "stroke-width": 7, opacity: 0 }, base.g);
  el("rect", { x: 26, y: 26, width: 948, height: 588, rx: 30, fill: u("key"), "pointer-events": "none" }, root);

  return {
    svg,
    centre: R,
    set(s = {}) {
      boardG.setAttribute("opacity", String(s.board ?? (board ? 1 : 0)));
      top.g.setAttribute("opacity", String(s.top ?? 1));
      top.spread.setAttribute("opacity", String(0.62 * (s.spread ?? 1)));
      base.spread.setAttribute("opacity", String(0.62 * (s.spread ?? 1)));
      lett.setAttribute("opacity", String(s.lettuce ?? 1));
      const f = clamp(s.fill ?? 1), placed = clamp(s.pieces ?? 1) * pieces.length;
      pileShadow.setAttribute("opacity", String(0.22 * (1 - f) * clamp(placed / 2)));
      pieces.forEach(({ P, g }, i) => {
        const q = clamp(placed - i);
        const scale = lerp(P.k === "ham" ? 0.5 : 0.44, 1, f) * lerp(1.15, 1, q);
        const x = R.cx + lerp(P.p[0], P.s[0], f), y = R.cy + lerp(P.p[1], P.s[1], f) - 60 * (1 - q);
        g.setAttribute("transform", `translate(${x} ${y}) rotate(${lerp(P.p[2], P.s[2], f)}) scale(${scale})`);
        g.setAttribute("opacity", String(q));
      });
      // the bare area shrinks as the filling spreads
      hole.setAttribute("rx", String(lerp(96, 190, f)));
      hole.setAttribute("ry", String(lerp(88, 200, f)));
      warn.setAttribute("opacity", String(s.warn ?? 0));
      ok.setAttribute("opacity", String(s.ok ?? 0));
      targets.setAttribute("opacity", String(s.target ?? 0));
      targets.setAttribute("stroke", s.targetColor ?? FOOD.cyan);
      targetShapes.forEach((t) => t.setAttribute("stroke-dasharray", s.targetSolid ? "none" : "10 8"));
    },
  };
}

/** The finished, closed sandwich from above. set({ knife, cut }): the knife draws corner to corner, then the halves part. */
export function createSandwich() {
  const id = `sw${++uid}`;
  const svg = el("svg", { viewBox: "0 0 800 700", width: 800, height: 700, overflow: "visible" });
  const { d: defs, u } = defsFor(svg, id);
  const cx = 400, cy = 350;
  const body = el("g", { id: `${id}-body` }, defs);
  el("path", { d: sliceD(cx + 10, cy + 12, 420, 444), fill: u("crust"), filter: u("sh") }, body);
  el("path", { d: blobD(cx + 6, cy + 10, 214, 226, 4, 0.07, 36), fill: u("lett"), filter: u("rough") }, body);
  [[-160, -40, 3], [150, 50, 5], [30, 196, 7], [-130, 170, 9]].forEach(([dx, dy, seed]) => {
    const g = el("g", { transform: `translate(${cx + dx} ${cy + dy}) scale(0.8)` }, body);
    el("path", { d: blobD(0, 0, 104, 98, seed, 0.06), fill: "#f0c4c0" }, g);
    el("path", { d: blobD(0, 0, 94, 88, seed, 0.06), fill: u("ham") }, g);
  });
  const topD = sliceD(cx, cy, 420, 444);
  const inner = `translate(${cx} ${cy}) scale(0.9) translate(${-cx} ${-cy})`;
  el("path", { d: topD, fill: u("crust"), filter: u("sh2") }, body);
  el("path", { d: topD, fill: u("crumb"), transform: inner }, body);
  el("path", { d: topD, fill: "#000", transform: inner, filter: u("gCrumb2") }, body);
  el("path", { d: topD, fill: "#000", transform: inner, filter: u("gCrumb") }, body);
  // diagonal cut corner to corner: halves A (upper right) and B (lower left)
  const line = [[190, 128], [610, 572]];
  const k = (line[1][1] - line[0][1]) / (line[1][0] - line[0][0]);
  const yAt = (x) => line[0][1] + k * (x - line[0][0]);
  const ca = el("clipPath", { id: `${id}-a` }, defs);
  el("polygon", { points: `0,${yAt(0)} 800,${yAt(800)} 800,-200 0,-200` }, ca);
  const cb = el("clipPath", { id: `${id}-b` }, defs);
  el("polygon", { points: `0,${yAt(0)} 800,${yAt(800)} 800,900 0,900` }, cb);
  // the cross-section, revealed in the gap as the halves part
  const sliceClip = el("clipPath", { id: `${id}-s` }, defs);
  el("path", { d: sliceD(cx + 4, cy + 6, 424, 448) }, sliceClip);
  const cross = el("g", { "clip-path": `url(#${id}-s)`, opacity: 0 }, svg);
  const nrm = [-k / Math.hypot(1, k), 1 / Math.hypot(1, k)];
  ["#e3c48e", "#6f9f3c", "#7fae4c", "#d98785", "#f0c4c0", "#e8ae45", "#d98785", "#7fae4c", "#e3c48e"].forEach((c, i) => {
    const o = (i - 4) * 5.5;
    el("line", { x1: line[0][0] - 40 + nrm[0] * o, y1: yAt(line[0][0] - 40) + nrm[1] * o, x2: line[1][0] + 40 + nrm[0] * o, y2: yAt(line[1][0] + 40) + nrm[1] * o, stroke: c, "stroke-width": 6.5 }, cross);
  });
  const halfA = el("g", { "clip-path": `url(#${id}-a)` }, svg);
  el("use", { href: `#${id}-body` }, halfA);
  const halfB = el("g", { "clip-path": `url(#${id}-b)` }, svg);
  el("use", { href: `#${id}-body` }, halfB);
  const knife = el("line", { x1: line[0][0] - 30, y1: yAt(line[0][0] - 30), x2: line[1][0] + 30, y2: yAt(line[1][0] + 30), stroke: "#f4f7fb", "stroke-width": 4, "stroke-linecap": "round", opacity: 0 }, svg);
  const len = Math.hypot(line[1][0] - line[0][0] + 60, yAt(line[1][0] + 30) - yAt(line[0][0] - 30));
  knife.setAttribute("stroke-dasharray", `${len} ${len}`);
  const nx = 1 / Math.hypot(1, k), ny = -k / Math.hypot(1, k);
  return {
    svg,
    set(s = {}) {
      const kn = clamp(s.knife ?? 0), cut = clamp(s.cut ?? 0);
      knife.setAttribute("opacity", String(kn > 0 && cut < 1 ? 0.85 * (1 - cut) : 0));
      knife.setAttribute("stroke-dashoffset", String(len * (1 - kn)));
      const dd = 22 * cut;
      cross.setAttribute("opacity", String(cut > 0 ? 1 : 0));
      halfA.setAttribute("transform", `translate(${-ny * dd} ${-nx * dd})`);
      halfB.setAttribute("transform", `translate(${ny * dd} ${nx * dd})`);
    },
  };
}
