/**
 * Generate multiple scene frames in parallel using flux kontext
 * Usage: bun run pipeline/cookbooks/scripts/generate-frames-parallel.ts
 */

import { fal } from "@fal-ai/client";

interface FrameConfig {
  name: string;
  prompt: string;
  imageUrls: string[]; // character reference URLs
  multi?: boolean; // use kontext/multi for multiple characters
}

async function generateFrames(configs: FrameConfig[], outputDir: string) {
  console.log(`Generating ${configs.length} frames in parallel...\n`);

  const promises = configs.map((config) => {
    if (config.multi) {
      return fal.subscribe("fal-ai/flux-pro/kontext/multi", {
        input: {
          prompt: config.prompt,
          image_urls: config.imageUrls,
          aspect_ratio: "9:16" as const,
        },
      });
    } else {
      return fal.subscribe("fal-ai/flux-pro/kontext", {
        input: {
          prompt: config.prompt,
          image_url: config.imageUrls[0]!,
          aspect_ratio: "9:16" as const,
        },
      });
    }
  });

  const results = await Promise.all(promises);

  for (let i = 0; i < results.length; i++) {
    const result = results[i] as {
      data?: { images?: Array<{ url?: string }> };
    };
    const url = result.data?.images?.[0]?.url;
    if (url) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await Bun.write(`${outputDir}/${configs[i]!.name}_frame.jpg`, buffer);
      console.log(`${configs[i]!.name}_frame.jpg saved`);
    } else {
      console.error(`No URL for ${configs[i]!.name}`);
    }
  }

  console.log("\nAll frames saved!");
}

// Example usage:
async function main() {
  const outputDir = "media/girl-ruined-you";

  // Upload character references first
  const protagonist = await fal.storage.upload(
    Bun.file(`${outputDir}/cat_protagonist.png`),
  );
  const secondGirl = await fal.storage.upload(
    Bun.file(`${outputDir}/cat_second_girl.png`),
  );

  const configs: FrameConfig[] = [
    {
      name: "scene6",
      prompt:
        "3D pixar style: male cat in hoodie (first) and elegant female cat (second) meeting eyes in coffee shop, warm golden lighting, vertical portrait 9:16",
      imageUrls: [protagonist, secondGirl],
      multi: true,
    },
    {
      name: "scene7",
      prompt:
        "3D pixar style: male cat and female cat walking together, sunset, romantic, vertical portrait 9:16",
      imageUrls: [protagonist, secondGirl],
      multi: true,
    },
    // Single character scene
    {
      name: "scene14",
      prompt:
        "Place this cat looking at sunrise through window, hopeful, vertical portrait 9:16",
      imageUrls: [protagonist],
      multi: false,
    },
  ];

  await generateFrames(configs, outputDir);
}

main().catch(console.error);
