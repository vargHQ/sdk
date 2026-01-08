/**
 * Simple Video Generation Example
 * Generates an image and animates it into a video
 *
 * Usage:
 *   bun run src/v2/examples/simple-video.ts
 */

import { generateImage, generateVideo } from "../index";
import { fal } from "../providers/fal";

async function main() {
  console.log("=== simple video generation ===\n");

  // 1. generate an image
  console.log("[1/2] generating image...");
  const { images } = await generateImage({
    model: fal.image("flux-schnell"),
    prompt:
      "a cute robot waving hello, 3d render, studio lighting, white background",
    size: "square",
  });

  const image = images[0]!;
  console.log(`image generated: ${image.url}\n`);

  // 2. animate it
  console.log("[2/2] animating image...");
  const { video } = await generateVideo({
    model: fal.video("wan-2.5"),
    prompt: "robot waves hello cheerfully, smooth animation",
    image: image.url,
    duration: 5,
  });

  console.log(`video generated: ${video.url}\n`);

  // 3. save locally
  const outputPath = "./output/simple-video.mp4";
  await video.save(outputPath);
  console.log(`saved to: ${outputPath}`);

  return { image, video };
}

main().catch(console.error);
