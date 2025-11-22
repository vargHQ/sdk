#!/usr/bin/env bun

/**
 * test script for all sdk services
 * saves all media files to media/ directory
 */

import { generateImage as generateFalImage } from "./lib/ai-sdk/fal";
import { generateImage as generateReplicateImage } from "./lib/ai-sdk/replicate";
import { textToSpeech } from "./lib/elevenlabs";
import { runImage } from "./lib/replicate";

async function testFalImage() {
  console.log("\n=== testing fal image generation ===");

  const result = await generateFalImage({
    prompt: "a cozy coffee shop interior with warm lighting",
    model: "fal-ai/flux/dev",
    aspectRatio: "16:9",
  });

  if (result.image.uint8Array) {
    const filename = "media/fal-coffee-shop.png";
    await Bun.write(filename, result.image.uint8Array);
    console.log(`✓ saved to ${filename}`);
  }
}

async function testReplicateImage() {
  console.log("\n=== testing replicate image generation ===");

  const result = await generateReplicateImage({
    prompt: "a mystical forest with glowing mushrooms",
    model: "black-forest-labs/flux-dev",
    aspectRatio: "1:1",
  });

  if (result.image.uint8Array) {
    const filename = "media/replicate-forest.png";
    await Bun.write(filename, result.image.uint8Array);
    console.log(`✓ saved to ${filename}`);
  }
}

async function testReplicateClient() {
  console.log("\n=== testing replicate client (flux) ===");

  try {
    const output = await runImage({
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a serene zen garden with cherry blossoms" },
    });

    // output is array of FileOutput objects
    if (Array.isArray(output) && output[0]) {
      const imageUrl = output[0].toString();
      console.log(`✓ generated image: ${imageUrl}`);

      // download and save
      const response = await fetch(imageUrl);
      const buffer = await response.arrayBuffer();
      const filename = "media/replicate-zen-garden.png";
      await Bun.write(filename, buffer);
      console.log(`✓ saved to ${filename}`);
    }
  } catch (error) {
    console.error("✗ replicate client error:", error);
  }
}

async function testElevenlabs() {
  console.log("\n=== testing elevenlabs tts ===");

  try {
    await textToSpeech({
      text: "welcome to varg ai sdk, your complete video production toolkit",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      outputPath: "media/welcome.mp3",
    });
    console.log("✓ saved to media/welcome.mp3");
  } catch (error) {
    console.error("✗ elevenlabs error:", error);
  }
}

async function main() {
  console.log("🚀 testing varg.ai sdk services...\n");

  await testFalImage();
  await testReplicateImage();
  await testReplicateClient();
  await testElevenlabs();

  console.log("\n✨ all tests complete! check media/ directory");
}

main().catch(console.error);
