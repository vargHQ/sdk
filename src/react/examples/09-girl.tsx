import { fal } from "vargai/ai";
import { Clip, Image, Render, Video } from "vargai/react";

// ============ REFERENCES ============

const WOMAN_REF =
  "https://s3.varg.ai/uploads/images/tlhzlrio6janrkhrwd29h-qp3ofcnoqv0-m4z6gr_280fee62.png";
const VARG_PATTERN =
  "https://s3.varg.ai/uploads/images/varg-pattern_631fa5f2.png";

// ============ CONFIG ============

const OUTFIT =
  "elegant black dress with bold geometric pattern — fitted silhouette, off-shoulder neckline, knee-length, subtle sheen";

const characterBase = `Same girl from reference, consistent face and body proportions, same hairstyle, same skin tone, same body type.`;

const location = `Elegant apartment with full-length mirror, warm ambient lighting, minimalist modern decor, soft evening glow through sheer curtains, neutral tones`;

// ============ STEP 1: BASE CHARACTER IN WHITE ============

const baseCharacter = Image({
  prompt: {
    text: `${characterBase}. She's taking a mirror selfie wearing a simple white cocktail dress. Standing in ${location}. Phone held up. Confident poised pose, weight on one hip. Full body visible in mirror reflection.`,
    images: [WOMAN_REF],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// ============ STEP 2: EXTRACT BACKGROUND ============

const background = Image({
  prompt: {
    text: `Remove the character completely from the image. Empty elegant apartment with full-length mirror, same lighting, same composition. No person.`,
    images: [baseCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// ============ STEP 3: RECOLOR TO BLACK DRESS ============

const blackDressChar = Image({
  prompt: {
    text: `Change the dress to ${OUTFIT}. Keep everything else exactly the same — same woman, same face, same pose, same lighting, same background.`,
    images: [baseCharacter, background],
  },
  model: fal.imageModel("seedream-v4.5/edit"),
  aspectRatio: "9:16",
});

// ============ STEP 4: ADD PATTERN TO DRESS ============

const patternDressChar = Image({
  prompt: {
    text: `Add the geometric pattern from the second image onto the black dress. The pattern should cover the dress fabric naturally. Keep everything else exactly the same — same woman, same face, same pose, same lighting, same background.`,
    images: [blackDressChar, VARG_PATTERN],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// ============ STEP 5: POSE VARIATIONS ============
// IMPORTANT: patternDressChar is the first reference - use EXACTLY the same dress pattern from it

// Pose 2: Adjusting earring — close to mirror (similar to ref pose)
const pose2_earring = Image({
  prompt: {
    text: `${characterBase}. Wearing EXACTLY the same black dress with IDENTICAL geometric pattern as shown in the first reference image. The pattern must match perfectly - same colors, same shapes, same placement on the fabric. Mirror selfie in ${location}. Standing close to mirror, one hand adjusting earring, other holding phone. Soft smile, chin slightly lifted. Full body in reflection. Elegant posture. Keep the dress pattern 100% consistent with first reference.`,
    images: [patternDressChar, VARG_PATTERN, WOMAN_REF],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Pose 3: Side angle — showing silhouette (similar to ref pose)
const pose3_side = Image({
  prompt: {
    text: `${characterBase}. Wearing EXACTLY the same black dress with IDENTICAL geometric pattern as shown in the first reference image. The pattern must match perfectly - same colors, same shapes, same placement on the fabric. Mirror selfie in ${location}. Standing at three-quarter angle to mirror, looking over shoulder at phone. Shows elegant silhouette and dress drape. Confident smile. Hand on hip. Keep the dress pattern 100% consistent with first reference.`,
    images: [patternDressChar, VARG_PATTERN, WOMAN_REF],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// Pose 4: Back angle — showing dress back (similar to ref pose)
const pose4_back = Image({
  prompt: {
    text: `${characterBase}. Wearing EXACTLY the same black dress with IDENTICAL geometric pattern as shown in the first reference image. The pattern must match perfectly - same colors, same shapes, same placement on the fabric. Mirror selfie in ${location}. Back to mirror, looking over shoulder at phone with classy expression. Dress drapes beautifully. One foot slightly forward. Keep the dress pattern 100% consistent with first reference.`,
    images: [patternDressChar, VARG_PATTERN, WOMAN_REF],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

// ============ MOTION PROMPTS ============

const motion1 = `Takes mirror selfie, shifts weight gracefully. Smooths dress with free hand. Tilts head finding best angle. Soft smile, taps phone. Confident elegant energy.`;

const motion2 = `Standing close to mirror, adjusts earring. Touches hair, fixes strand behind ear. Lifts chin, takes pic. Checks phone, satisfied nod.`;

const motion3 = `Slightly turns to show side profile. Hand on hip, elongates posture. Looks over shoulder at mirror. Playful confident smile. Snaps pic.`;

const motion4 = `Shows back to mirror, looks over shoulder elegantly. Slight sway, shows off dress back detail. Classy expression, subtle smile. Takes pic. Happy with result.`;

// ============ VIDEOS ============

const vid1 = Video({
  prompt: {
    images: [patternDressChar],
    text: motion1,
  },
  model: fal.videoModel("kling-v2.5"),
});

const vid2 = Video({
  prompt: {
    images: [pose2_earring],
    text: motion2,
  },
  model: fal.videoModel("kling-v2.5"),
});

const vid3 = Video({
  prompt: {
    images: [pose3_side],
    text: motion3,
  },
  model: fal.videoModel("kling-v2.5"),
});

const vid4 = Video({
  prompt: {
    images: [pose4_back],
    text: motion4,
  },
  model: fal.videoModel("kling-v2.5"),
});

// ============ FINAL RENDER ============

export default (
  <Render width={1080} height={1920}>
    {/* Front pose — finding angle */}
    <Clip cutFrom={0.5} cutTo={3}>
      {vid1}
    </Clip>

    {/* Earring adjust — close-up vibes */}
    <Clip cutFrom={0.5} cutTo={2.5}>
      {vid2}
    </Clip>

    {/* Side — shows silhouette */}
    <Clip cutFrom={0.5} cutTo={2.5}>
      {vid3}
    </Clip>

    {/* Back — elegant reveal */}
    <Clip cutFrom={0.5} cutTo={3}>
      {vid4}
    </Clip>
  </Render>
);
