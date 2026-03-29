/**
 * Enhance Image Comparison — all 7 image upscale models side by side
 *
 * Run with: bun run src/react/examples/enhance-image-comparison.tsx
 *
 * Generates a comparison video with Split layout:
 *   Original (left) | Upscaled (right)
 * for each of the 7 image upscale models, concatenated with transitions.
 *
 * Requires FAL_KEY or FAL_API_KEY in environment.
 */
/** @jsxImportSource vargai */

import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render, render, Split, Title } from "..";

// Low-res portrait — good for testing skin/face upscalers
const SOURCE_IMAGE =
  "https://storage.googleapis.com/falserverless/model_tests/codeformer/codeformer_poor_1.jpeg";

import type { SharedV3ProviderOptions } from "@ai-sdk/provider";

const IMAGE_UPSCALE_MODELS: Array<{
  id: string;
  label: string;
  bestFor: string;
  providerOptions: SharedV3ProviderOptions;
}> = [
  {
    id: "seedvr",
    label: "SeedVR2",
    bestFor: "Skin pores, realism",
    providerOptions: { fal: { upscale_factor: 2, noise_scale: 0.1 } },
  },
  {
    id: "recraft-clarity",
    label: "Recraft Clarity",
    bestFor: "Freckles, faces",
    providerOptions: { fal: {} },
  },
  {
    id: "clarity-upscaler",
    label: "Clarity Upscaler",
    bestFor: "High fidelity",
    providerOptions: { fal: { upscale_factor: 2 } },
  },
  {
    id: "topaz",
    label: "Topaz",
    bestFor: "General sharpness",
    providerOptions: { fal: { upscale_factor: 2, model: "Standard V2" } },
  },
  {
    id: "sima-upscaler",
    label: "SimaLabs",
    bestFor: "Fast, balanced",
    providerOptions: { fal: { scale: 4 } },
  },
  {
    id: "ccsr",
    label: "CCSR",
    bestFor: "Super-resolution",
    providerOptions: { fal: { scale: 2 } },
  },
  {
    id: "aura-sr",
    label: "AuraSR v2",
    bestFor: "Tile-based detail",
    providerOptions: { fal: { upscale_factor: 4, checkpoint: "v2" } },
  },
];

async function main() {
  console.log("Enhance Image Comparison - 7 upscale models\n");
  console.log(`Source: ${SOURCE_IMAGE}\n`);

  const { mkdir } = await import("node:fs/promises");
  await mkdir("output", { recursive: true });

  const original = Image({ src: SOURCE_IMAGE });

  // Run all upscale models in parallel
  console.log("Starting all 7 image upscale models in parallel...\n");

  const upscaledImages = await Promise.all(
    IMAGE_UPSCALE_MODELS.map(async (m) => {
      console.log(`  [${m.id}] starting...`);
      const start = Date.now();
      const img = await Image({
        prompt: { images: [SOURCE_IMAGE] },
        model: fal.imageModel(m.id),
        providerOptions: m.providerOptions,
      });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  [${m.id}] done in ${elapsed}s`);
      return { ...m, element: img };
    }),
  );

  console.log("\nAll models complete. Composing comparison video...\n");

  // Build clips: each shows original (left) vs upscaled (right) with model name
  const clips = upscaledImages.map(({ id, label, bestFor, element }) => (
    <Clip key={id} duration={4} transition={{ name: "fade", duration: 0.5 }}>
      <Split direction="horizontal">
        {[original, Image({ src: element.file.url! })]}
      </Split>
      <Title position="bottom" color="#ffffff">
        {`${label} — ${bestFor}`}
      </Title>
    </Clip>
  ));

  // Opening clip with just the original
  const intro = (
    <Clip duration={3}>
      {original}
      <Title position="bottom" color="#ffffff">
        Original (low-res input)
      </Title>
    </Clip>
  );

  const video = (
    <Render width={1920} height={1080}>
      {intro}
      {clips}
    </Render>
  );

  await render(video, {
    output: "output/enhance-image-comparison.mp4",
    cache: ".cache/ai",
  });

  console.log("\nDone! Output: output/enhance-image-comparison.mp4");
}

main().catch(console.error);
