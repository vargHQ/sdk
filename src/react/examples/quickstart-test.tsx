/**
 * Quickstart Test - Verification script for video generation setup
 *
 * This minimal test confirms your FAL_API_KEY is working correctly.
 * It generates a simple 3-second animated image.
 *
 * Run: bun run src/react/examples/quickstart-test.tsx
 * Output: output/quickstart-test.mp4
 */

import { fal } from "../../ai-sdk/providers/fal";
import { Clip, Image, Render, render, Video } from "..";

async function main() {
  console.log("=== Varg Video Generation - Setup Verification ===\n");

  // Check for FAL_API_KEY
  if (!process.env.FAL_API_KEY) {
    console.error("ERROR: FAL_API_KEY not found in environment");
    console.error("\nTo fix this:");
    console.error("1. Get an API key at: https://fal.ai/dashboard/keys");
    console.error("2. Add to .env file: FAL_API_KEY=fal_xxxxx");
    console.error("3. Run this test again");
    process.exit(1);
  }

  console.log("FAL_API_KEY found");

  // Check for optional keys
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY;
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
  const hasGroq = !!process.env.GROQ_API_KEY;

  console.log("\nOptional keys:");
  console.log(
    `  ELEVENLABS_API_KEY: ${hasElevenLabs ? "found" : "not found (music/voice unavailable)"}`,
  );
  console.log(
    `  REPLICATE_API_TOKEN: ${hasReplicate ? "found" : "not found (lipsync unavailable)"}`,
  );
  console.log(
    `  GROQ_API_KEY: ${hasGroq ? "found" : "not found (transcription unavailable)"}`,
  );

  console.log("\n--- Running verification test ---\n");
  console.log("Generating a simple 3-second animation...");
  console.log("This may take 30-60 seconds on first run.\n");

  const video = (
    <Render width={720} height={720}>
      <Clip duration={3}>
        <Video
          prompt={{
            text: "robot waves hello, friendly gesture, slight head tilt",
            images: [
              Image({
                prompt:
                  "a friendly robot waving hello, simple cartoon style, blue and white colors, clean background",
                model: fal.imageModel("flux-schnell"),
                aspectRatio: "1:1",
              }),
            ],
          }}
          model={fal.videoModel("wan-2.5")}
        />
      </Clip>
    </Render>
  );

  try {
    const buffer = await render(video, {
      output: "output/quickstart-test.mp4",
      cache: ".cache/ai",
    });

    console.log("\n=== SUCCESS ===");
    console.log(
      `Output: output/quickstart-test.mp4 (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`,
    );
    console.log("\nYour setup is working! You can now:");
    console.log("1. Try the templates in .claude/skills/video-generation.md");
    console.log(
      "2. Run existing examples: bun run src/react/examples/madi.tsx",
    );
    console.log("3. Create your own videos using the React engine");
  } catch (error) {
    console.error("\n=== VERIFICATION FAILED ===");
    console.error("Error:", error instanceof Error ? error.message : error);
    console.error("\nCommon fixes:");
    console.error("- Check FAL_API_KEY is correct (no extra spaces)");
    console.error("- Ensure you have credits at fal.ai");
    console.error("- Try running: bun install");
    process.exit(1);
  }
}

main();
