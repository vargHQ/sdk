/**
 * Enhance Pipeline — generate image -> upscale -> animate to video
 *
 * Run with: bun run src/react/examples/enhance-pipeline.tsx
 *
 * Demonstrates the full pipeline:
 *   1. Generate a portrait with flux-schnell
 *   2. Upscale it with seedvr (best for realistic skin)
 *   3. Animate the upscaled image into a video with kling-v3
 *
 * Output: 3-clip comparison showing each stage.
 *
 * Requires FAL_KEY or FAL_API_KEY in environment.
 */
/** @jsxImportSource vargai */

import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render, render, Split, Title, Video } from "..";

async function main() {
  console.log("Enhance Pipeline: generate -> upscale -> video\n");

  const { mkdir } = await import("node:fs/promises");
  await mkdir("output", { recursive: true });

  // Step 1: Generate a portrait
  console.log("[1/3] Generating portrait with flux-schnell...");
  const generated = await Image({
    prompt:
      "close-up portrait of a young woman with freckles, natural lighting, shallow depth of field, 35mm film grain",
    model: fal.imageModel("flux-schnell"),
    aspectRatio: "9:16",
  });
  console.log(`  Generated: ${generated.file.url}`);

  // Step 2: Upscale with seedvr (best for realistic skin)
  console.log("[2/3] Upscaling with SeedVR2...");
  const upscaled = await Image({
    prompt: { images: [generated] },
    model: fal.imageModel("seedvr"),
    providerOptions: {
      fal: { upscale_factor: 2, noise_scale: 0.1 },
    },
  });
  console.log(`  Upscaled: ${upscaled.file.url}`);

  // Step 3: Animate the upscaled image into a video
  console.log("[3/3] Animating upscaled image with kling-v3...");
  const animated = await Video({
    prompt: {
      text: "the woman slowly turns her head and smiles, hair gently moves in the breeze, cinematic",
      images: [upscaled],
    },
    model: fal.videoModel("kling-v3"),
    providerOptions: {
      fal: { duration: "5" },
    },
  });
  console.log(`  Video: ${animated.file.url}`);

  // Compose comparison: 3 stages side by side
  console.log("\nComposing comparison video...");

  const video = (
    <Render width={1080} height={1920}>
      {/* Stage 1: Generated image */}
      <Clip duration={3}>
        <Image src={generated.file.url!} />
        <Title position="bottom" color="#ffffff">
          1. Generated (flux-schnell)
        </Title>
      </Clip>

      {/* Stage 2: Split — generated vs upscaled */}
      <Clip duration={4} transition={{ name: "fade", duration: 0.5 }}>
        <Split direction="horizontal">
          {[
            Image({ src: generated.file.url! }),
            Image({ src: upscaled.file.url! }),
          ]}
        </Split>
        <Title position="bottom" color="#ffffff">
          2. Original vs SeedVR2 upscale
        </Title>
      </Clip>

      {/* Stage 3: Video from upscaled image */}
      <Clip duration={5} transition={{ name: "fade", duration: 0.5 }}>
        <Video src={animated.file.url!} />
        <Title position="bottom" color="#ffffff">
          3. Animated (kling-v3 from upscaled)
        </Title>
      </Clip>
    </Render>
  );

  await render(video, {
    output: "output/enhance-pipeline.mp4",
    cache: ".cache/ai",
  });

  console.log("\nDone! Output: output/enhance-pipeline.mp4");
}

main().catch(console.error);
