/** @jsxImportSource vargai */
// ═══════════════════════════════════════════════════════════════════════════
// TARGET API EXAMPLE — Declarative Audio Graph (RFC 0001, Этап 2а/2в)
//
// Full formula-care ep2 (5 scenes, gym, kling-v3 NATIVE dialogue audio),
// rewritten against the NOT-YET-IMPLEMENTED target API. LSP errors below are
// intentional — each one marks a feature the refactor introduces:
//
//   audio: "native"         Video prop                        (Этап 2а)
//   vid.audio               derived AudioElement              (Этап 2а)
//   audio.speechRange()     speech-range op                   (Этап 2а)
//   audio.range()           silencedetect op                  (Этап 2а)
//   VideoElement type       named element type exports        (Этап 2а)
//   Captions w/o src        default = all timeline audio      (Этап 2а)
//   Music w/o duration      default = final timeline length,  (Этап 2а /
//                           integer seconds                    Этап 0 bug)
//   <AsyncComponent />      Promise<Element> JSX              (Этап 4 fix)
//
// Today (formula-care-ep2-cloud.tsx) this takes TWO passes:
//   pass 1: render → ffmpeg -vn per clip → silencedetect per clip by hand →
//           curl /v2/transcription → hand-build a 58-cue SRT → fix mishears
//   pass 2: re-render with hardcoded cutFrom/cutTo per clip + <Captions srt>
//
// After the refactor it is ONE pass: extraction, silence bounds and the
// transcript are lazy graph nodes, cached by computeCacheKey like any op.
// ═══════════════════════════════════════════════════════════════════════════

import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  Video,
  type VideoElement,
} from "vargai/react";
import { createVarg } from "../../../ai-sdk/index";

const varg = createVarg({ apiKey: process.env.VARG_API_KEY! });

const IMG_EDIT = varg.imageModel("nano-banana-pro/edit");
const IMG_BASE = varg.imageModel("nano-banana-pro");
const KLING = varg.videoModel("kling-v3");
const AR = "9:16";

// ── Client photo refs (uploaded once, referenced by URL) ─────────────────
const A1_PHOTO = "https://uu.varg.ai/1784576476121_3hb7fv71.jpeg";
const A2_PHOTO = "https://uu.varg.ai/1784576485522_vbgd4amk.jpeg";

// ── Character cards + location (same as today, unchanged) ────────────────
const a1Card = Image({
  prompt: {
    text: "Full-body character reference card of the exact same woman from the photo: same face, same grey hair, same body shape. Overweight woman in her late 50s with grey hair. She wears a simple dark sports bra top and snug high-waisted dark athletic shorts (underwear-style workout shorts), barefoot. Her belly is fully exposed and visible, arms bare, legs bare from mid-thigh down. Standing straight facing camera, neutral relaxed pose, arms at her sides. Plain light grey studio background, even soft lighting, head-to-toe framing, photorealistic",
    images: [A1_PHOTO],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

const a2Card = Image({
  prompt: {
    text: "Full-body character reference card of the exact same woman from the photo: same face, same hair, same slim build. Slim Asian fitness trainer in her 30s. She wears a fitted fitness uniform: sporty crop top and full-length leggings in matching color, clean athletic sneakers. Standing straight facing camera, confident friendly expression, arms at her sides. Plain light grey studio background, even soft lighting, head-to-toe framing, photorealistic",
    images: [A2_PHOTO],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

const gymLoc = Image({
  prompt:
    "Empty modern gym interior with huge floor-to-ceiling windows letting in bright natural daylight, green trees visible outside. Light wooden floor, a few yoga mats rolled in a corner, rack of dumbbells along one wall, mirrors on the opposite wall. No people. Clean airy atmosphere, warm daylight, photorealistic, 9:16 portrait framing",
  model: IMG_BASE,
  aspectRatio: AR,
});

const SAME =
  "First reference image is Woman A (overweight late-50s woman with grey hair, dark sports bra and dark athletic shorts, barefoot). Second reference image is Woman B (slim Asian trainer in her 30s in fitted fitness uniform with sneakers). Third reference image is the gym location with huge windows. Keep both women's faces, hair, bodies and outfits exactly as in their reference cards, and the gym exactly as in the location reference.";

// ── Scene stills ─────────────────────────────────────────────────────────
const scene1 = Image({
  prompt: {
    text: `${SAME} Medium-wide shot inside the gym in front of the huge windows. Woman A is mid-squat, knees bent, arms stretched forward for balance, belly folding, effortful concentrated expression. Woman B stands beside her closer to camera, facing the camera, speaking with an encouraging open-hand gesture. Bright natural daylight from the windows, warm candid atmosphere, photorealistic`,
    images: [a1Card, a2Card, gymLoc],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

const scene2 = Image({
  prompt: {
    text: `${SAME} Full-body shot inside the gym. Woman A stands facing away from the camera, seen from behind head to toe in her dark sports bra and dark athletic shorts, her bare legs visible. Woman B crouches beside her on the left, pointing a finger toward Woman A's hips and thighs while looking at the camera. Huge windows with daylight in the background, photorealistic`,
    images: [a1Card, a2Card, gymLoc],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

const scene3 = Image({
  prompt: {
    text: `${SAME} Full-body shot inside the gym. Woman A stands facing the camera head to toe, neutral stoic expression, her bare belly fully visible above the dark athletic shorts, hips and part of her rear visible. Woman B stands beside her on the left, slightly crouched, pointing an open hand at Woman A's belly while looking at the camera. Huge windows with daylight behind them, photorealistic`,
    images: [a1Card, a2Card, gymLoc],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

const scene4 = Image({
  prompt: {
    text: `${SAME} Close-up shot inside the gym, framing the upper bodies of both women. Woman A faces the camera holding her right arm raised out to the side, the soft loose skin of her bare upper arm clearly visible, part of her belly visible below. Woman B stands on the left, pointing at Woman A's raised arm while looking directly into the camera with a confident expression. Blurred gym windows in the background, intimate close framing, photorealistic`,
    images: [a1Card, a2Card, gymLoc],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

const scene5 = Image({
  prompt: {
    text: `${SAME} Medium-wide shot inside the gym in front of the huge windows, same framing as a squat training scene. Woman A has just risen from a squat, standing tall with a big proud happy smile, arms slightly raised in triumph. Woman B stands beside her facing the camera, laughing warmly and giving Woman A an encouraging thumbs-up. Both women look genuinely happy. Bright natural daylight, joyful warm atmosphere, photorealistic`,
    images: [a1Card, a2Card, gymLoc],
  },
  model: IMG_EDIT,
  aspectRatio: AR,
});

// ── The clips: native dialogue audio, declared ONCE ──────────────────────
// `audio: "native"` is sugar for providerOptions generate_audio=true AND
// keepAudio=true in one switch — no more paying 14¢/s for audio that
// keepAudio:false silently discards (the ep2 bug we found).
const vid1 = Video({
  prompt: {
    text: `Modern gym with huge floor-to-ceiling windows, green trees outside, bright daylight.
The older grey-haired woman performs slow controlled squats, bending her knees and rising, arms stretched forward, concentrated effort on her face.
The slim Asian trainer stands beside her facing the camera, gesturing warmly while speaking.
Static medium-wide shot, natural daylight, candid atmosphere.
The trainer speaks in a clear encouraging voice: "You do not need to spend hours sweating to transform your shape by summer."
Soft gym ambient sounds, quiet footsteps on wooden floor.`,
    images: [scene1],
  },
  model: KLING,
  duration: 6, // kling-v3: integer 3..15s
  audio: "native", // ← NEW (Этап 2а)
});

const vid2 = Video({
  prompt: {
    text: `Same gym with huge windows. The older grey-haired woman stands still with her back to the camera, full body visible.
The slim Asian trainer crouches beside her on the left, pointing toward the woman's hips, looking at the camera while speaking.
Subtle natural movement, the trainer's hand gestures as she talks.
Static camera, full-body framing.
The trainer says matter-of-factly: "If your booty looks like this."
Soft gym ambient sounds.`,
    images: [scene2],
  },
  model: KLING,
  duration: 4,
  audio: "native",
});

const vid3 = Video({
  prompt: {
    text: `Same gym with huge windows. Front-facing full-body shot.
The older grey-haired woman stands facing the camera with a neutral stoic expression, standing still, her bare belly visible.
The slim Asian trainer stands beside her, slightly crouched, gesturing with an open hand toward the woman's midsection while looking at the camera.
Static camera, natural daylight.
The trainer says: "If your belly looks like this."
Soft gym ambient sounds.`,
    images: [scene3],
  },
  model: KLING,
  duration: 4,
  audio: "native",
});

const vid4 = Video({
  prompt: {
    text: `Same gym, tight close-up on both women's upper bodies.
The older grey-haired woman holds her arm raised out to the side, soft upper arm visible, standing still.
The slim Asian trainer points at the raised arm, then looks directly into the camera speaking with confident energy.
Static intimate close-up framing.
The trainer says clearly and confidently: "If your arms look like this. Simply join our beginner Tai Chi Challenge this Monday, July 27th."
Soft gym ambient, the trainer's voice is clear and motivating.`,
    images: [scene4],
  },
  model: KLING,
  duration: 7,
  audio: "native",
});

const vid5 = Video({
  prompt: {
    text: `Same gym with huge windows, medium-wide shot.
The older grey-haired woman rises up from a squat and stands tall, breaking into a big proud smile, raising her arms slightly in triumph.
The slim Asian trainer beside her laughs warmly, gives her a thumbs-up, both women genuinely happy and celebrating.
Static camera, bright natural daylight, joyful energy.
The trainer says with conviction: "Forget the diets and cardio to get a beautifully toned body in exactly 28 days."
Happy laughter, soft gym ambient sounds.`,
    images: [scene5],
  },
  model: KLING,
  duration: 6,
  audio: "native",
});

const scenes = [
  ["squat-intro", vid1],
  ["booty", vid2],
  ["belly", vid3],
  ["arms-cta", vid4],
  ["celebration", vid5],
] as const;

// ── Async component: generation AND math both run under the resolver ─────
// (way B from the plan — no top-level await, the renderer sees the full
// graph before anything generates; preview/--dry-run/compile() all work)
//
// One component replaces FIVE hand-measured cutFrom/cutTo pairs from ep2:
//   <Clip cutFrom={0.2} cutTo={5.6}> <Clip cutFrom={0.2} cutTo={2.9}> ...
// Each of those numbers was a manual ffmpeg-silencedetect session.
// VideoElement is the named element type the refactor exports — no more
// `ReturnType<typeof Video>` acrobatics in user code.
async function DialogueClip({ vid }: { vid: VideoElement }) {
  // vid.audio — AudioElement, a lazy derived node (ffmpeg -vn behind the
  // scenes, shared ops layer, cached). Speech elements return the same
  // AudioElement type, so Captions/Music/mixing treat them uniformly.
  const audio = vid.audio; // ← NEW (Этап 2а)

  // speechRange() — "when is the trainer actually speaking inside the clip?"
  // as a graph op instead of a hand-run ffmpeg command. Two related ops:
  //   audio.range(options?: SilenceDetectOptions) — non-silent audio range
  //   audio.speechRange({ pad })                  — spoken-word range,
  //                                                 returns TimeRange | null
  // speechRange can return null (clip with no detectable speech), so fall
  // back to the whole clip instead of crashing the graph.
  const r = await audio.speechRange({ pad: 0.15 }); // ← NEW
  const { start, end } = r ?? { start: 0, end: audio.duration };

  // Keep ~0.3s of lead-in so the gesture that precedes the line survives,
  // but never rewind past 0. This is the dynamic pacing that took the ep2
  // edit from 27s of raw clips down to a 22.4s cut — measured by hand there.
  const from = Math.max(0, start - 0.3);
  return (
    <Clip cutFrom={from} cutTo={end} duration={end - from}>
      {vid}
    </Clip>
  );
}

// ── Composition ──────────────────────────────────────────────────────────
// Captions with NO src: the default is "caption everything audible on the
// timeline". The composer already knows every clip, its trim and its
// offset — word timings land right without any hand-wired mapping, and a
// trim change never invalidates an SRT. `src` stays only as an override
// (one specific audio / speech / SRT). This replaces the 230-line inline
// SRT block (plus the /tmp/*.srt top-level-await hack) in
// formula-care-ep2-cloud.tsx.
//
// Music with NO duration: the default is "resolve to the final timeline
// length, integer seconds". Kills two bugs at once — the 22.4s → 422
// int_from_float class, and today's gotcha where a missing duration makes
// ElevenLabs generate ~60s and stretch the video.
export default (
  <Render width={1080} height={1920} fps={30}>
    {scenes.map(([name, vid]) => (
      <DialogueClip key={name} vid={vid} />
    ))}

    <Captions
      style="tiktok"
      position="center"
      color="#ffffff"
      activeColor="#a3e635"
      wordsPerLine={3}
      fontSize={64}
    />

    <Music
      prompt="Upbeat gentle background fitness music, soft piano and light percussion, positive uplifting mood, energetic but not overwhelming"
      model={varg.musicModel("music_v1")}
      volume={0.1}
      ducking
    />
  </Render>
);

// ═══════════════════════════════════════════════════════════════════════════
// What changed vs today's ep2 template, node by node:
//
//   today (2 passes, manual)              target (1 pass, graph)
//   ─────────────────────────            ─────────────────────────
//   ffmpeg -vn output.mp4 audio.mp3   →  vid.audio           (derived node)
//   ffmpeg silencedetect ×5 + eyeball →  vid.audio.speechRange() (derived)
//   curl /v2/transcription + SRT file →  Captions w/o src (timeline audio)
//   5× hardcoded cutFrom/cutTo pairs  →  computed in <DialogueClip>
//   58-cue inline SRT + /tmp hack     →  gone (derived from the graph)
//   Music duration hand-rounded int   →  Music w/o duration (timeline len)
//   keepAudio+generate_audio mismatch →  audio:"native"
//
// Cache: every derived node keys off its parent's cache key + op params,
// so re-renders after a prompt tweak only re-run the affected branch.
// Determinism: no Math.random/Date.now anywhere — same inputs, same graph.
// ═══════════════════════════════════════════════════════════════════════════
