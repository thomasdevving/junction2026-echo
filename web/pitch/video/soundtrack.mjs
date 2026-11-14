// Echo film soundtrack: ElevenLabs voiceover + ElevenLabs music + the chef's real voice, mixed to the film's clock.
// The cue sheet is film/sound.js; picture timings come from film/config.js. Output (gitignored):
//   audio/soundtrack.m4a, which film.html plays in sync with the picture.
//
//   npm run sound:vo [-- <id> ...]     generate VO lines that are missing (or the listed ones) -> audio/film-vo/
//   npm run sound:music [-- --force]   compose the music bed -> audio/music/bed.mp3
//   npm run sound:mix                  mix everything -> audio/soundtrack.m4a (+ .wav), then print loudness
//   npm run sound:check                timeline of every cue, with overlap warnings (no network)
// The API key is never in code: the npm scripts run with --env-file=.env.local and the SDK reads ELEVENLABS_API_KEY.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION, SCENES, FOOTAGE } from "./film/config.js";
import { VOICES, VO, CHEF, AMBIENCE_GAIN, MUSIC } from "./film/sound.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const TAKE = join(HERE, FOOTAGE.take ?? FOOTAGE.src); // the original take carries the sound
const VO_DIR = join(HERE, "audio", "film-vo");
const MUSIC_FILE = join(HERE, "audio", "music", "bed.mp3");
const OUT = join(HERE, "audio", "soundtrack");
const TTS_MODEL = "eleven_v4"; // verified for this account at Gate 2 (tts.mjs)
const SETTINGS = { stability: 0.6, similarityBoost: 0.6 };

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
const probe = (f) => Number(sh("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).trim());
const wav = (id) => join(VO_DIR, `${id}.wav`);
/** Integrated loudness (LUFS) of a file, or of a stretch of it after filter `af`. */
function lufs(file, { ss, to, af } = {}) {
  const a = ["-hide_banner", "-nostats"];
  if (ss !== undefined) a.push("-ss", String(ss), "-to", String(to));
  a.push("-i", file, "-af", `${af ? `${af},` : ""}ebur128`, "-f", "null", "-");
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(spawnSync("ffmpeg", a, { encoding: "utf8" }).stderr.split("Summary:")[1] ?? "");
  if (!m) throw new Error(`could not measure ${file}`);
  return Number(m[1]);
}
// one fixed gain per clip (loudnorm misjudges clips of a few seconds, especially ones with a pause in them)
const SPEECH_LUFS = -17;
const CHEF_CLEAN = "highpass=f=100,afftdn=nf=-30";
const ROOM_UNDER = 0.18; // original room sound blended under the isolated voice (about -15 dB)

// where the "following it" cuts land in the film (same arithmetic as film/footage.js)
function followCuts() {
  const sc = SCENES.find((s) => s.id === "footage");
  let at = FOOTAGE.chef.reduce((a, c) => a + (c.out - c.in), 0) + FOOTAGE.process + FOOTAGE.lesson;
  return FOOTAGE.follow.map((c) => {
    const start = sc.start + at;
    at += c.out - c.in;
    const end = Math.min(sc.start + at, sc.end);
    return { in: c.in, out: c.in + (end - start), at: start, end, last: end >= sc.end - 1e-6 };
  });
}

async function client() {
  const { ElevenLabsClient } = await import("@elevenlabs/elevenlabs-js");
  if (!process.env.ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not set: run through `npm run sound:…` (uses .env.local)");
  return new ElevenLabsClient();
}
async function save(stream, file) {
  mkdirSync(dirname(file), { recursive: true });
  const chunks = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  writeFileSync(file, Buffer.concat(chunks));
}
function explain(err) {
  const s = err?.statusCode ?? err?.status;
  if (s === 401) return "401: key rejected (check .env.local).";
  if (s === 402) return "402: not available on this plan.";
  if (s === 429) return "429: rate limited. Wait and retry.";
  return err?.body ? `${s}: ${JSON.stringify(err.body)}` : err?.message ?? String(err);
}

async function vo(ids) {
  const el = await client();
  const todo = VO.filter((l) => (ids.length ? ids.includes(l.id) : !existsSync(wav(l.id))));
  for (const line of todo) {
    // continuity: the same speaker's neighbouring lines as context
    const same = VO.filter((l) => l.voice === line.voice);
    const i = same.indexOf(line);
    const ctx = {};
    if (same[i - 1]) ctx.previousText = same[i - 1].text;
    if (same[i + 1]) ctx.nextText = same[i + 1].text;
    const mp3 = join(VO_DIR, `${line.id}.mp3`);
    const audio = await el.textToSpeech.convert(VOICES[line.voice], { text: line.text, modelId: TTS_MODEL, outputFormat: "mp3_44100_192", voiceSettings: SETTINGS, ...ctx });
    await save(audio, mp3);
    // trim to the first and last word, so `at` is when the speech starts
    const trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.06,areverse";
    sh("ffmpeg", ["-y", "-v", "error", "-i", mp3, "-af", trim, "-ar", "48000", "-ac", "1", wav(line.id)]);
    console.log(`${line.id}\t${probe(wav(line.id)).toFixed(2)} s\t${line.voice}\t${line.text}`);
  }
  if (!todo.length) console.log("all VO lines exist (pass ids to regenerate)");
}

// the chef's lines through ElevenLabs Voice Isolator (the take's noise is crowd chatter, which local denoisers can't
// separate). Only the clips used in the film are uploaded. -> audio/chef/chef<N>.iso.mp3, same length as the clip
const CHEF_DIR = join(HERE, "audio", "chef");
const iso = (i) => join(CHEF_DIR, `chef${i + 1}.iso.mp3`);
async function isolate(force) {
  const el = await client();
  for (const [i, c] of CHEF.entries()) {
    if (existsSync(iso(i)) && !force) { console.log(`${iso(i)} exists`); continue; }
    mkdirSync(CHEF_DIR, { recursive: true });
    // 0.5 s of context each side (the isolator needs ≥ 4.6 s), trimmed back to the exact clip afterwards
    const pre = Math.min(0.5, c.in), raw = join(CHEF_DIR, `chef${i + 1}.raw.wav`), out = join(CHEF_DIR, `chef${i + 1}.iso.full.mp3`);
    sh("ffmpeg", ["-y", "-v", "error", "-ss", String(c.in - pre), "-to", String(c.out + 0.5), "-i", TAKE, "-vn", "-ac", "1", "-ar", "48000", raw]);
    const audio = await el.audioIsolation.convert({ audio: new File([readFileSync(raw)], `chef${i + 1}.wav`, { type: "audio/wav" }) });
    await save(audio, out);
    sh("ffmpeg", ["-y", "-v", "error", "-ss", String(pre), "-t", String(c.out - c.in), "-i", out, "-c:a", "libmp3lame", "-q:a", "0", iso(i)]);
    console.log(`${iso(i)}\t${probe(iso(i)).toFixed(2)} s (clip ${(c.out - c.in).toFixed(2)} s)`);
  }
}

async function music(force) {
  if (existsSync(MUSIC_FILE) && !force) return console.log(`${MUSIC_FILE} exists (use --force to recompose)`);
  const el = await client();
  const audio = await el.music.compose({ prompt: MUSIC.prompt, musicLengthMs: Math.round(DURATION * 1000), modelId: MUSIC.model, forceInstrumental: true });
  await save(audio, MUSIC_FILE);
  console.log(`${MUSIC_FILE}\t${probe(MUSIC_FILE).toFixed(2)} s`);
}

function cues() {
  return [
    ...VO.map((l) => ({ id: l.id, who: l.voice, at: l.at, dur: existsSync(wav(l.id)) ? probe(wav(l.id)) : NaN, text: l.text })),
    ...CHEF.map((c, i) => ({ id: `chef${i + 1}`, who: "chef", at: c.at, dur: c.out - c.in, text: c.says })),
  ].sort((a, b) => a.at - b.at);
}
function check() {
  const list = cues();
  let warn = 0;
  const fmt = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
  list.forEach((c, i) => {
    const end = c.at + c.dur, next = list[i + 1];
    const scene = SCENES.find((s) => c.at >= s.start && c.at < s.end)?.id ?? "?";
    let note = "";
    if (Number.isNaN(c.dur)) note = "  (not generated yet)";
    else if (next && end > next.at - 0.15) { note = `  ⚠ runs ${(end - next.at + 0.15).toFixed(2)} s into ${next.id}`; warn++; }
    else if (end > DURATION) { note = "  ⚠ past the end"; warn++; }
    console.log(`${fmt(c.at)}–${Number.isNaN(c.dur) ? "  ?  " : fmt(end)}  ${scene.padEnd(7)} ${c.who.padEnd(8)} ${c.id.padEnd(6)} ${c.text}${note}`);
  });
  console.log(warn ? `\n${warn} overlap warning(s)` : "\nno overlaps");
  return warn;
}

function mix() {
  const missing = VO.filter((l) => !existsSync(wav(l.id))).map((l) => l.id);
  if (missing.length) throw new Error(`missing VO: ${missing.join(", ")} (run npm run sound:vo)`);
  if (!existsSync(TAKE)) throw new Error(`missing the take: ${TAKE}`);
  check();
  const D = DURATION;
  const args = ["-y", "-v", "error"];
  const f = [];
  let n = 0;
  const ms = (t) => Math.max(0, Math.round(t * 1000));

  // scripted voices: each line levelled, placed at its time
  const vLabels = VO.map((l) => {
    args.push("-i", wav(l.id));
    const g = (SPEECH_LUFS - lufs(wav(l.id))).toFixed(2);
    f.push(`[${n}:a]aformat=channel_layouts=mono,volume=${g}dB,adelay=${ms(l.at)}:all=1[v${n}]`);
    return `[v${n++}]`;
  });
  // the chef's real voice: the isolated voice (npm run sound:isolate) with a little of the original room under it, so
  // it doesn't sound pasted on; without isolation, the take with a light local cleanup. Levelled to sit with the narration.
  const cLabels = CHEF.map((c, i) => {
    const len = c.out - c.in;
    let g, pre;
    if (existsSync(iso(i))) {
      const clean = join(CHEF_DIR, `chef${i + 1}.clean.wav`);
      sh("ffmpeg", ["-y", "-v", "error", "-i", iso(i), "-ss", String(c.in), "-to", String(c.out), "-i", TAKE, "-filter_complex",
        `[0:a]aformat=channel_layouts=mono,aresample=48000,highpass=f=70[v];[1:a]aformat=channel_layouts=mono,aresample=48000,highpass=f=100,volume=${ROOM_UNDER}[r];` +
        `[v][r]amix=inputs=2:normalize=0:duration=first[o]`, "-map", "[o]", "-t", String(len), "-ar", "48000", clean]);
      args.push("-i", clean);
      g = (SPEECH_LUFS - 0.5 - lufs(clean)).toFixed(2);
      pre = "";
    } else {
      args.push("-ss", String(c.in), "-to", String(c.out), "-i", TAKE);
      g = (SPEECH_LUFS - 0.5 - lufs(TAKE, { ss: c.in, to: c.out, af: CHEF_CLEAN })).toFixed(2);
      pre = `${CHEF_CLEAN},`;
    }
    f.push(`[${n}:a]aformat=channel_layouts=mono,${pre}volume=${g}dB,aresample=48000,` +
      `afade=t=in:d=0.08,afade=t=out:st=${(len - 0.18).toFixed(3)}:d=0.18,adelay=${ms(c.at)}:all=1[c${n}]`);
    return `[c${n++}]`;
  });
  f.push(`${[...vLabels, ...cLabels].join("")}amix=inputs=${vLabels.length + cLabels.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D},asplit=3[speech][sc1][sc2]`);

  // natural sound under the following cuts, low, ducked under speech
  const aLabels = followCuts().map((c) => {
    const len = c.out - c.in, fo = c.last ? 1.2 : 0.06;
    args.push("-ss", String(c.in), "-to", String(c.out), "-i", TAKE);
    f.push(`[${n}:a]aformat=channel_layouts=mono,highpass=f=80,aresample=48000,volume=${AMBIENCE_GAIN},` +
      `afade=t=in:d=0.06,afade=t=out:st=${(len - fo).toFixed(3)}:d=${fo},adelay=${ms(c.at)}:all=1[a${n}]`);
    return `[a${n++}]`;
  });
  f.push(`${aLabels.join("")}amix=inputs=${aLabels.length}:normalize=0:dropout_transition=0,apad=whole_dur=${D}[amb0]`);
  f.push(`[amb0][sc1]sidechaincompress=threshold=0.03:ratio=6:attack=10:release=350[amb]`);
  f.push("[speech]aformat=channel_layouts=stereo[sp]", "[amb]aformat=channel_layouts=stereo[am]");
  const parts = ["[sp]", "[am]"];
  if (existsSync(MUSIC_FILE)) {
    args.push("-i", MUSIC_FILE);
    // music: fades in and out with the film, dips under any speech
    f.push(`[${n}:a]aformat=channel_layouts=stereo,aresample=48000,apad=whole_dur=${D},atrim=0:${D},afade=t=in:d=1.5,afade=t=out:st=${D - 2.5}:d=2.5,volume=0.36[m0]`);
    f.push(`[sc2]aformat=channel_layouts=stereo[sc2s]`);
    // a gentle duck (~8–10 dB): the music stays present under the voice instead of pumping in and out
    f.push(`[m0][sc2s]sidechaincompress=threshold=0.05:ratio=3:attack=60:release=900[mus]`);
    parts.push("[mus]");
    n++;
  } else console.log("(no music yet: mixing without it)");
  // stems (for checking the balance) and the pre-master; every bus is split so it can be written on its own
  const stems = parts.map((p, i) => { f.push(`${p}asplit=2[mx${i}][st${i}]`); return `[mx${i}]`; });
  f.push(`${stems.join("")}amix=inputs=${parts.length}:normalize=0:dropout_transition=0[pre]`);

  const STEMS = join(dirname(OUT), "stems");
  mkdirSync(STEMS, { recursive: true });
  const names = ["speech", "ambience", "music"];
  const maps = parts.flatMap((_, i) => ["-map", `[st${i}]`, "-t", String(D), "-ar", "48000", join(STEMS, `${names[i]}.wav`)]);
  sh("ffmpeg", [...args, "-filter_complex", f.join(";"), "-map", "[pre]", "-t", String(D), "-ac", "2", "-ar", "48000", `${OUT}.pre.wav`, ...maps]);
  // master: one fixed gain to -16 LUFS (a dynamic normaliser would ride the music's swell and pull the last line down),
  // then a true-peak limiter at -1.5 dBFS
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", `${OUT}.pre.wav`, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr.split("Summary:")[1])[1]);
  const gain = (-16 - I).toFixed(2);
  sh("ffmpeg", ["-y", "-v", "error", "-i", `${OUT}.pre.wav`, "-af", `volume=${gain}dB,alimiter=limit=0.84:level=disabled:attack=2:release=60,aresample=48000`, "-ar", "48000", `${OUT}.wav`]);
  console.log(`pre-master ${I} LUFS → gain ${gain} dB`);
  sh("ffmpeg", ["-y", "-v", "error", "-i", `${OUT}.wav`, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", `${OUT}.m4a`]);
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", `${OUT}.wav`, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr; // ebur128 reports on stderr
  console.log(`\n${OUT}.m4a  ${probe(`${OUT}.m4a`).toFixed(2)} s (film ${D} s)`);
  console.log(r.split("Summary:")[1] ?? "");
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "vo") await vo(rest);
  else if (cmd === "music") await music(rest.includes("--force"));
  else if (cmd === "isolate") await isolate(rest.includes("--force"));
  else if (cmd === "mix") mix();
  else if (cmd === "check") check();
  else throw new Error("usage: node soundtrack.mjs vo [ids…] | music [--force] | mix | check");
} catch (err) {
  console.error(explain(err));
  process.exitCode = 1;
}
