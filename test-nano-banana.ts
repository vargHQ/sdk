/**
 * Minimal test: generate one image with nano-banana-pro via AI SDK.
 * Check what URL comes back and what the result shape looks like.
 *
 * Usage:
 *   bun run test-nano-banana.ts
 */

import { generateImage } from "ai";
import { fal } from "./src/ai-sdk/providers/fal";

const model = fal.imageModel("nano-banana-pro");

console.log("Generating image with nano-banana-pro...\n");

const result = await generateImage({
  model,
  prompt: "A kawaii orange character, round plush body, small black dot eyes",
  aspectRatio: "9:16",
  n: 1,
});

const img = result.images[0];

console.log("=== Result ===");
console.log("images.length:", result.images.length);
console.log("typeof img:", typeof img);
console.log("img.constructor:", img?.constructor?.name);
console.log("img.mediaType:", img?.mediaType);
console.log(
  "img.uint8Array instanceof Uint8Array:",
  img?.uint8Array instanceof Uint8Array,
);
console.log("img.uint8Array.length:", img?.uint8Array?.length);

// Check for URL — DefaultGeneratedFile might have extra props
const raw = img as any;
console.log("\n=== Raw properties ===");
console.log("Object.keys:", Object.keys(raw));
console.log("url:", raw.url);
console.log("base64 (first 40 chars):", img?.base64?.slice(0, 40));

// Also check the full result shape
console.log("\n=== Full result keys ===");
console.log("Object.keys(result):", Object.keys(result));
console.log("warnings:", result.warnings);
console.log("response:", (result as any).response);
