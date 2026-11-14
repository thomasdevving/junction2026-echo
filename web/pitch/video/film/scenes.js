// Echo film scenes, final pass. Each scene builds its DOM once and exposes render(lt): a pure function of local time,
// so playing, scrubbing backwards and jumping anywhere all give the same frame. Scenes may expose off() for cleanup
// (the footage scene pauses its videos there). Inactive scenes are display:none (main.js), so no child can leak.
import { clamp, lerp, lin, seg, win, setStyle, buildHeadline, riseWords } from "../../shared/film-kit.js";
import { createMark } from "../../shared/echo-mark.js";
import { ASSET, photo, put, createPlate, createGlassesRig, LENS_C } from "../../shared/photo.js";
import { FOOTAGE } from "./config.js";
import { sceneFootage as sceneReel } from "./footage.js"; // the real-footage scene (the chef's recording)

// ---------- helpers ----------
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
function box(parent, cls, x, y, w, ht, html = "") {
  const e = h(`<div class="abs ${cls}">${html}</div>`);
  Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px` });
  if (ht) e.style.height = `${ht}px`;
  parent.append(e);
  return e;
}
const show = (el, p, dy = 22) => setStyle(el, { opacity: String(p), transform: `translateY(${(1 - p) * dy}px)` });
const fade = (el, o) => (el.style.opacity = String(clamp(o)));
const inset = (t, r, b, l, rad) => `inset(${t}px ${r}px ${b}px ${l}px round ${rad}px)`;
// camera / large spatial moves: symmetric ease-in-out; UI responses keep the brand ease (seg) for a quick settle
const io = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const sio = (t, a, b) => io(lin(t, a, b));
const outCubic = (p) => 1 - (1 - p) ** 3;
function headline(parent, x, y, w, lines, size) {
  const e = box(parent, "kt", x, y, w);
  const hd = h(`<h1 class="headline" style="font-size:${size}px"></h1>`);
  e.append(hd);
  return { el: e, words: buildHeadline(hd, lines) };
}
function swap(el, key, html) { if (el.dataset.k !== key) { el.innerHTML = html; el.dataset.k = key; } }
/** A plate inside a box of `w` px (height w*0.64), the plate scaled to fit. */
function plateBox(parent, cls, x, y, w, state) {
  const b = box(parent, `platebox ${cls}`, x, y, w, w * 0.64);
  const p = createPlate();
  p.el.style.transform = `scale(${w / 1000})`;
  b.append(p.el);
  p.set(state);
  return { b, p };
}
function coverImg(parent, a) {
  const img = photo(parent, a, "cover");
  return img;
}

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  q: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1c.6 5.8 5.2 10.4 11 11-5.8.6-10.4 5.2-11 11-.6-5.8-5.2-10.4-11-11C6.8 11.4 11.4 6.8 12 1z"/></svg>',
  glasses: '<svg viewBox="0 0 64 32" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><path d="M3 6h58M5 6c0 12 2 19 12 19s12-6 12-14M59 6c0 12-2 19-12 19S35 19 35 11M29 10c1-2 5-2 6 0"/></svg>',
  phone: '<svg viewBox="0 0 24 40" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="2" width="20" height="36" rx="4"/><path d="M9 6h6"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor"/></svg>',
};
const hud = (icon, title, line = "") => `<div class="mlens"><div class="mlens-t"><span class="mi">${ICON[icon]}</span><b>${title}</b></div>${line ? `<div class="mlens-l">${line}</div>` : ""}</div>`;
const IMG_C = { x: 887, y: 443 }; // centre of the glasses image

// =====================================================================================
// 1 · OPEN (0–11 s): hinge macro → the glasses on a stage, a small cue inside the lens → a push through that lens →
//     your view: a recipe video that can't see your board → Echo's cue in the lens → into the first footage slot.
// =====================================================================================
function sceneOpen(root) {
  const el = h('<section class="scene s-open"></section>');
  root.append(el);
  const stage = coverImg(el, ASSET.stage);
  // the view through the lens: screen-space, clipped by the rig's lens aperture until the rim has left the frame
  const through = box(el, "through", 0, 0, 1920, 1080);
  const pov = plateBox(through, "pov-plate", 0, -74, 1920, { fill: 0 });
  box(through, "pov-vig", 0, 0, 1920, 1080);
  const rig = createGlassesRig(el);
  rig.cue.innerHTML = `<div class="lens-cue" style="left:372px;top:420px">${hud("list", "Step 4 · Add fillings", "Edge to edge")}</div>`;
  const cue = rig.cue.querySelector(".lens-cue");
  const hinge = coverImg(el, ASSET.hinge);
  const hingeGlint = box(el, "glint-band", 0, -100, 520, 1280);
  const t0 = headline(el, 120, 850, 1100, [[{ t: "Your hands are" }, { t: "full.", accent: true }]], 92);

  // inside your view
  const ui = box(el, "", 0, 0, 1920, 1080);
  const shade = box(ui, "pov-shade", 0, 0, 1920, 1080);
  const phone = box(ui, "phone-prop", 130, 250, 360, 0);
  const phImg = photo(phone, ASSET.phone);
  put(phImg, ASSET.phone, 180, 370, 300, 0);
  const screen = box(phone, "phone-screen-in", 46, 108, 268, 528, `<div class="ps-plate"></div><div class="ps-step"></div><div class="ps-bar"><i></i></div><div class="ps-chip">▶ Recipe video</div>`);
  const mini = createPlate();
  mini.el.style.transform = `rotate(90deg) translate(0, -268px) scale(${528 / 1000})`;
  mini.el.style.transformOrigin = "0 0";
  screen.querySelector(".ps-plate").append(mini.el);
  mini.set({ fill: 1 });
  const step = screen.querySelector(".ps-step"), bar = screen.querySelector(".ps-bar i");
  const t1 = headline(ui, 120, 790, 1300, [[{ t: "The video can't see" }], [{ t: "your board.", accent: true }]], 100);
  const hudCue = box(ui, "hud", 1360, 110, 440, 0, hud("warn", "Filling piled up", "Spread it to the edges"));
  const lock = box(ui, "lock-inline", 120, 800, 1100, 0, `<div class="li-row"><span class="li-mark"></span><span class="echo-word">echo</span></div><p class="li-tag">The chef's view, in your lens.</p>`);
  const mark = createMark({ stroke: 3.8 });
  lock.querySelector(".li-mark").append(mark.svg);
  const word = lock.querySelector(".echo-word"), tag = lock.querySelector(".li-tag");
  const chip = box(el, "chip-tag", 1540, 40, 320, 0, "Concept visualization");

  function render(t) {
    // A → B · one continuous pull-back from the hinge to the whole frame. The macro and the full shot move with the
    // same camera: the full shot starts zoomed in on the same corner (end piece + camera, viewer-left) and the macro
    // hands over to it while both are moving, then the frame settles on the stage.
    const pull = sio(t, 1.4, 3.3);
    const CORNER = { x: 176, y: 328 }; // the camera lens in glasses-front-cutout.png
    const m = Math.exp(lerp(0, Math.log(0.42), pull)); // the macro's shrink as the camera pulls back
    // where the macro's camera lens is on screen (macro origin 36% 52% = 691,562; lens ~ +779,-112 from it)
    const macroCam = { x: 691 + 779 * m, y: 562 - 112 * m };
    const h = sio(t, 2.1, 3.4); // after the handover, drift from the lens to the frame's centre
    setStyle(hinge, { opacity: String(seg(t, 0, 0.5) * (1 - seg(t, 1.65, 2.35))),
      transform: `scale(${lerp(1.03, 1.08, sio(t, 0, 1.4)) * m})` });
    setStyle(hingeGlint, { opacity: String(win(t, 0.35, 0.6, 1.2, 1.5) * 0.7), transform: `translateX(${lerp(-500, 1900, sio(t, 0.35, 1.5))}px) skewX(-18deg)` });

    // C · the push through the viewer-left (display) lens
    const push = sio(t, 4.4, 6.4);
    const aim = sio(t, 4.4, 5.6);
    // the full shot's lens sits exactly on the macro's lens at the macro's magnification (~2.2x) during the handover
    const base = Math.exp(lerp(Math.log(2.2 * m), Math.log(0.8), h)) * lerp(1, 0.86 / 0.8, sio(t, 3.4, 4.4));
    const s = Math.exp(lerp(Math.log(base), Math.log(11), push));
    const anchor = { x: lerp(lerp(CORNER.x, IMG_C.x, h), LENS_C.x, aim), y: lerp(lerp(CORNER.y, IMG_C.y, h), LENS_C.y, aim) };
    const target = { x: lerp(lerp(macroCam.x, 960, h), 960, aim), y: lerp(lerp(macroCam.y, 500, h), 540, aim) };
    rig.set({ x: target.x - anchor.x * s, y: target.y - anchor.y * s, s });
    fade(rig.rig, seg(t, 1.5, 2.1) * (1 - seg(t, 6.2, 6.4)));
    fade(stage, seg(t, 1.8, 2.8) * (1 - push));
    stage.style.transform = `scale(${lerp(1.3, 1.04, pull) - 0.04 * sio(t, 3.3, 4.4) + 0.25 * push})`;
    rig.edge.style.transform = `translateX(${lerp(-400, 1900, sio(t, 2.3, 3.6))}px) skewX(-20deg)`;
    rig.edge.style.opacity = String(win(t, 2.3, 2.6, 3.3, 3.6));
    rig.glint.style.transform = `translateX(${lerp(150, 900, sio(t, 4.5, 5.4))}px) skewX(-20deg)`;
    rig.glint.style.opacity = String(win(t, 4.5, 4.7, 5.1, 5.4));
    show(cue, seg(t, 3.0, 3.5) * (1 - seg(t, 4.3, 4.7)), 8);
    // the view behind the lens fades up before the push, then fills the screen
    fade(through, seg(t, 3.5, 4.4));
    through.style.clipPath = s < 10 ? rig.clip : "none";
    pov.b.style.transform = `scale(${lerp(1.06, 1, sio(t, 5.6, 7.6))})`;
    riseWords(t0.words, t, 2.4);
    setStyle(t0.el, { opacity: String(1 - seg(t, 4.0, 4.4)) });
    fade(chip, seg(t, 2.2, 2.7) * (1 - seg(t, 12.2, 12.6)));

    // D · your view: the recipe video moves on, the pile stays
    const keep = 1 - seg(t, 12.2, 12.6); // the Echo statement holds ~3 s before the hand-off
    fade(ui, seg(t, 6.2, 6.5));
    fade(shade, seg(t, 6.4, 7.0) * keep);
    setStyle(phone, { opacity: String(seg(t, 6.6, 7.1) * (1 - seg(t, 8.6, 9.0))), transform: `translateX(${(1 - sio(t, 6.5, 7.3)) * -140}px) rotate(-6deg)` });
    bar.style.width = `${lerp(48, 82, lin(t, 6.6, 10.4))}%`;
    step.textContent = t < 8.2 ? "Step 4 · Add fillings" : "Step 5 · Close it";
    riseWords(t1.words, t, 6.9);
    setStyle(t1.el, { opacity: String(1 - seg(t, 8.5, 8.9)) });

    // E · Echo: one amber cue on your bread, the instruction in the lens, the name
    pov.p.set({ fill: 0, cue: win(t, 8.7, 9.1, 9.8, 10.4) });
    show(hudCue, seg(t, 8.9, 9.3) * keep, 12);
    mark.set({ draw: seg(t, 9.0, 9.9) });
    fade(lock, keep); // the whole lockup (mark included) leaves together
    show(word, seg(t, 9.2, 9.8) * keep, 20);
    show(tag, seg(t, 9.5, 10.0) * keep, 12);

    // F · hand-off: the view narrows into exactly the first footage frame's rectangle; the footage scene then fades
    // in only its content there (both scenes share the same background)
    const out = sio(t, 12.6, 13.6);
    // = the footage scene's frame: x 250, y 90, 506 x 900, radius 36
    if (t >= 6.4) through.style.clipPath = out > 0 ? inset(lerp(0, 90, out), lerp(0, 1164, out), lerp(0, 90, out), lerp(0, 250, out), lerp(0, 36, out)) : "none";
  }
  return { el, render };
}

// =====================================================================================
// 2 · FOOTAGE SLOTS (11–41 s): five clean 9:16 frames. Real clips when set in config.js; until then a plain card that
//     says what to record. Chapter text sits beside the frame; the frame tracks side to side between slots.
// =====================================================================================
function sceneFootage(root) {
  const el = h('<section class="scene s-footage"></section>');
  root.append(el);
  const slots = FOOTAGE.slots;
  const SIDE = ["L", "R", "L", "R", "L"];
  const FX = { L: 230, R: 1195 }, TX = { L: 860, R: 140 };
  const head = box(el, "f-head", 96, 46, 900, 0, `<span class="mini-mark"></span><span class="eyebrow">On the glasses</span>`);
  const mm = createMark({ stroke: 5 });
  head.querySelector(".mini-mark").append(mm.svg);
  mm.set({ draw: 1 });
  const label = box(el, "f-label", 820, 40, 1004, 0, "");
  const frame = box(el, "fframe", FX.L, 100, 495, 880, `<div class="f-fallback"></div><div class="f-vid"></div><div class="f-badge"></div>`);
  const fallback = frame.querySelector(".f-fallback"), badge = frame.querySelector(".f-badge");
  const vids = {};
  for (const s of slots) {
    if (!s.src) continue;
    const v = h(`<video muted playsinline preload="auto"></video>`);
    v.src = s.src;
    frame.querySelector(".f-vid").append(v);
    vids[s.id] = v;
  }
  const texts = slots.map((s, i) => {
    const t = box(el, "f-text", 0, 300, 940, 0, `<div class="f-num">0${i + 1} <i>/ 05</i></div>`);
    const hd = h(`<h1 class="headline" style="font-size:86px;white-space:nowrap"></h1>`);
    t.append(hd);
    const sub = h(`<p class="f-sub">${s.sub}</p>`);
    t.append(sub);
    return { t, words: buildHeadline(hd, [[{ t: s.title }]]), sub };
  });
  const slotAt = (lt) => { const i = slots.findIndex((s) => lt >= s.start && lt < s.end); return i < 0 ? (lt < 0 ? 0 : slots.length - 1) : i; };
  function syncVideo(s, lt, active) {
    const v = vids[s.id];
    if (!v) return;
    if (!active) { if (!v.paused) v.pause(); v.style.display = "none"; return; }
    v.style.display = "block";
    const want = s.in + (lt - s.start);
    if (!v.seekable.length) { if (window.__filmPlaying) { if (v.paused) v.play().catch(() => {}); } else if (!v.paused) v.pause(); return; }
    if (window.__filmPlaying) {
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - want) > 0.3) v.currentTime = want;
    } else {
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - want) > 0.04) v.currentTime = want;
    }
  }
  function render(lt) {
    const i = slotAt(lt), s = slots[i], ls = lt - s.start;
    const side = SIDE[i], prev = SIDE[Math.max(0, i - 1)];
    frame.style.left = `${lerp(FX[prev], FX[side], i > 0 ? sio(ls, 0, 0.9) : 1)}px`;
    const real = Boolean(s.src);
    fallback.style.display = real ? "none" : "flex";
    swap(fallback, `fb${i}`, `<div class="fb-num">Slot ${i + 1} / 5 · ${s.target}</div><span class="fb-icon">${ICON.film}</span>
      <b>${s.file}</b><p>${s.record}</p><p class="fb-meta">${s.framing}</p>`);
    slots.forEach((sl, k) => syncVideo(sl, lt, k === i));
    badge.textContent = real ? `Real footage · ${s.title}` : `Footage slot ${i + 1} · awaiting recording`;
    swap(label, real ? "real" : "prev", real
      ? `<span class="lab real">Real footage · ${FOOTAGE.device} · recorded ${FOOTAGE.recorded ?? "⟨date⟩"}</span>`
      : `<span class="lab prev">Footage slots · real glasses recordings go here</span>`);
    texts.forEach(({ t, words, sub }, k) => {
      const sk = slots[k];
      t.style.left = `${TX[SIDE[k]]}px`;
      const last = k === slots.length - 1;
      fade(t, k === i ? (last ? seg(lt, sk.start + 0.25, sk.start + 0.8) : win(lt, sk.start + 0.25, sk.start + 0.8, sk.end - 0.45, sk.end - 0.05)) : 0);
      if (k === i) { riseWords(words, lt, sk.start + 0.3); show(sub, seg(lt, sk.start + 0.7, sk.start + 1.2), 12); }
    });
  }
  function off() { for (const v of Object.values(vids)) { if (!v.paused) v.pause(); v.style.display = "none"; } }
  return { el, render, off };
}

// =====================================================================================
// 3 · HOW (41–68 s): the chef's recording as source frames → slows on step 4 → that frame becomes the instruction
//     card → the same frame becomes the chef's reference beside your view → ghost above your view → one cue →
//     the same four pieces move into place → "Looks right" → a short under-the-hood.
// =====================================================================================
const FW = 400, FH = 256, PITCH = 450; // source frame size and spacing
function sceneHow(root) {
  const el = h('<section class="scene s-how"></section>');
  root.append(el);

  // A · source frames
  const A = box(el, "", 0, 0, 1920, 1080);
  const ta = box(A, "eyebrow-abs", 122, 96, 1200, 0, `<p class="eyebrow"><span class="eyebrow-orbit"></span>From the chef's recording</p>`);
  const tah = headline(A, 120, 140, 1600, [[{ t: "One recording." }, { t: "Six steps.", accent: true }]], 80);
  const reel = box(A, "reel2", 0, 430, 1920, FH + 60);
  const NAMES = ["Lay out", "Spread", "Lettuce", "Add fillings", "Close", "Cut"];
  const STATES = [{ spread: 0, lettuce: 0, placed: 0 }, { lettuce: 0, placed: 0 }, { placed: 0 }, { fill: 1 }, { fill: 1 }, { fill: 1 }];
  const frames = NAMES.map((n, i) => {
    const f = box(reel, "src-frame", 0, 0, FW, FH);
    const p = createPlate();
    p.el.style.transform = `scale(${FW / 1000})`;
    f.append(p.el);
    p.set(STATES[i]);
    if (i >= 4) { // closed (and cut): a top slice over the filling
      const top = photo(p.el, ASSET.bread, "piece");
      put(top, ASSET.bread, 702, 318, 292, 3);
      if (i === 5) f.insertAdjacentHTML("beforeend", `<svg class="cutline" viewBox="0 0 1000 640" style="width:${FW}px;height:${FH}px"><path d="M570 175 L835 470" stroke="#2a1a0e" stroke-width="5" opacity=".7"/></svg>`);
    }
    const cap = h(`<div class="src-cap"><i>0${i + 1}</i> ${n}</div>`);
    f.append(cap);
    return { f, cap };
  });
  const brackets = box(A, "brackets", 0, 0, FW + 28, FH + 28, `<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i>`);
  const geminiTag = box(A, "beam-chip", 860, 360, 200, 0, `<span class="mi">${ICON.spark}</span>Gemini`);
  const card = box(A, "inst-card", 0, 0, 720, 640);
  const cardText = box(A, "inst-text", 0, 0, 560, 0, `<p class="eyebrow">Step 4 of 6</p><h2>Add fillings</h2><p>One even layer, edge to edge.</p>`);
  const sel = frames[3].f; // the selected source frame: one element, all the way to the comparison
  el.append(sel); // it travels in stage coordinates, above the reel
  // the reel is already moving while the scene pans in (lt < 0), then slows to a stop on step 4
  const reelX = (t) => 960 - FW / 2 - 3 * PITCH + 2300 * (1 - outCubic(lin(t, -0.8, 4.2)));

  // B · comparison: the selected frame becomes the chef's reference; your view beside it
  const B = box(el, "", 0, 0, 1920, 1080);
  const youBox = box(B, "cmp-frame", 0, 0, 760, 486);
  const you = createPlate();
  youBox.append(you.el);
  const tagRef = box(el, "cmp-tag", 140, 250, 760, 0, `<b>Chef's reference</b><i>step 4 · from the recording</i>`);
  const tagYou = box(B, "cmp-tag right", 1020, 250, 760, 0, `<b>Your view</b><i>from the glasses</i>`);
  const v1 = headline(B, 110, 330, 620, [[{ t: "Bare bread" }], [{ t: "at the edges.", accent: true }]], 84);
  const v1s = box(B, "v-sub", 114, 560, 560, 0, `<span class="mi">${ICON.warn}</span>Spread it to the edges`);
  const v2 = box(B, "v-pass", 110, 360, 620, 0, `<svg class="okcheck" viewBox="0 0 320 320"><circle cx="160" cy="160" r="93" stroke="#A7D8BE" stroke-width="5" fill="none" opacity=".55"/><path pathLength="1" d="M113 162L145 194L210 126" stroke="#C4E9DF" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><b>Looks right.</b>`);
  const okPath = v2.querySelector("path");
  const v2s = box(B, "v-sub ok", 114, 600, 560, 0, "Same four pieces. Moved, not enlarged.");
  const note = box(B, "f-small", 114, 990, 1200, 0, "Illustrated example · checked against the chef's criteria for step 4");

  // C · under the hood
  const E = box(el, "", 0, 0, 1920, 1080);
  const eb = box(E, "eyebrow-abs center", 0, 230, 1920, 0, `<p class="eyebrow"><span class="eyebrow-orbit"></span>Under the hood</p>`);
  const nodes = [["glasses", "Glasses", "camera + lens"], ["phone", "Echo on iPhone", "runs the cook-along"], ["spark", "Gemini", "compares with the chef"]]
    .map(([ic, t, s], i) => box(E, "node", 110 + i * 610, 360, 480, 300, `<span class="ni">${ICON[ic]}</span><b>${t}</b><i>${s}</i>`));
  const arrows = [0, 1].map((i) => box(E, "arrow", 600 + i * 610, 507, 110, 6));

  function frameRect(f, cx, cy, scale) { setStyle(f, { left: `${cx - FW / 2}px`, top: `${cy - FH / 2}px`, transform: `scale(${scale})` }); }

  function render(lt) {
    // ----- A · 0–8.4 -----
    const aOut = seg(lt, 8.2, 8.8);
    show(ta, seg(lt, -0.7, -0.2) * (1 - seg(lt, 7.9, 8.4)), 10);
    riseWords(tah.words, lt, -0.6);
    fade(tah.el, 1 - seg(lt, 7.9, 8.4));
    const x0 = reelX(lt), lift = sio(lt, 5.2, 6.4);
    frames.forEach(({ f, cap }, i) => {
      if (i === 3) return;
      const away = sio(lt, 5.0, 6.2) * (i < 3 ? -1 : 1) * 380;
      setStyle(f, { left: `${x0 + i * PITCH + away}px`, top: "30px", transform: "none",
        opacity: String(seg(lt, -0.9, -0.5) * (1 - 0.65 * seg(lt, 4.5, 5.1)) * (1 - seg(lt, 5.2, 6.0))) });
      fade(cap, 1);
    });
    // the selected frame: stops at the centre, is marked, lifts into the card, then becomes the chef's reference
    const toRef = sio(lt, 8.4, 9.8);
    const restX = x0 + 3 * PITCH + FW / 2, restY = 430 + 30 + FH / 2; // its place in the reel (stage coordinates)
    const cx = lift > 0 ? lerp(960, 520, toRef) : restX;
    const cy = lerp(restY, 470, lift) + (560 - 470) * toRef;
    const scale = lerp(lerp(1, 1.5, lift), 760 / FW, toRef);
    frameRect(sel, cx, cy, scale);
    setStyle(sel, { opacity: String(seg(lt, -0.9, -0.5) * (1 - seg(lt, 11.2, 12.4))) });
    fade(frames[3].cap, 1 - seg(lt, 5.4, 5.9));
    sel.classList.toggle("lifted", lift > 0.02);
    setStyle(brackets, { left: `${960 - FW / 2 - 14}px`, top: `${430 + 30 - 14}px`, opacity: String(win(lt, 4.5, 4.9, 5.4, 5.9)), transform: `scale(${lerp(1.08, 1, seg(lt, 4.5, 5.0))})` });
    show(geminiTag, win(lt, 4.6, 5.0, 5.6, 6.0), 8);
    // the card forms around the lifted frame
    setStyle(card, { left: `${960 - 360}px`, top: `${470 - FH * 0.75 - 40}px`, opacity: String(seg(lt, 5.7, 6.3) * (1 - seg(lt, 8.3, 8.8))), transform: `scale(${lerp(0.96, 1, seg(lt, 5.7, 6.3))})` });
    setStyle(cardText, { left: `${960 - 280}px`, top: `${470 + FH * 0.75 + 20}px` });
    show(cardText, seg(lt, 6.0, 6.6) * (1 - seg(lt, 8.3, 8.7)), 12);
    fade(A, 1 - aOut * 0);
    fade(reel, 1 - seg(lt, 8.2, 8.8));

    // ----- B · 8.4–21.8 -----
    const bOut = seg(lt, 21.4, 21.9);
    fade(B, seg(lt, 8.6, 9.0) * (1 - bOut));
    // your view slides in beside the reference, then moves centre-right and pushes in on your slice
    const inY = sio(lt, 9.0, 10.0), toC = sio(lt, 11.2, 12.8);
    const yw = lerp(760, 1100, toC);
    setStyle(youBox, { left: `${lerp(lerp(2300, 1020, inY), 1180 - yw / 2, toC)}px`, top: `${lerp(560, 540, toC) - (yw * 0.64) / 2}px`, width: `${yw}px`, height: `${yw * 0.64}px` });
    // the camera pushes in on your slice: the plate point in focus moves from the board's centre to the slice
    const zoom = lerp(1, 2.05, toC), k = (yw / 1000) * zoom, fx = lerp(500, 700, toC);
    you.el.style.transform = `translate(${yw / 2 - fx * k}px, ${(yw * 0.64) / 2 - 320 * k}px) scale(${k})`;
    show(tagRef, win(lt, 9.6, 10.1, 10.9, 11.3), 10);
    show(tagYou, win(lt, 9.8, 10.3, 10.9, 11.3), 10);
    const fix = sio(lt, 15.4, 18.0);
    you.set({ fill: fix, board: lerp(1, 0.55, toC), left: 1 - toC, ghost: seg(lt, 12.6, 13.3) * (1 - seg(lt, 17.6, 18.4)), cue: win(lt, 13.4, 13.9, 15.4, 16.2) });
    riseWords(v1.words, lt, 13.5);
    fade(v1.el, 1 - seg(lt, 17.0, 17.5));
    show(v1s, win(lt, 14.1, 14.6, 17.0, 17.5), 12);
    show(v2, seg(lt, 18.4, 19.0) * (1 - bOut), 20);
    okPath.style.strokeDasharray = "1";
    okPath.style.strokeDashoffset = String(1 - seg(lt, 18.6, 19.4));
    show(v2s, seg(lt, 19.2, 19.8) * (1 - bOut), 10);
    fade(note, seg(lt, 12.8, 13.4) * (1 - bOut));
    youBox.style.transform = `scale(${1 + 0.02 * lin(lt, 18.4, 21.8)})`;

    // ----- C · 21.8–27 -----
    const eIn = seg(lt, 21.7, 22.2), eOut = 0; // the tilt down to the next scene carries the exit
    fade(E, eIn * (1 - eOut));
    show(eb, seg(lt, 21.8, 22.3), 12);
    nodes.forEach((n, i) => show(n, seg(lt, 21.9 + i * 0.3, 22.5 + i * 0.3), 24));
    arrows.forEach((a, i) => setStyle(a, { transform: `scaleX(${sio(lt, 22.2 + i * 0.3, 22.7 + i * 0.3)})` }));
  }
  return { el, render };
}

// =====================================================================================
// 4 · TRUST (68–77 s): your view, full-screen; something comes close to the lens; "Can't tell"; it clears.
// =====================================================================================
function sceneTrust(root) {
  const el = h('<section class="scene s-trust"></section>');
  root.append(el);
  const view = box(el, "", 0, 0, 1920, 1080);
  const pov = plateBox(view, "", 0, -74, 1920, { fill: 1 });
  box(view, "pov-vig", 0, 0, 1920, 1080);
  const dark = box(el, "pov-shade", 0, 0, 1920, 1080);
  const away = box(el, "away-tag", 760, 470, 400, 0, "Board out of view");
  const hd = headline(el, 120, 790, 1300, [[{ t: "It tells you when" }], [{ t: "it can't tell.", accent: true }]], 100);
  const hudEl = box(el, "hud", 1360, 110, 440, 0, "");
  const hudL = box(el, "f-small pillnote", 1360, 290, 0, 0, "Concept visualization");
  const watching = box(el, "watching", 1360, 350, 300, 0, `<span class="wdot"></span>watching`);
  const foot = box(el, "f-small pillnote", 1360, 420, 0, 0, "Shown whenever frames are being sent.");
  function render(lt) {
    // the wearer looks up: the board slides out of the bottom of the view, softens and darkens, then comes back
    const inO = sio(lt, 1.0, 2.2), outO = sio(lt, 5.4, 6.7), o = inO * (1 - outO);
    pov.b.style.transform = `translateY(${760 * o}px) rotate(${-3 * o}deg) scale(${1 + 0.03 * sio(lt, 0, 9)})`;
    view.style.filter = o > 0.01 ? `blur(${7 * o}px) brightness(${1 - 0.4 * o})` : "none";
    show(away, win(lt, 2.0, 2.4, 5.2, 5.6), 8);
    fade(dark, 0.55 + 0.2 * o);
    riseWords(hd.words, lt, 0.3);
    const cant = lt >= 2.0 && lt < 6.4;
    swap(hudEl, cant ? "c" : "s", cant ? hud("q", "Can't tell", "Look at the board") : hud("list", "Step 4 · Add fillings", "One even layer, edge to edge"));
    show(hudEl, seg(lt, 0.2, 0.7), 10);
    fade(hudL, seg(lt, 0.4, 1.0));
    show(watching, seg(lt, 6.8, 7.2), 8);
    watching.querySelector(".wdot").style.opacity = String(0.55 + 0.45 * Math.abs(Math.sin(lt * 2.4)));
    show(foot, seg(lt, 7.0, 7.5), 6);
  }
  return { el, render };
}

// =====================================================================================
// 5 · END (77–88 s): the result → the glasses on the stage, a small pass cue in the lens → Echo.
// =====================================================================================
function sceneEnd(root) {
  const el = h('<section class="scene s-end"></section>');
  root.append(el);
  const stage = coverImg(el, ASSET.stage);
  // the result: full-screen first; during the pull-back it is seen through the lens. The outer layer carries the
  // lens clip (screen space, never transformed); the inner layer moves and shrinks the sandwich with the lens.
  // food: [dark backing, fades so the stage shows through the glass] < [the sandwich] < [scanlines as the display locks on]
  const food = box(el, "end-food", 0, 0, 1920, 1080);
  const foodBg = box(food, "end-food-bg", 0, 0, 1920, 1080);
  const foodIn = box(food, "", 0, 0, 1920, 1080);
  const sw = photo(foodIn, ASSET.sandwich, "hero-food");
  put(sw, ASSET.sandwich, 1290, 560, 1080, 0);
  const scan = box(food, "lens-scan", 0, 0, 1920, 1080);
  const hd = headline(el, 120, 400, 760, [[{ t: "Made the" }], [{ t: "chef's way.", accent: true }]], 118);
  const rig = createGlassesRig(el);
  // the rim passing the camera: a warm bloom and an anamorphic streak (screen-blended, above the glasses)
  const flare = box(el, "end-flare", 0, 0, 1000, 1000);
  const streak = box(el, "end-streak", 0, 0, 2600, 10);
  const stageL = el;
  const lock = box(stageL, "lock-side", 1160, 0, 700, 1080, `
    <div class="lock-row"><div class="lock-mark"></div><div class="echo-word">echo</div></div>
    <p class="lock-tag"></p>
    <p class="lock-pilot"><b>Proposed pilot</b> one cooking class<br><b>Next</b> other hands-on skills</p>
    <p class="lock-credit">Junction 2026 · Meta <i>×</i> Google DeepMind challenge</p>`);
  const mark = createMark({ stroke: 3.6 });
  lock.querySelector(".lock-mark").append(mark.svg);
  const tag = buildHeadline(lock.querySelector(".lock-tag"), [[{ t: "Cook from the chef's" }], [{ t: "point of view.", accent: true }]]);
  const word = lock.querySelector(".echo-word"), pilot = lock.querySelector(".lock-pilot"), credit = lock.querySelector(".lock-credit");
  function render(lt) {
    // hero, then a breath in (the camera leans toward the sandwich) just before it pulls away
    sw.style.transform = `scale(${lerp(1.0, 1.04, sio(lt, -0.9, 3.6)) * lerp(1, 1.07, sio(lt, 3.5, 4.35))})`;
    riseWords(hd.words, lt, 0.5);
    const hOut = sio(lt, 3.6, 4.3);
    setStyle(hd.el, { opacity: String(1 - hOut), transform: `translateY(${-46 * hOut}px)`, filter: hOut > 0.01 ? `blur(${(10 * hOut).toFixed(2)}px)` : "none" });

    // the pull back out through the lens (the opening push, reversed): the rim rushes in from past the camera with
    // a roll that settles level, the background racks into focus, and the sandwich shrinks into the lens and
    // becomes what the display shows: smaller, see-through, the stage visible behind it
    const back = sio(lt, 4.2, 6.9), aim = sio(lt, 5.2, 6.9);
    const s = Math.exp(lerp(Math.log(11), Math.log(0.58), back));
    const roll = lerp(-16, 0, outCubic(lin(lt, 4.2, 7.2)));
    const rx = lerp(960, 560, aim) - lerp(LENS_C.x, IMG_C.x, aim) * s;
    const ry = lerp(540, 520, aim) - lerp(LENS_C.y, IMG_C.y, aim) * s;
    rig.set({ x: rx, y: ry, s, r: roll });
    fade(rig.rig, lt >= 4.2 ? 1 : 0);
    const mb = 9 * Math.sin(Math.PI * lin(lt, 4.2, 5.9)); // motion blur on the rim while it is huge and fast
    rig.rig.style.filter = mb > 0.1 ? `blur(${mb.toFixed(2)}px)` : "none";
    food.style.clipPath = lt >= 4.2 ? rig.clip : "none";
    const lx = rx + LENS_C.x * s, ly = ry + LENS_C.y * s, follow = sio(lt, 4.2, 6.2);
    foodIn.style.transformOrigin = "1290px 560px";
    foodIn.style.transform = `translate(${(lx - 1290) * follow}px, ${(ly - 560) * follow}px) scale(${lerp(1.07, 0.19, back)}) rotate(${roll * follow}deg)`;
    // the display locks on: backing clears, the image settles see-through with a brief scan flicker
    fade(foodBg, 1 - seg(lt, 5.3, 6.5));
    const lockOn = seg(lt, 5.9, 6.7);
    const flick = win(lt, 6.0, 6.15, 6.25, 6.45) * 0.35;
    sw.style.opacity = String(lerp(1, 0.7, lockOn) - flick);
    sw.style.filter = lockOn > 0.01 ? `drop-shadow(0 0 ${(14 * lockOn).toFixed(1)}px rgba(255, 214, 170, ${(0.35 * lockOn).toFixed(2)})) saturate(${lerp(1, 0.9, lockOn)})` : "";
    fade(scan, win(lt, 5.9, 6.1, 6.6, 7.4) * 0.8);
    scan.style.backgroundPositionY = `${(lt * 40).toFixed(1)}px`;
    // the rim crossing the camera: bloom + streak at the lens centre
    const fl = win(lt, 4.45, 4.85, 5.1, 5.9);
    setStyle(flare, { left: `${lx - 500}px`, top: `${ly - 500}px`, opacity: String(fl * 0.9), transform: `scale(${lerp(1.6, 0.7, seg(lt, 4.45, 5.9))})` });
    setStyle(streak, { left: `${lx - 1300}px`, top: `${ly - 5}px`, opacity: String(fl), transform: `rotate(${roll}deg) scaleX(${lerp(0.4, 1.2, seg(lt, 4.45, 5.6))})` });
    // the stage racks from soft to sharp as the glasses arrive
    fade(stage, seg(lt, 4.4, 5.4));
    const focus = 18 * (1 - sio(lt, 4.6, 6.8));
    stage.style.filter = focus > 0.1 ? `blur(${focus.toFixed(2)}px)` : "none";
    stage.style.transform = `scale(${lerp(1.08, 1, sio(lt, 4.4, 10))})`;
    rig.edge.style.transform = `translateX(${lerp(-400, 1900, sio(lt, 6.9, 8.1))}px) skewX(-20deg)`;
    rig.edge.style.opacity = String(win(lt, 6.9, 7.2, 7.8, 8.1));
    // Echo, beside the glasses
    fade(lock, seg(lt, 6.3, 6.6));
    mark.set({ draw: seg(lt, 6.4, 7.4), glow: win(lt, 7.0, 7.6, 8.8, 10) * 0.6 });
    show(word, seg(lt, 6.7, 7.4), 20);
    riseWords(tag, lt, 7.3, { stagger: 0.07 });
    show(pilot, seg(lt, 8.4, 9.0), 10);
    show(credit, seg(lt, 8.9, 9.5), 8);
  }
  return { el, render };
}

export function buildScenes(stage) {
  return {
    open: sceneOpen(stage),
    footage: sceneReel(stage),
    how: sceneHow(stage),
    trust: sceneTrust(stage),
    end: sceneEnd(stage),
  };
}
