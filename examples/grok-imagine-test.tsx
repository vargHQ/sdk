/**
 * Grok Imagine Video Test Example
 *
 * Run with: bun run examples/grok-imagine-test.tsx
 *
 * Tests all three Grok Imagine Video endpoints:
 * 1. Text-to-Video
 * 2. Image-to-Video
 * 3. Edit Video
 */

import { fal } from "@fal-ai/client";
import { falProvider } from "../src/providers/fal";

// Configure fal client
const apiKey = process.env.FAL_API_KEY ?? process.env.FAL_KEY;
if (!apiKey) {
  console.error("Error: FAL_API_KEY or FAL_KEY environment variable required");
  process.exit(1);
}
fal.config({ credentials: apiKey });

async function testTextToVideo() {
  console.log("\n=== Testing Grok Text-to-Video ===\n");

  const result = await falProvider.grokTextToVideo({
    prompt:
      "A majestic eagle soaring through clouds at sunset, cinematic lighting, slow motion",
    duration: 6,
    aspectRatio: "16:9",
    resolution: "720p",
  });

  const data = result.data as { video?: { url?: string; duration?: number } };
  console.log("Text-to-Video Result:");
  console.log("  Video URL:", data?.video?.url);
  console.log("  Duration:", data?.video?.duration);

  return data?.video?.url;
}

async function testImageToVideo(imageUrl: string) {
  console.log("\n=== Testing Grok Image-to-Video ===\n");

  const result = await falProvider.grokImageToVideo({
    prompt:
      "The subject slowly turns their head and smiles, gentle wind blowing their hair",
    imageUrl,
    duration: 6,
    aspectRatio: "auto",
    resolution: "720p",
  });

  const data = result.data as { video?: { url?: string; duration?: number } };
  console.log("Image-to-Video Result:");
  console.log("  Video URL:", data?.video?.url);
  console.log("  Duration:", data?.video?.duration);

  return data?.video?.url;
}

async function testEditVideo(videoUrl: string) {
  console.log("\n=== Testing Grok Edit Video ===\n");

  const result = await falProvider.grokEditVideo({
    prompt: "Add a vintage film grain effect and warm color grading",
    videoUrl,
    resolution: "auto",
  });

  const data = result.data as { video?: { url?: string; duration?: number } };
  console.log("Edit Video Result:");
  console.log("  Video URL:", data?.video?.url);
  console.log("  Duration:", data?.video?.duration);

  return data?.video?.url;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "t2v";

  console.log("Grok Imagine Video Test");
  console.log("=======================");
  console.log(`Mode: ${mode}`);

  try {
    switch (mode) {
      case "t2v":
      case "text-to-video": {
        await testTextToVideo();
        break;
      }

      case "i2v":
      case "image-to-video": {
        const imageUrl =
          args[1] ||
          "https://v3b.fal.media/files/b/0a8b90e0/BFLE9VDlZqsryU-UA3BoD_image_004.png";
        await testImageToVideo(imageUrl);
        break;
      }

      case "edit":
      case "edit-video": {
        const videoUrl =
          args[1] ||
          "https://v3b.fal.media/files/b/0a8b9112/V5Z_NIPE3ppMDWivNo6_q_video_019.mp4";
        await testEditVideo(videoUrl);
        break;
      }

      case "all": {
        // Run all tests in sequence
        const t2vUrl = await testTextToVideo();

        // Use a sample image for i2v test
        const sampleImage =
          "https://v3b.fal.media/files/b/0a8b90e0/BFLE9VDlZqsryU-UA3BoD_image_004.png";
        await testImageToVideo(sampleImage);

        // Use the t2v result for edit test if available
        if (t2vUrl) {
          await testEditVideo(t2vUrl);
        }
        break;
      }

      default:
        console.log(`
Usage: bun run examples/grok-imagine-test.tsx [mode] [url]

Modes:
  t2v, text-to-video    Generate video from text prompt
  i2v, image-to-video   Generate video from image (provide image URL)
  edit, edit-video      Edit existing video (provide video URL)
  all                   Run all tests

Examples:
  bun run examples/grok-imagine-test.tsx t2v
  bun run examples/grok-imagine-test.tsx i2v https://example.com/image.png
  bun run examples/grok-imagine-test.tsx edit https://example.com/video.mp4
  bun run examples/grok-imagine-test.tsx all
`);
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("\nTest failed:", error);
    process.exit(1);
  }
}

main();
