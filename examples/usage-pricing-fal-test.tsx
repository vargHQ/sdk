/** @jsxImportSource vargai */
/**
 * Usage + Pricing Manual Test (fal.ai)
 *
 * Run with:
 *   bun run examples/usage-pricing-fal-test.tsx
 *
 * Requires:
 *   FAL_API_KEY
 *
 * What it does:
 *   1) Text-to-image (flux-schnell)
 *   2) Image edit (edit model)
 *   3) Image-to-video (wan-2.5)
 *
 * This is a manual test. It should print a usage summary after render.
 */

import { fal } from "../src/ai-sdk";
import { Clip, Image, Render, render, Video } from "../src/react";

const apiKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
if (!apiKey) {
  console.error("Error: FAL_API_KEY or FAL_KEY environment variable required");
  process.exit(1);
}

const IMAGE_MODEL = "flux-schnell";
const EDIT_MODEL = process.env.FAL_EDIT_MODEL ?? "fal-ai/flux/dev";
const VIDEO_MODEL = "wan-2.5";

async function main() {
  console.log("Usage + Pricing Manual Test (fal.ai)");
  console.log("===================================");
  console.log(`Image model: ${IMAGE_MODEL}`);
  console.log(`Edit model:  ${EDIT_MODEL}`);
  console.log(`Video model: ${VIDEO_MODEL}`);

  const baseImage = Image({
    prompt: "an image of a dog",
    model: fal.imageModel(IMAGE_MODEL),
    aspectRatio: "16:9",
  });

  const editedImage = Image({
    prompt: {
      text: "same image, but dog with sunglasses",
      images: [baseImage],
    },
    model: fal.imageModel(EDIT_MODEL),
    aspectRatio: "16:9",
  });

  const video = (
    <Render width={1280} height={720}>
      <Clip duration={5}>
        <Video
          prompt={{
            text: "a slow camera push-in, showing the dog's face and body in detail",
            images: [editedImage],
          }}
          model={fal.videoModel(VIDEO_MODEL)}
          duration={5}
        />
      </Clip>
    </Render>
  );

  await render(video, {
    output: "output/usage-pricing-fal-test.mp4",
    cache: ".cache/ai",
    usage: { enabled: true, dir: ".cache/usage" },
  });

  console.log("\nDone. Check output/usage-pricing-fal-test.mp4");
  console.log("Use `varg usage` to view usage totals.");
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
