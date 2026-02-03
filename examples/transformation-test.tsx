/**
 * Transformation Video Test - Tests Rendi/R2/Local backends
 *
 * Run with:
 *   bun run examples/transformation-test.tsx local    # Local FFmpeg backend
 *   bun run examples/transformation-test.tsx rendi    # Rendi cloud + R2 storage
 *   bun run examples/transformation-test.tsx preview  # Preview mode (placeholders)
 */

import {
  createRendiBackend,
  elevenlabs,
  fal,
  higgsfield,
  localBackend,
  r2Storage,
} from "../src/ai-sdk";
import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  render,
  Speech,
  SplitLayout,
  Title,
  Video,
} from "../src/react";

const CHARACTER = "woman in her 30s, brown hair, green eyes";
const SCENE =
  "bathroom mirror selfie, iPhone photo quality, photorealistic, 8k";

const beforeImage = Image({
  prompt: `${CHARACTER}, overweight, puffy face, tired expression, loose grey t-shirt, ${SCENE}`,
  model: higgsfield.imageModel("soul", {
    styleId: higgsfield.styles.REALISTIC,
  }),
  aspectRatio: "9:16",
});

const afterImage = Image({
  prompt: {
    text: `${CHARACTER}, fit slim, confident smile, fitted black tank top, ${SCENE}`,
    images: [beforeImage],
  },
  model: fal.imageModel("nano-banana-pro/edit"),
  aspectRatio: "9:16",
});

const beforeVideo = Video({
  prompt: {
    text: "woman looks down sadly, sighs, tired expression",
    images: [beforeImage],
  },
  model: fal.videoModel("kling-v2.5"),
  duration: 5,
});

const afterVideo = Video({
  prompt: {
    text: "woman smiles confidently, touches hair, proud look",
    images: [afterImage],
  },
  model: fal.videoModel("kling-v2.5"),
  duration: 5,
});

const voiceover = Speech({
  model: elevenlabs.speechModel("eleven_multilingual_v2"),
  voice: "aMSt68OGf4xUZAnLpTU8",
  children: "With this technique I lost 40 pounds in just 3 months!",
});

const videoElement = (
  <Render width={1080 * 2} height={1920}>
    <Music
      prompt="upbeat motivational pop, inspiring transformation"
      model={elevenlabs.musicModel()}
    />
    <Clip duration={5}>
      <SplitLayout
        direction="horizontal"
        left={beforeVideo}
        right={afterVideo}
      />
      <Title position="top" color="#ffffff">
        My 3-Month Transformation
      </Title>
    </Clip>
    <Captions src={voiceover} style="tiktok" color="#ffffff" />
  </Render>
);

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "local";

  console.log("Transformation Video Test");
  console.log("=========================");
  console.log(`Mode: ${mode}\n`);

  // Ensure output directory exists
  const { mkdir } = await import("node:fs/promises");
  await mkdir("output", { recursive: true });

  const timestamp = Date.now();

  try {
    switch (mode) {
      case "local": {
        console.log("Using LOCAL backend (FFmpeg on this machine)");
        const result = await render(videoElement, {
          output: `output/transformation-local-${timestamp}.mp4`,
          cache: ".cache/ai",
          backend: localBackend,
          verbose: true,
        });
        console.log(`\nOutput: output/transformation-local-${timestamp}.mp4`);
        console.log(`Size: ${(result.length / 1024 / 1024).toFixed(2)} MB`);
        break;
      }

      case "rendi": {
        console.log("Using RENDI backend (cloud FFmpeg) + R2 storage");
        const backend = createRendiBackend({ storage: r2Storage() });
        const result = await render(videoElement, {
          output: `output/transformation-rendi-${timestamp}.mp4`,
          cache: ".cache/ai",
          backend,
          verbose: true,
        });
        console.log(`\nOutput: output/transformation-rendi-${timestamp}.mp4`);
        console.log(`Size: ${(result.length / 1024 / 1024).toFixed(2)} MB`);
        break;
      }

      case "preview": {
        console.log("Using PREVIEW mode (placeholders for images/videos)");
        const result = await render(videoElement, {
          output: `output/transformation-preview-${timestamp}.mp4`,
          cache: ".cache/ai",
          mode: "preview",
          verbose: true,
        });
        console.log(`\nOutput: output/transformation-preview-${timestamp}.mp4`);
        console.log(`Size: ${(result.length / 1024 / 1024).toFixed(2)} MB`);
        break;
      }

      default:
        console.log(`
Usage: bun run examples/transformation-test.tsx [mode]

Modes:
  local     Use local FFmpeg backend (default)
  rendi     Use Rendi cloud backend with R2 storage
  preview   Use preview mode with placeholders

Examples:
  bun run examples/transformation-test.tsx local
  bun run examples/transformation-test.tsx rendi
  bun run examples/transformation-test.tsx preview
`);
    }

    console.log("\nTest completed!");
  } catch (error) {
    console.error("\nTest failed:", error);
    process.exit(1);
  }
}

main();
