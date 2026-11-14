// Prepares the chef's take for the film (footage/ is gitignored: copy chef-take.mp4 there first).
//   npm run footage:prep            -> footage/chef-take-30.mp4 (smooth 30 fps picture) + footage/stills/step1..6.jpg
//   npm run footage:prep -- --force  redo both
// chef-take.mp4: the chef's real recording from the glasses (133.7 s, 720x1280, variable frame rate ~24 fps).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, "footage");
const TAKE = join(DIR, "chef-take.mp4");
const PROXY = join(DIR, "chef-take-30.mp4");
const STILLS = join(DIR, "stills");
// where each lesson step's still comes from in the take (keep in step with film/footage.js STEP_AT)
const STEP_AT = [21, 64, 79, 108, 116, 131.5];
const force = process.argv.includes("--force");
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });

if (!existsSync(TAKE)) {
  console.error(`missing ${TAKE}: copy the chef's take there (it is never committed)`);
  process.exit(1);
}
// 1 · picture: constant 30 fps with the dropped frames filled by motion interpolation (the raw take stutters),
//     a keyframe every 0.5 s so the player seeks exactly. Slow: several minutes.
if (force || !existsSync(PROXY)) {
  console.log("making chef-take-30.mp4 (minutes)…");
  ff(["-i", TAKE, "-an", "-vf", "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-g", "15", "-keyint_min", "15", "-sc_threshold", "0", "-movflags", "+faststart", PROXY]);
}
// 2 · the lesson's six stills: 16:10 crops of the board, 640x400
mkdirSync(STILLS, { recursive: true });
STEP_AT.forEach((t, i) => {
  const out = join(STILLS, `step${i + 1}.jpg`);
  if (force || !existsSync(out)) ff(["-ss", String(t), "-i", TAKE, "-frames:v", "1", "-vf", "crop=720:450:0:600,scale=640:400", "-q:v", "3", out]);
});
console.log(`ready: ${PROXY} and ${STILLS}`);
