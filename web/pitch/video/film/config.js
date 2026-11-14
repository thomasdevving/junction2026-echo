// Echo film: the one authoritative timeline (seconds), and the real footage edit. Start with ../HANDOFF.md.
// Picture first: these timings are the edit. Voiceover will be written to fit them later.

export const DURATION = 97;

// `in` = how a scene arrives; the player moves the outgoing and incoming scene together on one clock:
//   match: the outgoing scene has already shaped itself into the incoming one (same background, same frame);
//          only the new content fades in.
//   left:  a pan; the old shot leaves to the left as the new one enters from the right.
//   up:    a tilt down; the old shot leaves upward as the new one rises from below.
export const SCENES = [
  { id: "open", title: "Glasses → through the lens → Echo", start: 0, end: 14 },
  { id: "footage", title: "The chef's recording → lesson → following it", start: 14, end: 50, in: { type: "match", dur: 0.6 } },
  { id: "how", title: "Source frame → instruction → comparison", start: 50, end: 77, in: { type: "left", dur: 1.4 } },
  { id: "trust", title: "When it can't tell", start: 77, end: 86, in: { type: "up", dur: 1.0 } },
  { id: "end", title: "Success → Echo", start: 86, end: DURATION, in: { type: "left", dur: 0.9 } },
];

/**
 * The footage scene (30 s, times relative to its start at 14 s in the film), cut from the chef's real recording.
 * The take lives in web/pitch/video/footage/ (gitignored) and is never committed. `in`/`out` are seconds in the take.
 *   chef:    a montage of the chef recording once (Chef mode: REC + a pinch per step)
 *   process: the take uploads; Gemini finds the steps
 *   lesson:  what the pipeline generated: the lesson and its six steps, stills taken from the take
 *   follow:  following the lesson; other cuts of the take with the lens view composited in (labelled simulated)
 * To re-cut: change in/out (each cut's length is out - in); the beats re-time themselves.
 */
export const FOOTAGE = {
  // picture: a constant-30 fps copy of the take. The glasses recorded variable frame rate with dropped frames (gaps of
  // 15–107 ms), which stuttered; the copy fills the gaps by motion interpolation and has a keyframe every 0.5 s:
  //   ffmpeg -i chef-take.mp4 -an -vf "minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
  //          -c:v libx264 -crf 17 -g 15 chef-take-30.mp4
  src: "footage/chef-take-30.mp4",
  take: "footage/chef-take.mp4", // the original: sound (soundtrack.mjs) and the lesson stills

  chef: [
    { in: 8.0, out: 9.8, step: 1 },
    { in: 31.0, out: 32.8, step: 2 },
    { in: 73.0, out: 74.8, step: 3 },
    { in: 87.5, out: 89.3, step: 4 },
    { in: 129.0, out: 130.8, step: 6 },
  ],
  process: 5, // seconds
  lesson: 4.5, // seconds
  follow: [
    { in: 47.0, out: 50.0, lens: [[0, "step", 2]] },
    // steady stretches only: at 1:33.5–1:39.5 and 1:56–1:59 the chef looks up and the shot pulls back to the room,
    // and at 1:55 the bread bag swings across the lens
    { in: 100.5, out: 104.7, lens: [[0, "step", 4], [2.0, "checking", 4], [2.9, "pass"]] },
    // ask: the bubbles appear when each line is spoken (qAt/aAt, seconds into the cut; film/sound.js q1/a1 match)
    { in: 109.0, out: 114.3, lens: [[0, "step", 5]], ask: { q: "How do I keep it from sliding?", a: "Spread side down, then press lightly.", qAt: 0.2, aAt: 2.4 } },
    { in: 123.0, out: 128.5, lens: [[0, "step", 6], [2.2, "done"]] }, // "done" holds before the pan out
  ],
};

// The lesson the pipeline produced (ai/fixtures: "Ham and cheese sandwich"), with stills cut from the take.
export const LESSON = {
  title: "Ham and cheese sandwich",
  steps: [
    { title: "Lay out bread", key: "Two slices side by side, flat", still: "footage/stills/step1.jpg" },
    { title: "Spread", key: "Thin layer, right to every edge", still: "footage/stills/step2.jpg" },
    { title: "Add lettuce", key: "One leaf, flat, no overhang", still: "footage/stills/step3.jpg" },
    { title: "Add fillings", key: "One even layer, edge to edge", still: "footage/stills/step4.jpg" },
    { title: "Close", key: "Spread side down, edges lined up", still: "footage/stills/step5.jpg" },
    { title: "Cut", key: "Corner to corner, one clean cut", still: "footage/stills/step6.jpg" },
  ],
};
