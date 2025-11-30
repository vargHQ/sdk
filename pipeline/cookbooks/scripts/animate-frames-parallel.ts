/**
 * Animate multiple frames in parallel using kling
 * Usage: bun run pipeline/cookbooks/scripts/animate-frames-parallel.ts
 */

import { fal } from "@fal-ai/client";

interface VideoConfig {
  name: string;
  framePath: string;
  prompt: string;
  duration?: "5" | "10";
}

async function animateFrames(configs: VideoConfig[], outputDir: string) {
  console.log(`Animating ${configs.length} frames in parallel...\n`);

  // Upload all frames first
  const frameUrls: string[] = [];
  for (const config of configs) {
    const url = await fal.storage.upload(Bun.file(config.framePath));
    frameUrls.push(url);
  }

  const promises = configs.map((config, i) => {
    return fal.subscribe("fal-ai/kling-video/v2.5-turbo/pro/image-to-video", {
      input: {
        prompt: config.prompt + ", NO talking NO lip movement",
        image_url: frameUrls[i]!,
        duration: config.duration || "5",
        // note: aspect_ratio is determined by input image dimensions
      },
    });
  });

  const results = await Promise.all(promises);

  for (let i = 0; i < results.length; i++) {
    const result = results[i] as { data?: { video?: { url?: string } } };
    const url = result.data?.video?.url;
    if (url) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await Bun.write(`${outputDir}/${configs[i]!.name}_video.mp4`, buffer);
      console.log(`${configs[i]!.name}_video.mp4 saved`);
    } else {
      console.error(`No URL for ${configs[i]!.name}`);
    }
  }

  console.log("\nAll videos saved!");
}

// Example usage:
async function main() {
  const outputDir = "media/girl-ruined-you";

  const configs: VideoConfig[] = [
    {
      name: "scene6",
      framePath: `${outputDir}/scene6_frame.jpg`,
      prompt:
        "3D pixar animation, two cats meet eyes in coffee shop, warm romantic moment",
      duration: "5",
    },
    {
      name: "scene7",
      framePath: `${outputDir}/scene7_frame.jpg`,
      prompt: "3D pixar animation, two cats walking together, sunset, romantic",
      duration: "5",
    },
    {
      name: "scene14",
      framePath: `${outputDir}/scene14_frame.jpg`,
      prompt: "3D pixar animation, cat looks at sunrise, hopeful realization",
      duration: "5",
    },
  ];

  await animateFrames(configs, outputDir);
}

main().catch(console.error);
