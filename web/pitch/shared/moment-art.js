// "The moment" line-art illustration (film part A, deck slide 1). Iconographic, labelled "Illustration" where shown.
// A board with two bread slices, the filling heaped in the middle of the right slice, a phone propped on a jar
// playing the recipe video, and two hands. Strokes only (mist), sky accents, amber for the bare edges.
const NS = "http://www.w3.org/2000/svg";
let uid = 0;

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.append(n);
  return n;
}

const MIST = "#dcecff";
const SKY = "#3d9dfc";
const AMBER = "#ffb020";
const HAND_FILL = "#08203f";
const line = { fill: "none", stroke: MIST, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" };

const SLICE_L = "M140 640 L140 560 C120 560 115 520 150 512 C170 490 220 488 270 490 C320 488 370 490 390 512 C425 520 420 560 400 560 L400 640 Z";
const SLICE_R = "M470 640 L470 560 C450 560 445 520 480 512 C500 490 550 488 600 490 C650 488 700 490 720 512 C755 520 750 560 730 560 L730 640 Z";
const EDGE_R = "M488 626 L488 572 C470 570 470 534 494 528 C512 508 556 506 600 508 C644 506 688 508 706 528 C730 534 730 570 712 572 L712 626 Z";

function hand(parent, x, y, flip) {
  const g = el("g", { transform: `translate(${x} ${y}) scale(${flip ? -1.3 : 1.3} 1.3)` }, parent);
  const style = { ...line, fill: HAND_FILL, "stroke-width": 3 / 1.3 };
  [[-48, -168, 72], [-23, -182, 86], [2, -180, 84], [27, -166, 70]].forEach(([fx, fy, h]) =>
    el("rect", { x: fx, y: fy, width: 22, height: h, rx: 11, ...style }, g));
  el("rect", { x: -18, y: -66, width: 22, height: 64, rx: 11, transform: "rotate(-52 -7 -34)", ...style }, g);
  el("rect", { x: -52, y: -122, width: 104, height: 150, rx: 40, ...style }, g);
  return g;
}

function rightSlice(parent) {
  const g = el("g", {}, parent);
  const slice = el("path", { d: SLICE_R, ...line, fill: "rgba(220,236,255,0.04)" }, g);
  const edge = el("path", { d: EDGE_R, fill: "none", stroke: AMBER, "stroke-width": 4, "stroke-dasharray": "10 10", opacity: 0 }, g);
  const heap = el("g", {}, g);
  [[600, 590, 74, 22], [600, 574, 60, 18], [600, 559, 46, 14], [600, 546, 30, 10]].forEach(([cx, cy, rx, ry]) =>
    el("ellipse", { cx, cy, rx, ry, ...line, fill: "rgba(220,236,255,0.07)" }, heap));
  return { g, slice, edge, heap };
}

export function createMomentArt() {
  const id = `moment${++uid}`;
  const svg = el("svg", { viewBox: "0 0 1000 760", width: 1000, height: 760, overflow: "visible" });
  const defs = el("defs", {}, svg);
  // diagonal split of the right slice: A = left of the cut, B = right of it
  const clipA = el("clipPath", { id: `${id}-a` }, defs);
  el("polygon", { points: "430,460 575,460 640,680 430,680" }, clipA);
  const clipB = el("clipPath", { id: `${id}-b` }, defs);
  el("polygon", { points: "575,460 780,460 780,680 640,680" }, clipB);

  const board = el("g", {}, svg);
  el("path", { d: "M90 500 L860 500 L940 700 L10 700 Z", ...line }, board);
  el("path", { d: "M10 700 L10 718 L940 718 L940 700", ...line }, board);

  const sliceL = el("path", { d: SLICE_L, ...line, fill: "rgba(220,236,255,0.04)" }, svg);
  const halfA = el("g", { "clip-path": `url(#${id}-a)` }, svg);
  const halfB = el("g", { "clip-path": `url(#${id}-b)` }, svg);
  const rA = rightSlice(halfA);
  const rB = rightSlice(halfB);

  const jar = el("g", {}, svg);
  el("rect", { x: 60, y: 320, width: 110, height: 150, rx: 18, ...line }, jar);
  el("rect", { x: 53, y: 305, width: 124, height: 22, rx: 8, ...line }, jar);

  const phone = el("g", { transform: "rotate(-10 230 460)" }, svg);
  el("rect", { x: 170, y: 230, width: 120, height: 230, rx: 18, ...line, fill: "#06162c" }, phone);
  el("rect", { x: 182, y: 252, width: 96, height: 168, rx: 8, ...line, stroke: SKY, "stroke-width": 2 }, phone);
  el("path", { d: "M218 314 L218 352 L250 333 Z", ...line, stroke: SKY }, phone);
  el("line", { x1: 192, y1: 400, x2: 268, y2: 400, ...line, "stroke-width": 2 }, phone);
  el("line", { x1: 192, y1: 400, x2: 222, y2: 400, ...line, stroke: SKY, "stroke-width": 4 }, phone);

  const hands = el("g", {}, svg);
  hand(hands, 300, 830, false);
  hand(hands, 690, 840, true);

  // the phone's line of sight: stops short of the board
  const sight = el("line", { x1: 262, y1: 352, x2: 262, y2: 352, stroke: SKY, "stroke-width": 3, "stroke-dasharray": "2 14", "stroke-linecap": "round" }, svg);
  const ring = el("g", { opacity: 0 }, svg);
  el("circle", { cx: 520, cy: 470, r: 28, fill: "rgba(6,22,44,0.8)", stroke: SKY, "stroke-width": 3 }, ring);
  const q = el("text", { x: 520, y: 482, "text-anchor": "middle", fill: "#ffffff", "font-size": 34, "font-weight": 700, "font-family": "Manrope, sans-serif" }, ring);
  q.textContent = "?";

  const SIGHT_FROM = [262, 352];
  const SIGHT_TO = [500, 458];
  return {
    svg,
    parts: { board, sliceL, right: [rA, rB], halves: [halfA, halfB], jar, phone, hands, sight, ring },
    /** p in [0, 1]: how far the line of sight has travelled. */
    setSight(p) {
      sight.setAttribute("x2", String(SIGHT_FROM[0] + (SIGHT_TO[0] - SIGHT_FROM[0]) * p));
      sight.setAttribute("y2", String(SIGHT_FROM[1] + (SIGHT_TO[1] - SIGHT_FROM[1]) * p));
    },
    /** p in [0, 1]: the right slice splits along its diagonal and the halves drift apart. */
    setSplit(p) {
      halfA.setAttribute("transform", `translate(${-16 * p} ${10 * p}) rotate(${-4 * p} 560 580)`);
      halfB.setAttribute("transform", `translate(${18 * p} ${14 * p}) rotate(${5 * p} 650 580)`);
    },
    setEdge(opacity) {
      for (const r of [rA, rB]) r.edge.setAttribute("opacity", String(opacity));
    },
    /** Final, fully drawn state (used by the deck). */
    setStatic() {
      this.setSight(1);
      ring.setAttribute("opacity", "1");
      this.setEdge(0.85);
      this.setSplit(0);
    },
  };
}
