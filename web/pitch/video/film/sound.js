// Echo film: the sound edit (cue sheet). Film times in seconds, same clock as config.js.
// Built into one file by ../soundtrack.mjs (vo → music → mix): audio/soundtrack.m4a, which the player plays in sync.
// Generated audio lives in audio/ (gitignored); this file is the source of truth for what is said and when.

// ElevenLabs pre-made voices (listed with `npm run voices`). Eric was chosen for the narration at Gate 2.
export const VOICES = {
  narrator: "cjVigY5qzO86Huf0OWal", // Eric · smooth, trustworthy
  learner: "cgSgspJ2msm6clMCkdW9", // Jessica · the person cooking, asking a question
  echo: "EXAVITQu4vr4xnSDxMaL", // Sarah · Echo answering in the lens
};

// Scripted lines. `at` = when speech starts (generated audio is trimmed to its first word).
// Speech leads the picture by a few tenths of a second; the mix warns if a line runs into the next one.
export const VO = [
  // open: glasses → through the lens → Echo
  { id: "v01", at: 2.3, voice: "narrator", text: "Your hands are full." },
  { id: "v02", at: 6.6, voice: "narrator", text: "And the recipe video can't see your board." },
  { id: "v03", at: 9.5, voice: "narrator", text: "Echo puts the chef's view in your lens." },
  // footage: the chef speaks over the montage (CHEF below); then processing → the lesson → following it
  { id: "v04", at: 23.9, voice: "narrator", text: "Gemini finds every step in the recording, and turns it into a lesson, with the chef's own frames as reference." },
  { id: "v05", at: 32.8, voice: "narrator", text: "Now anyone can follow it. The next step, and the chef's reference, right in the lens." },
  // the Q&A cut starts at 39.7; its bubbles appear at qAt/aAt in config.js FOOTAGE.follow (0.2, 2.4)
  { id: "q1", at: 39.9, voice: "learner", text: "How do I keep it from sliding?" },
  { id: "a1", at: 42.1, voice: "echo", text: "Spread side down, then press lightly." },
  // how: source frame → instruction → comparison → under the hood
  { id: "v06", at: 50.7, voice: "narrator", text: "From one recording, six steps. Each keeps the chef's frame, and a rule Echo can check." },
  { id: "v07", at: 59.4, voice: "narrator", text: "Your view is compared with the chef's." },
  { id: "v08", at: 63.4, voice: "narrator", text: "If something's off, it tells you what to fix." },
  { id: "v09", at: 68.4, voice: "narrator", text: "Fix it, and you move on." },
  { id: "v10", at: 71.9, voice: "narrator", text: "The glasses see. The phone guides. Gemini compares you with the chef." },
  // trust
  { id: "v11", at: 77.6, voice: "narrator", text: "And when it can't see your board, it says so, instead of guessing." },
  { id: "v12", at: 83.7, voice: "narrator", text: "And it always shows when it's watching." },
  // end
  { id: "v13", at: 86.7, voice: "narrator", text: "Made the chef's way." },
  { id: "v14", at: 93.0, voice: "narrator", text: "Echo. Cook from the chef's point of view." },
];

// The chef's own voice from the real take, laid over the montage as continuous lines (the 1.8 s picture cuts
// would chop words). `in`/`out` are seconds in the take, checked with a local Whisper pass to start and end on
// whole words; `at` is the film time. `says` is also the subtitle shown while the line plays (film/main.js).
export const CHEF = [
  { in: 1.5, out: 5.8, at: 14.25, says: "Hey guys, today we're making a ham and cheese sandwich." },
  { in: 116.3, out: 121.0, at: 18.8, says: "And at the end, we can cut it from corner to corner, like this." },
];

// Natural sound under the "following it" cuts (the take's own audio at each cut), kept low and ducked under speech.
export const AMBIENCE_GAIN = 0.6;

export const MUSIC = {
  model: "music_v2_5",
  prompt:
    "Instrumental underscore for a 97-second product film about cooking with smart glasses. Warm, modern and optimistic: " +
    "soft felt piano, gentle plucked guitar, a light electronic pulse and subtle brushed percussion, around 96 BPM. " +
    "A calm, curious opening; a gentle lift at 0:14; a steady, focused middle that leaves room for a voiceover; " +
    "a warm, confident swell in the last ten seconds, ending on a clean resolved chord. No vocals.",
};
