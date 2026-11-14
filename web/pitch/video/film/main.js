// Echo film player. One clock (the timeline in config.js); renderFrame(t) draws any moment from scratch.
// Keys: Space play/pause · ←/→ 2 s · Shift+←/→ 0.1 s · Home replay · F fullscreen · C clean playback · M mute.
// Sound: audio/soundtrack.m4a (built by ../soundtrack.mjs, gitignored). While it plays it is the clock, so picture and
// sound cannot drift; without it the film plays silent on the wall clock.
// ?t=42 opens at 42 s · ?render (used by ../render.mjs): no controls, 1:1 stage · ?stamp shows the time.
import { DURATION, SCENES } from "./config.js";
import { buildScenes } from "./scenes.js";
import { CHEF } from "./sound.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const RENDER = params.has("render");
if (RENDER) document.body.classList.add("render");

const stage = $("stage");
stage.classList.add("stage");
const scenes = buildScenes(stage);
const stampEl = Object.assign(document.createElement("div"), { className: "stamp", hidden: true });
stage.append(stampEl);
// subtitles for the chef's real voice (the take is noisy and accented): one caption per line, timed to the sound
const capEl = Object.assign(document.createElement("div"), { className: "caption" });
capEl.innerHTML = "<b>Chef</b><span></span>";
stage.append(capEl);
const CAPS = CHEF.map((c) => ({ from: c.at, to: c.at + (c.out - c.in), text: c.says }));
function caption(t) {
  const c = CAPS.find((x) => t >= x.from - 0.15 && t < x.to + 0.25);
  const o = c ? Math.min(1, (t - (c.from - 0.15)) / 0.15, (c.to + 0.25 - t) / 0.2) : 0;
  if (c) capEl.lastElementChild.textContent = c.text;
  capEl.style.opacity = String(Math.max(0, o));
}

window.DURATION = DURATION;
window.__filmPlaying = false;
// Scene transitions: one clock moves the outgoing and the incoming scene together (see `in` in config.js).
const io = (p) => { p = Math.min(1, Math.max(0, p)); return p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2; };
function move(type, p, incoming) {
  const blur = type === "match" ? 0 : 7 * Math.sin(Math.PI * p);
  if (type === "left") return { tf: `translateX(${incoming ? 1920 * (1 - p) : -1920 * p}px)`, op: 1, blur };
  if (type === "up") return { tf: `translateY(${incoming ? 1080 * (1 - p) : -1080 * p}px)`, op: 1, blur };
  return { tf: "none", op: incoming ? p : 1, blur };
}

window.renderFrame = async (t) => {
  const pending = []; // a scene's render may return a promise (e.g. a paused video seeking to its frame)
  SCENES.forEach((s, i) => {
    const sc = scenes[s.id], next = SCENES[i + 1];
    const inDur = s.in?.dur ?? 0;
    const on = t >= s.start - inDur && (t < s.end || (s.end === DURATION && t <= DURATION));
    // display:none (not visibility) so no explicitly visible child can leak out of an inactive scene
    sc.el.style.display = on ? "block" : "none";
    sc.el.style.visibility = "visible";
    if (!on) { sc.off?.(); return; } // e.g. pause footage videos when their scene is left, including after a seek
    const r = sc.render(t - s.start);
    if (r && typeof r.then === "function") pending.push(r);
    let m = { tf: "none", op: 1, blur: 0 };
    if (inDur && t < s.start) m = move(s.in.type, io((t - (s.start - inDur)) / inDur), true);
    else if (next?.in && t >= next.start - next.in.dur) m = move(next.in.type, io((t - (next.start - next.in.dur)) / next.in.dur), false);
    sc.el.style.transform = m.tf;
    sc.el.style.opacity = String(m.op);
    sc.el.style.filter = m.blur > 0.05 ? `blur(${m.blur.toFixed(2)}px)` : "none";
  });
  caption(t);
  if (pending.length) await Promise.all(pending);
  if (params.has("stamp")) {
    stampEl.hidden = false;
    stampEl.textContent = `${t.toFixed(2)} s`;
  }
};

// ---------- fit the 1920x1080 stage into the window ----------
function fit() {
  if (RENDER) return;
  const vp = $("viewport").getBoundingClientRect();
  const s = Math.min(vp.width / 1920, vp.height / 1080);
  stage.style.transform = `translate(${(vp.width - 1920 * s) / 2}px, ${(vp.height - 1080 * s) / 2}px) scale(${s})`;
}
addEventListener("resize", fit);

// ---------- clock ----------
let t = Math.min(Number(params.get("t")) || 0, DURATION);
let playing = false, wall0 = 0, t0 = 0;
const fmt = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
const seek = $("seek");
seek.max = String(DURATION);

function ui() {
  seek.value = String(t);
  $("time").textContent = `${fmt(t)} / ${fmt(DURATION)}`;
  const s = SCENES.find((x) => t >= x.start && t < x.end) ?? SCENES.at(-1);
  $("scene").textContent = s.title;
  $("play").textContent = playing ? "❚❚" : "▶";
  $("play").setAttribute("aria-label", playing ? "Pause" : "Play");
}
function draw() {
  window.renderFrame(t);
  ui();
}

// ---------- soundtrack ----------
const sound = RENDER ? null : Object.assign(new Audio(), { src: "audio/soundtrack.m4a", preload: "auto" });
let soundOk = false;
window.__sound = sound; // for checks from the console
sound?.addEventListener("canplay", () => { soundOk = true; });
sound?.addEventListener("error", () => { soundOk = false; });
function syncSound(seekNow) {
  if (!sound || !soundOk) return;
  if (!playing) { if (!sound.paused) sound.pause(); return; }
  if (seekNow || Math.abs(sound.currentTime - t) > 0.12) sound.currentTime = t;
  if (sound.paused) sound.play().catch(() => {});
}
const soundIsClock = () => soundOk && playing && !sound.paused && !sound.seeking && sound.readyState >= 3;

function setPlaying(p) {
  if (p && t >= DURATION) t = 0;
  playing = p;
  window.__filmPlaying = p;
  wall0 = performance.now();
  t0 = t;
  syncSound(true);
  draw();
}
function goTo(x) {
  t = Math.max(0, Math.min(DURATION, x));
  t0 = t;
  wall0 = performance.now();
  syncSound(true);
  draw();
}
function loop(now) {
  if (playing) {
    if (soundIsClock()) { t = sound.currentTime; t0 = t; wall0 = now; } // the sound leads; the wall clock takes over if it stalls
    else t = t0 + (now - wall0) / 1000;
    if (t >= DURATION) { t = DURATION; playing = false; window.__filmPlaying = false; sound?.pause(); }
    draw();
  }
  requestAnimationFrame(loop);
}

// ---------- controls ----------
$("play").onclick = () => setPlaying(!playing);
$("replay").onclick = () => { goTo(0); setPlaying(true); };
seek.oninput = () => goTo(Number(seek.value));
$("clean").onclick = () => { document.body.classList.toggle("clean"); fit(); };
$("fs").onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
document.addEventListener("fullscreenchange", () => { document.body.classList.toggle("fs", Boolean(document.fullscreenElement)); setTimeout(fit, 50); });
let idleTimer;
addEventListener("mousemove", () => {
  document.body.classList.remove("idle");
  clearTimeout(idleTimer);
  if (document.fullscreenElement) idleTimer = setTimeout(() => document.body.classList.add("idle"), 1800);
});
addEventListener("keydown", (e) => {
  if (e.target === seek && e.key.startsWith("Arrow")) return;
  const step = e.shiftKey ? 0.1 : 2;
  if (e.key === " ") { e.preventDefault(); setPlaying(!playing); }
  else if (e.key === "ArrowRight") goTo(t + step);
  else if (e.key === "ArrowLeft") goTo(t - step);
  else if (e.key === "Home") goTo(0);
  else if (e.key === "f" || e.key === "F") $("fs").click();
  else if (e.key === "c" || e.key === "C") $("clean").click();
  else if ((e.key === "m" || e.key === "M") && sound) sound.muted = !sound.muted;
});
$("ticks").innerHTML = SCENES.map((s) => `<b style="left:${(s.start / DURATION) * 100}%"></b><span style="left:${(s.start / DURATION) * 100}%">${s.title}</span>`).join("");

await document.fonts.load("500 104px Manrope");
await document.fonts.ready;
await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
fit();
draw();
requestAnimationFrame(loop);
window.ready = true;
