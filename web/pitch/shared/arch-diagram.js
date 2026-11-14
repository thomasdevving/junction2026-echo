// Architecture diagram (film part C, deck slide 4). Mirrors docs/ARCHITECTURE.md §1:
// glasses -> iPhone app -> backend -> Gemini (three jobs), backend -> Supabase,
// and the phone opening Gemini Live directly with a short-lived token. 9 boxes.
const NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.append(n);
  return n;
}

const FONT = "Manrope, sans-serif";
const NODES = [
  { id: "glasses", x: 20, y: 220, w: 230, h: 120, title: "Glasses", sub: "camera · lens · mic" },
  { id: "phone", x: 360, y: 220, w: 230, h: 120, title: "iPhone app", sub: "Cook · Chef mode" },
  { id: "backend", x: 700, y: 220, w: 250, h: 120, title: "Backend", sub: "FastAPI · ffmpeg" },
  { id: "supabase", x: 700, y: 470, w: 250, h: 110, title: "Supabase", sub: "recipes · media" },
  { id: "gemini", x: 1080, y: 10, w: 500, h: 430, title: "Gemini", sub: "" },
  { id: "live", x: 1080, y: 480, w: 500, h: 100, title: "Gemini Live", sub: "spoken questions · voice commands", chip: true },
];
const CHIPS = [
  { id: "video", y: 100, text: "Chef's video → steps", sub: "timestamps · criteria · mistakes" },
  { id: "compare", y: 210, text: "Your view vs the chef's frame", sub: "pass · fix · can't tell" },
  { id: "watch", y: 320, text: "Fast watcher", sub: "the chef's known mistakes" },
];
const LINKS = [
  { id: "glasses-phone", d: "M250 280 L360 280" },
  { id: "phone-backend", d: "M590 280 L700 280" },
  { id: "backend-gemini", d: "M950 280 L1080 280" },
  { id: "backend-supabase", d: "M825 340 L825 470" },
  { id: "phone-live", d: "M475 340 L475 610 L1030 610 L1030 530 L1080 530", label: "short-lived token", lx: 497, ly: 596, anchor: "start" },
];

export function createArch() {
  const svg = el("svg", { viewBox: "0 0 1600 640", width: 1600, height: 640, overflow: "visible" });
  const nodes = {}, links = {}, chips = {};

  for (const L of LINKS) {
    const g = el("g", {}, svg);
    const path = el("path", { d: L.d, fill: "none", stroke: "rgba(205,229,255,0.55)", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    const coords = L.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const end = coords.slice(-2);
    const prev = coords.slice(-4, -2);
    const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const head = el("path", { d: "M-14 -8 L0 0 L-14 8", fill: "none", stroke: "rgba(205,229,255,0.8)", "stroke-width": 3, "stroke-linecap": "round", transform: `translate(${end[0]} ${end[1]}) rotate(${(ang * 180) / Math.PI})` }, g);
    let label = null;
    if (L.label) {
      label = el("text", { x: L.lx, y: L.ly, "text-anchor": L.anchor ?? "middle", fill: "#adc4df", "font-size": 20, "font-family": FONT, "font-weight": 600 }, g);
      label.textContent = L.label;
    }
    links[L.id] = { path, head, label, len: null };
  }

  for (const N of NODES) {
    const g = el("g", {}, svg);
    const box = el("rect", { x: N.x, y: N.y, width: N.w, height: N.h, rx: 24, fill: "rgba(180,213,255,0.07)", stroke: "rgba(205,229,255,0.30)", "stroke-width": 2 }, g);
    const big = N.id === "gemini";
    const title = el("text", { x: N.x + 28, y: N.y + (big ? 58 : N.sub ? 54 : 70), fill: "#ffffff", "font-size": big ? 40 : 32, "font-weight": 600, "font-family": FONT, "letter-spacing": "-0.02em" }, g);
    title.textContent = N.title;
    if (N.sub) {
      const sub = el("text", { x: N.x + 28, y: N.y + 92, fill: "#ccdaef", "font-size": 21, "font-family": FONT, "font-weight": 500 }, g);
      sub.textContent = N.sub;
    }
    nodes[N.id] = { g, box };
    if (N.chip) chips[N.id] = { box, text: null };
  }

  const gem = NODES.find((n) => n.id === "gemini");
  for (const C of CHIPS) {
    const g = el("g", {}, nodes.gemini.g);
    const box = el("rect", { x: gem.x + 28, y: C.y, width: gem.w - 56, height: 96, rx: 30, fill: "rgba(0,130,251,0.08)", stroke: "rgba(61,157,252,0.35)", "stroke-width": 2 }, g);
    const text = el("text", { x: gem.x + 56, y: C.y + 42, fill: "#ffffff", "font-size": 25, "font-weight": 600, "font-family": FONT }, g);
    text.textContent = C.text;
    const sub = el("text", { x: gem.x + 56, y: C.y + 74, fill: "#ccdaef", "font-size": 20, "font-weight": 500, "font-family": FONT }, g);
    sub.textContent = C.sub;
    chips[C.id] = { g, box, text };
  }

  function glow(chip, gl) {
    chip.box.setAttribute("fill", `rgba(0,130,251,${0.08 + 0.3 * gl})`);
    chip.box.setAttribute("stroke", `rgba(61,157,252,${0.35 + 0.65 * gl})`);
    chip.box.style.filter = gl > 0.01 ? `drop-shadow(0 0 ${22 * gl}px rgba(61,157,252,${0.55 * gl}))` : "none";
  }

  return {
    svg,
    ids: { nodes: NODES.map((n) => n.id), links: LINKS.map((l) => l.id), chips: [...CHIPS.map((c) => c.id), "live"] },
    /** state: { node: {id: p}, link: {id: p}, chip: {id: p}, glow: {id: 0..1} }; missing ids count as 1 (node, link, chip) or 0 (glow). */
    update(state = {}) {
      for (const id of Object.keys(nodes)) {
        const p = state.node?.[id] ?? 1;
        nodes[id].g.setAttribute("opacity", String(p));
        nodes[id].g.setAttribute("transform", `translate(0 ${(1 - p) * 18})`);
      }
      for (const [id, L] of Object.entries(links)) {
        const p = state.link?.[id] ?? 1;
        if (L.len === null) L.len = L.path.getTotalLength();
        L.path.style.strokeDasharray = `${L.len} ${L.len}`;
        L.path.style.strokeDashoffset = String(L.len * (1 - p));
        L.head.setAttribute("opacity", p > 0.97 ? "1" : "0");
        if (L.label) L.label.setAttribute("opacity", String(Math.max(0, (p - 0.6) / 0.4)));
      }
      for (const id of CHIPS.map((c) => c.id)) {
        const p = state.chip?.[id] ?? 1;
        chips[id].g.setAttribute("opacity", String(p));
      }
      for (const id of [...CHIPS.map((c) => c.id), "live"]) glow(chips[id], state.glow?.[id] ?? 0);
    },
  };
}
