/**
 * Enhance Video Comparison — all 4 video upscale models
 *
 * Run with: bun run src/react/examples/enhance-video-comparison.tsx
 *
 * Upscales a source video with all 4 video upscale models in parallel,
 * then composes a comparison video showing each result sequentially.
 *
 * Uses the Video() element with prompt: { video: "url" } for v2v upscaling
 * (requires the resolve.ts v2v support fix).
 *
 * Requires FAL_KEY or FAL_API_KEY in environment.
 */
/** @jsxImportSource vargai */

import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Render, render, Title, Video } from "..";

// Short sample video — low-res input for upscaling
const SOURCE_VIDEO =
  "https://storage.googleapis.com/falserverless/example_inputs/seedvr-input.mp4";

const VIDEO_UPSCALE_MODELS: Array<{
  id: string;
  label: string;
  bestFor: string;
  providerOptions: SharedV3ProviderOptions;
}> = [
  {
    id: "seedvr-video",
    label: "SeedVR2",
    bestFor: "Skin, temporal consistency",
    providerOptions: {
      fal: { upscale_factor: 2, noise_scale: 0.1 },
    },
  },
  {
    id: "topaz-video",
    label: "Topaz",
    bestFor: "Sharpness, fur/texture",
    providerOptions: {
      fal: { upscale_factor: 2, model: "Proteus" },
    },
  },
  {
    id: "bytedance-upscaler",
    label: "Bytedance",
    bestFor: "Motion, particles",
    providerOptions: {
      fal: {
        target_resolution: "1080p",
        enhancement_preset: "aigc",
        enhancement_tier: "standard",
      },
    },
  },
  {
    id: "sima-video-upscaler",
    label: "SimaLabs",
    bestFor: "Balanced, fast",
    providerOptions: { fal: { crf: 18 } },
  },
];

async function main() {
  console.log("Enhance Video Comparison - 4 upscale models\n");
  console.log(`Source: ${SOURCE_VIDEO}\n`);

  const { mkdir } = await import("node:fs/promises");
  await mkdir("output", { recursive: true });

  // Run all video upscale models in parallel
  console.log("Starting all 4 video upscale models in parallel...\n");

  const upscaledVideos = await Promise.all(
    VIDEO_UPSCALE_MODELS.map(async (m) => {
      console.log(`  [${m.id}] starting...`);
      const start = Date.now();
      const vid = await Video({
        prompt: { video: SOURCE_VIDEO },
        model: fal.videoModel(m.id),
        providerOptions: m.providerOptions,
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  [${m.id}] done in ${elapsed}s — ${vid.file.url}`);
      return { ...m, element: vid };
    }),
  );

  console.log("\nAll models complete. Composing comparison video...\n");

  // Build clips: original first, then each upscaled version
  const originalClip = (
    <Clip duration={5}>
      <Video src={SOURCE_VIDEO} />
      <Title position="bottom" color="#ffffff">
        Original (low-res input)
      </Title>
    </Clip>
  );

  const upscaledClips = upscaledVideos.map(
    ({ id, label, bestFor, element }) => (
      <Clip key={id} duration={5} transition={{ name: "fade", duration: 0.5 }}>
        <Video src={element.file.url!} />
        <Title position="bottom" color="#ffffff">
          {`${label} — ${bestFor}`}
        </Title>
      </Clip>
    ),
  );

  const video = (
    <Render width={1920} height={1080}>
      {originalClip}
      {upscaledClips}
    </Render>
  );

  await render(video, {
    output: "output/enhance-video-comparison.mp4",
    cache: ".cache/ai",
  });

  console.log("\nDone! Output: output/enhance-video-comparison.mp4");
}

main().catch(console.error);
