// The footage scene, cut from the chef's real recording (config.js FOOTAGE / LESSON):
//   1 the chef records once (montage)  2 processing  3 the generated lesson  4 following it, with the lens view.
// Two <video> elements alternate cuts (the next cut is pre-seeked while the current one plays), and when paused the
// render waits for the exact frame, so scrubbing and offline renders show the right picture. The background is the
// playing footage itself, drawn small into a canvas and blurred.
import { clamp, lerp, lin, seg, win, setStyle, buildHeadline, riseWords } from "../../shared/film-kit.js";
import { renderLens } from "../../../shared/lens.js";
import { FOOTAGE, LESSON } from "./config.js";

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
const io = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
const sio = (t, a, b) => io(lin(t, a, b));
const mix = (a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p) });
const PINCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13V5a2 2 0 0 1 4 0v6M12 11V4a2 2 0 0 1 4 0v8M16 10a2 2 0 0 1 4 0v4a8 8 0 0 1-8 8h-1a7 7 0 0 1-6-3l-2.6-4.3a1.8 1.8 0 0 1 3-2L8 15"/></svg>';
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5"/></svg>';
const TAKE_LEN = 133.7;
const STEP_AT = [21, 64, 79, 108, 116, 131.5]; // where each step's still comes from in the take

function headline(parent, x, y, w, text, size, cls = "") {
  const e = box(parent, `kt ${cls}`, x, y, w);
  const hd = h(`<h1 class="headline" style="font-size:${size}px"></h1>`);
  e.append(hd);
  return { el: e, words: buildHeadline(hd, [[{ t: text }]]) };
}

export function sceneFootage(root) {
  const el = h('<section class="scene s-reel"></section>');
  root.append(el);

  // ---------- the edit ----------
  let at = 0;
  const cuts = [];
  for (const c of FOOTAGE.chef) { cuts.push({ ...c, start: at, end: at + (c.out - c.in), part: "chef" }); at += c.out - c.in; }
  const T1 = at, T2 = T1 + FOOTAGE.process, T3 = T2 + FOOTAGE.lesson;
  at = T3;
  for (const c of FOOTAGE.follow) { cuts.push({ ...c, start: at, end: at + (c.out - c.in), part: "follow" }); at += c.out - c.in; }
  const cutAt = (lt) => cuts.findIndex((c) => lt >= c.start && lt < c.end);

  // ---------- layers ----------
  const amb = document.createElement("canvas");
  amb.width = 72; amb.height = 128; amb.className = "ambient";
  el.append(amb);
  const actx = amb.getContext("2d");
  box(el, "amb-shade", 0, 0, 1920, 1080);

  const FR = { x: 250, y: 90, w: 506, h: 900 }, SMALL = { x: 860, y: 260, w: 200, h: 356 };
  const frame = box(el, "vframe", FR.x, FR.y, FR.w, FR.h, `<video muted playsinline preload="auto"></video><video muted playsinline preload="auto"></video>
    <div class="lensbox rec"><div class="rec-row">● REC <span></span></div><div class="rec-step"></div></div>
    <div class="lensbox toast"><span class="mi">${PINCH}</span><b></b></div>
    <div class="lensbox card"><div class="lenscard"></div></div>
    <div class="sim-tag">Lens view · simulated</div>`);
  const vids = [...frame.querySelectorAll("video")];
  vids.forEach((v) => { v.src = FOOTAGE.src; });
  const rec = frame.querySelector(".rec"), recT = rec.querySelector(".rec-row span"), recStep = rec.querySelector(".rec-step");
  const toast = frame.querySelector(".toast"), toastB = toast.querySelector("b");
  const cardBox = frame.querySelector(".card"), lens = frame.querySelector(".lenscard"), simTag = frame.querySelector(".sim-tag");

  // chapter text
  const n1 = box(el, "f-num", 860, 300, 900, 0, "01 <i>/ 03</i>");
  const h1 = headline(el, 860, 350, 980, "The chef records once.", 86);
  const s1 = box(el, "f-sub", 860, 470, 860, 0, "Cooking normally, wearing the glasses. A pinch marks each new step.");
  const n2 = box(el, "f-num center", 0, 90, 1920, 0, "02 <i>/ 03</i>");
  const h2 = headline(el, 0, 132, 1920, "Echo turns it into a lesson.", 72, "center");
  const n3 = box(el, "f-num", 860, 300, 900, 0, "03 <i>/ 03</i>");
  const h3 = headline(el, 860, 350, 980, "Anyone can follow it.", 86);
  const s3 = box(el, "f-sub", 860, 470, 860, 0, "The next step and the chef's reference, right in the lens.");
  const ask = cuts.find((x) => x.ask);
  const q = box(el, "bubble q", 860, 600, 820, 0, `<span class="mi">${MIC}</span>${ask?.ask.q ?? ""}`);
  const a = box(el, "bubble a", 860, 730, 820, 0, ask?.ask.a ?? "");

  // processing: upload, then the take's timeline scanned for steps
  const upLabel = box(el, "proc-label", 560, 640, 800, 0, "");
  const upBar = box(el, "proc-bar", 660, 700, 600, 8, "<i></i>");
  const track = box(el, "proc-track", 360, 790, 1200, 56, `<div class="beam"></div>${STEP_AT.map((s, i) => `<div class="tick" style="left:${(s / TAKE_LEN) * 100}%"><b>${i + 1}</b></div>`).join("")}`);
  const beam = track.querySelector(".beam"), ticks = [...track.querySelectorAll(".tick")];

  // the generated lesson
  const lessonCard = box(el, "lesson", 210, 300, 1500, 0, `<div class="lesson-head"><b>${LESSON.title}</b><span>${LESSON.steps.length} steps · from the chef's recording</span></div>
    <div class="lesson-grid">${LESSON.steps.map((s, i) => `<div class="ls"><img src="${s.still}" alt=""><div><i>Step ${i + 1}</i><b>${s.title}</b><p>${s.key}</p></div></div>`).join("")}</div>`);
  const tiles = [...lessonCard.querySelectorAll(".ls")];

  // ---------- video ----------
  function seekTo(v, t) {
    if (Math.abs(v.currentTime - t) < 0.03 && v.readyState >= 2) return null;
    return new Promise((ok) => {
      const done = () => { v.removeEventListener("seeked", done); clearTimeout(timer); ok(); };
      const timer = setTimeout(done, 2500);
      v.addEventListener("seeked", done);
      v.currentTime = t;
    });
  }
  function drawAmbient(v) { if (v.readyState >= 2) { try { actx.drawImage(v, 0, 0, amb.width, amb.height); } catch {} } }

  function syncVideo(lt) {
    lt = Math.max(lt, 0); // during the incoming match, hold the first frame of the first cut
    const k = cutAt(lt);
    const playing = window.__filmPlaying;
    if (k < 0) { vids.forEach((v) => { if (!v.paused) v.pause(); }); return null; }
    const c = cuts[k], v = vids[k % 2], other = vids[(k + 1) % 2];
    v.style.visibility = "visible";
    other.style.visibility = "hidden";
    const want = c.in + (lt - c.start);
    // the hidden video waits, paused, on the first frame of the next cut (if there is one)
    if (!other.paused) other.pause();
    const nx = cuts[k + 1];
    if (nx && !other.seeking && Math.abs(other.currentTime - nx.in) > 0.05) other.currentTime = nx.in;
    if (playing) {
      if (v.paused) v.play().catch(() => {});
      if (Math.abs(v.currentTime - want) > 0.25) v.currentTime = want;
      drawAmbient(v);
      return null;
    }
    if (!v.paused) v.pause();
    // paused (scrubbing, offline render): aim at the middle of a 30 fps frame, never a boundary, so consecutive film
    // frames can't land on the same or a neighbouring source frame out of order
    const p = seekTo(v, (Math.floor(want * 30 + 1e-4) + 0.5) / 30); // +1e-4: 8.1 * 30 must not floor to 242
    if (!p) { drawAmbient(v); return null; }
    return p.then(() => drawAmbient(v));
  }

  let lensKey = "";
  function setLens(screen, key) { if (key !== lensKey) { renderLens(lens, screen); lensKey = key; } }
  const card = (i) => ({ idx: i, total: LESSON.steps.length, title: LESSON.steps[i - 1].title, keyLine: LESSON.steps[i - 1].key, refImageUrl: LESSON.steps[i - 1].still, watching: "active" });

  function render(lt) {
    const k = cutAt(lt), c = cuts[k];
    // frame: full-size for the montage, shrinks into the upload, hides for the lesson, returns for following it
    let r = FR, fo = 1;
    if (lt >= T1 && lt < T3) { r = mix(FR, SMALL, sio(lt, T1, T1 + 1.2)); fo = 1 - seg(lt, T2, T2 + 0.5); }
    if (lt >= T3) { r = mix(SMALL, FR, sio(lt, T3 - 0.2, T3 + 0.8)); fo = seg(lt, T3 - 0.2, T3 + 0.3); }
    setStyle(frame, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, opacity: String(fo) });
    frame.style.borderRadius = `${lerp(36, 22, (FR.w - r.w) / (FR.w - SMALL.w))}px`;

    // chef mode overlays: REC with the take's clock, and a pinch toast at each cut
    const chefOn = c && c.part === "chef";
    fade(rec, chefOn ? 1 : 0);
    if (chefOn) {
      const s = Math.floor(c.in + (lt - c.start));
      recT.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
      recStep.textContent = `Step ${c.step}`;
      toastB.textContent = `Step ${c.step} marked`;
    }
    show(toast, chefOn ? win(lt - c.start, 0.15, 0.35, 1.2, 1.45) : 0, 8);

    // the lens view while following
    const fo2 = c && c.part === "follow";
    fade(cardBox, fo2 ? seg(lt - c.start, 0, 0.3) : 0);
    fade(simTag, lt >= T3 ? seg(lt, T3 + 0.3, T3 + 0.8) : 0);
    if (fo2) {
      const lc = lt - c.start;
      const st = c.lens.filter(([t0]) => lc >= t0).at(-1);
      const [, kind, step] = st;
      if (kind === "step") setLens({ kind: "step", card: card(step) }, `s${step}`);
      if (kind === "checking") setLens({ kind: "checking", card: card(step) }, `c${step}`);
      if (kind === "pass") setLens({ kind: "pass", headline: "Looks right" }, "pass");
      if (kind === "done") setLens({ kind: "done", summary: "All 6 steps" }, "done");
    }

    // text
    const c1 = win(lt, 0.2, 0.7, T1 - 0.4, T1);
    fade(n1, c1); riseWords(h1.words, lt, 0.3); fade(h1.el, c1); show(s1, win(lt, 0.7, 1.2, T1 - 0.4, T1), 12);
    const c2 = win(lt, T1 + 0.9, T1 + 1.4, T3 - 0.5, T3 - 0.1); // after the frame has shrunk below it
    fade(n2, c2); riseWords(h2.words, lt, T1 + 1.0); fade(h2.el, c2);
    const c3 = seg(lt, T3 + 0.3, T3 + 0.8);
    fade(n3, c3); riseWords(h3.words, lt, T3 + 0.4); fade(h3.el, c3); show(s3, seg(lt, T3 + 0.8, T3 + 1.3), 12);
    // the question and answer appear as they are spoken (film/sound.js q1/a1), and stay until the answer has finished
    if (ask) {
      const { qAt, aAt } = ask.ask;
      show(q, win(lt, ask.start + qAt - 0.1, ask.start + qAt + 0.3, ask.end + 0.3, ask.end + 0.7), 16);
      show(a, win(lt, ask.start + aAt - 0.1, ask.start + aAt + 0.3, ask.end + 0.3, ask.end + 0.7), 16);
    }

    // processing
    const pOn = win(lt, T1 + 0.6, T1 + 1.0, T2, T2 + 0.5);
    fade(upLabel, pOn); fade(upBar, pOn); fade(track, win(lt, T1 + 1.6, T1 + 2.0, T2, T2 + 0.5));
    upBar.firstElementChild.style.width = `${100 * sio(lt, T1 + 0.6, T1 + 2.0)}%`;
    upLabel.textContent = lt < T1 + 2.0 ? "Uploading the take" : "Gemini · finding the steps";
    const scan = lin(lt, T1 + 2.0, T1 + 4.2);
    beam.style.left = `${scan * 100}%`;
    fade(beam, scan > 0 && scan < 1 ? 1 : 0);
    ticks.forEach((tk, i) => show(tk, seg(scan, STEP_AT[i] / TAKE_LEN, STEP_AT[i] / TAKE_LEN + 0.06), 10));

    // the lesson card
    const lOn = win(lt, T2, T2 + 0.7, T3 - 0.4, T3);
    setStyle(lessonCard, { opacity: String(lOn), transform: `translateY(${(1 - sio(lt, T2, T2 + 0.8)) * 60 - 40 * seg(lt, T3 - 0.4, T3)}px)` });
    tiles.forEach((tl, i) => show(tl, seg(lt, T2 + 0.3 + i * 0.12, T2 + 0.8 + i * 0.12), 16));

    return syncVideo(lt);
  }
  function off() { vids.forEach((v) => { if (!v.paused) v.pause(); }); }
  return { el, render, off };
}
