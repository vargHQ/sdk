/**
 * OnlyFans-style selfie video workflow (React DSL)
 *
 * 1. Generate base girl image using fal nano-banana-pro
 * 2. Edit bra color using nano-banana-pro/edit
 * 3. Generate 5 photos with different angles using nano-banana
 * 4. Animate all with prompts (step back, turn left/right)
 * 5. Concatenate into ~10 second video
 *
 * Run: bun run src/cli/index.ts render src/react/examples/onlyfans-1m/workflow.tsx -o output/onlyfans-1m.mp4
 *
 * Required env: FAL_API_KEY (or FAL_KEY)
 */

import { fal } from "vargai/ai";
import { Clip, Image, Render, Video } from "vargai/react";

// ============================================================================
// CHARACTER DEFINITION
// ============================================================================

const NEW_BRA_COLOR = "deep purple";

// Base character prompt (seedream edit requires an image input)
const baseCharacter = Image({
  prompt:
    "A beautiful Slavic woman in her late 20s with platinum blonde hair, icy blue eyes, and perfect skin. She bends very close to the phone lens, her chest framed by a white sports bra with a bold neckline, and she is wearing high-waisted athletic shorts in pale grey that accentuate her figure. Her expression is confident and slightly teasing. The background shows a modern apartment with soft daylight through large windows, reinforcing the natural homemade vibe",
  model: fal.imageModel("nano-banana-pro"),
  aspectRatio: "9:16",
});

// Recolor the bra using nano-banana
const background = Image({
  prompt: {
    text: `Remove character from the image`,
    images: [baseCharacter],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const newBraCharacter = Image({
  prompt: {
    text: `Change the sports bra colour to ${NEW_BRA_COLOR}. Keep everything else exactly the same - same woman, same pose, same lighting, same background.`,
    images: [baseCharacter, background],
  },
  model: fal.imageModel("seedream-v4.5/edit"),
  aspectRatio: "9:16",
});

const newAngleCharacter = Image({
  prompt: {
    text: `Slightly change the pose of the character, keeping the same pose, lighting, and background. Put the character two steps aways from the`,
    images: [newBraCharacter, background],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const motionLeft = `A woman in stylish ${NEW_BRA_COLOR} sportswear takes a selfie. She starts very close to camera showing face and decolletage, then steps back to reveal more of her body. She turns slightly to the LEFT to show her figure in profile. Warm daylight, authentic homemade video feel. Camera static.`;

export default (
  <Render width={1080} height={1920}>
    {/* Clip 1: Left angle, turns left */}
    <Clip duration={3}>
      <Video
        prompt={{
          images: [newBraCharacter],
          text: motionLeft,
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>

    <Clip duration={3}>
      <Video
        prompt={{
          images: [newAngleCharacter],
          text: motionLeft,
        }}
        model={fal.videoModel("kling-v2.5")}
      />
    </Clip>
  </Render>
);
