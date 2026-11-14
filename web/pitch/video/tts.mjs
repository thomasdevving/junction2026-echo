// Echo pitch video: voiceover via ElevenLabs (written from ElevenLabs' text-to-speech skill guide).
// The key is never in code: run through the npm scripts, which use `node --env-file=.env.local`,
// and the SDK reads ELEVENLABS_API_KEY from the environment.
//
//   npm run voices                         list the account's pre-made voices (no speech generated)
//   npm run audition -- <id> <id> <id>     part A with each voice -> audio/audition/<id>.mp3
//   npm run vo -- <id>                     every shipped part -> audio/vo/<part>.mp3
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = "eleven_v4";
// Narration preset from the guide. Eleven v4 takes only stability + similarityBoost;
// pacing comes from punctuation, not a speed setting.
const SETTINGS = { stability: 0.7, similarityBoost: 0.5 };
const vo = JSON.parse(readFileSync(join(HERE, "vo.json"), "utf8"));
const client = new ElevenLabsClient();

function duration(file) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
    return Number(out.toString().trim()).toFixed(2);
  } catch {
    return "?";
  }
}

async function speak(voiceId, text, out, context = {}) {
  mkdirSync(dirname(out), { recursive: true });
  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: MODEL,
    outputFormat: "mp3_44100_192", // Creator plan and above
    voiceSettings: SETTINGS,
    ...context,
  });
  await pipeline(Readable.fromWeb(audio), createWriteStream(out));
  return duration(out);
}

function explain(err) {
  const status = err?.statusCode ?? err?.status;
  if (status === 402) return "402: this voice needs a paid plan (Voice Library voice). Pick a pre-made voice.";
  if (status === 401) return "401: key rejected. Run `npx -y @elevenlabs/cli@latest onboard check --env-path .env.local`.";
  if (status === 429) return "429: rate limit. Wait and retry.";
  return err?.message ?? String(err);
}

const part = (id) => vo.parts.find((p) => p.id === id);
const [cmd, ...args] = process.argv.slice(2);

try {
  if (cmd === "voices") {
    const res = await client.voices.getAll();
    const premade = res.voices.filter((v) => v.category === "premade");
    for (const v of premade) {
      const l = v.labels ?? {};
      console.log([v.voiceId, v.name, l.gender, l.age, l.accent, l.descriptive ?? l.description, l.use_case].filter(Boolean).join(" | "));
    }
    console.log(`${premade.length} pre-made voices`);
  } else if (cmd === "audition") {
    if (args.length === 0) throw new Error("usage: npm run audition -- <voiceId> [<voiceId> ...]");
    const text = part(vo.audition).text;
    for (const id of args) {
      const out = join(HERE, "audio", "audition", `${id}.mp3`);
      console.log(`${id}\t${await speak(id, text, out)} s\t${out}`);
    }
  } else if (cmd === "vo") {
    const [voiceId] = args;
    if (!voiceId) throw new Error("usage: npm run vo -- <voiceId>");
    // Request stitching inside each group, so joins between consecutive parts sound continuous.
    for (const group of vo.groups) {
      const parts = group.map(part).filter((p) => p && p.ship !== false);
      for (const [i, p] of parts.entries()) {
        const context = {};
        if (i > 0) context.previousText = parts[i - 1].text;
        if (i < parts.length - 1) context.nextText = parts[i + 1].text;
        // With timestamps: the build uses per-character times to lengthen pauses at sentence ends
        // and to cue the picture to words (audio leads, picture follows).
        const out = join(HERE, "audio", "vo", `${p.id}.mp3`);
        mkdirSync(dirname(out), { recursive: true });
        const res = await client.textToSpeech.convertWithTimestamps(voiceId, {
          text: p.text, modelId: MODEL, outputFormat: "mp3_44100_192", voiceSettings: SETTINGS, ...context,
        });
        writeFileSync(out, Buffer.from(res.audioBase64, "base64"));
        writeFileSync(out.replace(/\.mp3$/, ".align.json"), JSON.stringify({ text: p.text, ...res.alignment }));
        console.log(`${p.id}\t${duration(out)} s\t${out}`);
      }
    }
  } else {
    throw new Error("usage: npm run voices | npm run audition -- <ids…> | npm run vo -- <id>");
  }
} catch (err) {
  console.error(explain(err));
  process.exitCode = 1;
}
