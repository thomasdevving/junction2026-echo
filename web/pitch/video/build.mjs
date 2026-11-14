// Echo pitch film: the MP4. Picture from film.html (rendered frame by frame), sound from soundtrack.mjs.
//   node build.mjs film [--fresh]   frames + soundtrack + encode + checks -> out/echo-film.mp4
//   npm run film                    the same
// Frames are resumable (frames/film-v2/, re-run to continue); --fresh clears them after a picture change.
// Everything in audio/, frames/ and out/ is gitignored.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION } from "./film/config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const LIMIT = 120; // the 2:00 rule, enforced strictly
const FRAMES = join(HERE, "frames", "film-v2");
const SOUND = join(HERE, "audio", "soundtrack.wav");
const OUT = join(HERE, "out", "echo-film.mp4");

const run = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const probe = (file, what = "format=duration") => sh("ffprobe", ["-v", "error", "-show_entries", what, "-of", "default=nw=1:nk=1", file]).trim();

function film(fresh) {
  if (DURATION > LIMIT) throw new Error(`the film is ${DURATION} s, over the ${LIMIT} s limit`);
  // 1 · picture: every frame at 1920x1080, no player controls (?render)
  if (fresh) rmSync(FRAMES, { recursive: true, force: true });
  run("node", [join(HERE, "render.mjs"), "frames", "pitch/video/film.html?render", "0", String(DURATION), String(FPS), FRAMES, "3"]);
  const n = readdirSync(FRAMES).filter((f) => f.endsWith(".png")).length;
  if (n !== Math.round(DURATION * FPS)) throw new Error(`expected ${Math.round(DURATION * FPS)} frames, found ${n}`);

  // 2 · sound: rebuild the mix from the cue sheet (VO and music must already be generated)
  run("node", [join(HERE, "soundtrack.mjs"), "mix"]);
  if (!existsSync(SOUND)) throw new Error(`missing ${SOUND}`);

  // 3 · encode: H.264 (BT.709, yuv420p) + AAC, cut to the film's exact length
  mkdirSync(dirname(OUT), { recursive: true });
  sh("ffmpeg", ["-y", "-v", "error", "-framerate", String(FPS), "-i", join(FRAMES, "%05d.png"), "-i", SOUND,
    "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "aac", "-b:a", "192k", "-t", String(DURATION), "-movflags", "+faststart", OUT]);

  // 4 · checks
  const dur = Number(probe(OUT));
  const v = Number(probe(OUT, "stream=duration").split("\n")[0]);
  const r128 = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", OUT, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const I = /I:\s+(-?[\d.]+) LUFS/.exec(r128.split("Summary:")[1] ?? "")?.[1];
  const P = /Peak:\s+(-?[\d.]+) dBFS/.exec(r128.split("Summary:")[1] ?? "")?.[1];
  console.log(`\n${OUT}`);
  console.log(`duration ${dur.toFixed(2)} s (video stream ${v.toFixed(2)} s) — ${dur <= LIMIT ? "OK" : "OVER THE LIMIT"} (limit ${LIMIT} s)`);
  console.log(`loudness ${I} LUFS integrated, true peak ${P} dBFS`);
}

const [cmd, flag] = process.argv.slice(2);
if (cmd === "film") film(flag === "--fresh");
else {
  console.error("usage: node build.mjs film [--fresh]");
  process.exit(1);
}
