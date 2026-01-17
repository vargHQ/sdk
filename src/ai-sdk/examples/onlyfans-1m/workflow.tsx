/**
 * OnlyFans-style selfie video workflow (React DSL)
 *
 * 1. Generate base girl image using Higgsfield Soul
 * 2. Edit bra color using nano-banana-pro/edit
 * 3. Generate 5 photos with different angles using nano-banana
 * 4. Animate all with prompts (step back, turn left/right)
 * 5. Concatenate into ~10 second video
 *
 * Run: bun run src/ai-sdk/react/cli.ts src/ai-sdk/examples/onlyfans-1m/workflow.tsx -o output/onlyfans-1m.mp4
 *
 * Required env: HIGGSFIELD_API_KEY, HIGGSFIELD_SECRET, FAL_KEY
 */

import { fal, higgsfield } from "../../index";
import { Clip, Image, Render, Video } from "../../react";

// ============================================================================
// CHARACTER DEFINITION
// ============================================================================

const NEW_BRA_COLOR = "deep purple";

// Base character prompt for Higgsfield
const baseCharacter = Image({
  prompt:
    "A stunningly beautiful South Slavic woman in her mid-20s with long, thick black hair and warm brown skin. She leans very close to the phone camera as if just pressing record, cleavage emphasized by a bright pink sports bra with a deep cut. Her big brown eyes and glossy lips dominate the frame, with a blurred cozy home interior behind her in soft daylight.",
  model: higgsfield.imageModel("soul", { quality: "1080p" }),
  aspectRatio: "9:16",
});

// Recolor the bra using nano-banana
const recoloredCharacter = Image({
  prompt: {
    text: `Change the sports bra color to ${NEW_BRA_COLOR}. Keep everything else exactly the same - same woman, same pose, same lighting, same background.`,
    images: [baseCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

// ============================================================================
// ANGLE VARIATIONS (5 different angles)
// ============================================================================

const angleLeft = Image({
  prompt: {
    text: `Same woman, close selfie angle from slightly left side, showing profile, ${NEW_BRA_COLOR} sports bra, warm home lighting, cozy interior`,
    images: [recoloredCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

const angleRight = Image({
  prompt: {
    text: `Same woman, close selfie angle from slightly right side, three-quarter view, ${NEW_BRA_COLOR} sports bra, soft daylight, cozy home`,
    images: [recoloredCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

const angleAbove = Image({
  prompt: {
    text: `Same woman, selfie from above looking up at camera, ${NEW_BRA_COLOR} sports bra, playful expression, natural lighting`,
    images: [recoloredCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

const angleStraight = Image({
  prompt: {
    text: `Same woman, straight-on close selfie, confident smile, ${NEW_BRA_COLOR} sports bra, natural lighting, home interior`,
    images: [recoloredCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

const angleDutch = Image({
  prompt: {
    text: `Same woman, slight dutch angle selfie, tilted head, ${NEW_BRA_COLOR} sports bra, cozy interior background, soft daylight`,
    images: [recoloredCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
});

// ============================================================================
// ANIMATION PROMPTS
// ============================================================================

const motionLeft = `A woman in stylish ${NEW_BRA_COLOR} sportswear takes a selfie. She starts very close to camera showing face and decolletage, then steps back to reveal more of her body. She turns slightly to the LEFT to show her figure in profile. Warm daylight, authentic homemade video feel. Camera static.`;

const motionRight = `A woman in ${NEW_BRA_COLOR} sports bra recording herself. Close-up of face and chest, then she steps backward revealing full figure, turning to the RIGHT showing her side profile. Relaxed natural movements, cozy home interior. Camera static.`;

// ============================================================================
// FINAL COMPOSITION (~10 seconds)
// ============================================================================

export default (
  <Render width={1080} height={1920}>
    {/* Clip 1: Left angle, turns left */}
    <Clip duration={5}>
      <Video
        prompt={{
          images: [angleLeft],
          text: motionLeft,
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    {/* Clip 2: Right angle, turns right */}
    <Clip duration={5} transition={{ name: "fade", duration: 0.5 }}>
      <Video
        prompt={{
          images: [angleRight],
          text: motionRight,
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);
