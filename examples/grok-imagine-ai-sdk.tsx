/**
 * Grok Imagine Video - AI SDK Provider Test
 *
 * Run with: bun run examples/grok-imagine-ai-sdk.tsx
 *
 * Tests the Grok Imagine Video model via the AI-SDK interface
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fal } from "../src/ai-sdk/providers/fal";

async function testGrokTextToVideo() {
  console.log("\n=== Grok Text-to-Video (AI-SDK) ===\n");

  const model = fal.videoModel("grok-imagine");

  const result = await model.doGenerate({
    prompt:
      "A futuristic city at night with neon lights reflecting on wet streets, flying cars passing by, cyberpunk aesthetic",
    n: 1,
    duration: 6,
    aspectRatio: "16:9",
    resolution: undefined,
    fps: undefined,
    seed: undefined,
    files: undefined,
    providerOptions: {
      fal: {
        resolution: "720p",
      },
    },
  });

  console.log("Warnings:", result.warnings);
  console.log("Response:", {
    timestamp: result.response.timestamp,
    modelId: result.response.modelId,
  });

  // Save the video
  const outputPath = join(import.meta.dir, "../output/grok-t2v-test.mp4");
  await writeFile(outputPath, result.videos[0]!);
  console.log(`Video saved to: ${outputPath}`);

  return outputPath;
}

async function testGrokImageToVideo() {
  console.log("\n=== Grok Image-to-Video (AI-SDK) ===\n");

  const model = fal.videoModel("grok-imagine");

  // Fetch a sample image
  const imageUrl =
    "https://v3b.fal.media/files/b/0a8b90e0/BFLE9VDlZqsryU-UA3BoD_image_004.png";
  const imageResponse = await fetch(imageUrl);
  const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());

  const result = await model.doGenerate({
    prompt:
      "The knight slowly raises their sword, preparing for battle, dramatic lighting",
    n: 1,
    duration: 6,
    aspectRatio: "16:9",
    resolution: undefined,
    fps: undefined,
    seed: undefined,
    files: [
      {
        type: "file",
        data: imageBuffer,
        mediaType: "image/png",
      },
    ],
    providerOptions: {
      fal: {
        resolution: "720p",
      },
    },
  });

  console.log("Warnings:", result.warnings);
  console.log("Response:", {
    timestamp: result.response.timestamp,
    modelId: result.response.modelId,
  });

  // Save the video
  const outputPath = join(import.meta.dir, "../output/grok-i2v-test.mp4");
  await writeFile(outputPath, result.videos[0]!);
  console.log(`Video saved to: ${outputPath}`);

  return outputPath;
}

async function testGrokEditVideo() {
  console.log("\n=== Grok Edit Video (AI-SDK) ===\n");

  const model = fal.videoModel("grok-imagine-edit");

  // Use a sample video
  const videoUrl =
    "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4";
  const videoResponse = await fetch(videoUrl);
  const videoBuffer = new Uint8Array(await videoResponse.arrayBuffer());

  const result = await model.doGenerate({
    prompt:
      "Transform the scene into a watercolor painting style with soft pastel colors",
    n: 1,
    duration: undefined,
    aspectRatio: undefined,
    resolution: undefined,
    fps: undefined,
    seed: undefined,
    files: [
      {
        type: "file",
        data: videoBuffer,
        mediaType: "video/mp4",
      },
    ],
    providerOptions: {
      fal: {
        resolution: "720p",
      },
    },
  });

  console.log("Warnings:", result.warnings);
  console.log("Response:", {
    timestamp: result.response.timestamp,
    modelId: result.response.modelId,
  });

  // Save the video
  const outputPath = join(import.meta.dir, "../output/grok-edit-test.mp4");
  await writeFile(outputPath, result.videos[0]!);
  console.log(`Video saved to: ${outputPath}`);

  return outputPath;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "t2v";

  console.log("Grok Imagine Video - AI SDK Test");
  console.log("=================================");
  console.log(`Mode: ${mode}`);

  // Ensure output directory exists
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(import.meta.dir, "../output"), { recursive: true });

  try {
    switch (mode) {
      case "t2v":
        await testGrokTextToVideo();
        break;

      case "i2v":
        await testGrokImageToVideo();
        break;

      case "edit":
        await testGrokEditVideo();
        break;

      case "all":
        await testGrokTextToVideo();
        await testGrokImageToVideo();
        await testGrokEditVideo();
        break;

      default:
        console.log(`
Usage: bun run examples/grok-imagine-ai-sdk.tsx [mode]

Modes:
  t2v     Text-to-Video generation
  i2v     Image-to-Video generation  
  edit    Video editing
  all     Run all tests

Examples:
  bun run examples/grok-imagine-ai-sdk.tsx t2v
  bun run examples/grok-imagine-ai-sdk.tsx all
`);
    }

    console.log("\nTest completed!");
  } catch (error) {
    console.error("\nTest failed:", error);
    process.exit(1);
  }
}

main();
