#!/usr/bin/env bun
/**
 * replicate wrapper using @ai-sdk/replicate provider
 * recommended for standard image generation with vercel ai sdk
 *
 * usage: bun run lib/ai-sdk/replicate.ts <command> <args>
 */

import { replicate } from "@ai-sdk/replicate";
import { experimental_generateImage as generateImageAI } from "ai";

export async function generateImage(args: {
  prompt: string;
  model?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}) {
  const modelId = args.model || "black-forest-labs/flux-dev";

  console.log(`[ai-sdk/replicate] generating image with ${modelId}`);
  console.log(`[ai-sdk/replicate] prompt: ${args.prompt}`);
  if (args.aspectRatio) {
    console.log(`[ai-sdk/replicate] aspect ratio: ${args.aspectRatio}`);
  }

  try {
    const { image, providerMetadata } = await generateImageAI({
      model: replicate.image(modelId),
      prompt: args.prompt,
      aspectRatio: args.aspectRatio,
    });

    console.log("[ai-sdk/replicate] completed!");

    // return in consistent format
    return {
      image: {
        url: image.base64 ? `data:image/png;base64,${image.base64}` : undefined,
        uint8Array: image.uint8Array,
      },
      metadata: providerMetadata?.replicate,
    };
  } catch (error) {
    console.error("[ai-sdk/replicate] error:", error);
    throw error;
  }
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "generate_image": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/ai-sdk/replicate.ts generate_image <prompt> [model] [aspectRatio]

examples:
  bun run lib/ai-sdk/replicate.ts generate_image "sunset over ocean" "black-forest-labs/flux-dev" "16:9"
  bun run lib/ai-sdk/replicate.ts generate_image "portrait photo" "black-forest-labs/flux-1.1-pro" "9:16"
  bun run lib/ai-sdk/replicate.ts generate_image "cyberpunk city" "black-forest-labs/flux-schnell" "1:1"

available models:
  - black-forest-labs/flux-dev (default, fast)
  - black-forest-labs/flux-1.1-pro (high quality)
  - black-forest-labs/flux-schnell (very fast)
  - stability-ai/sdxl (stable diffusion xl)
        `);
        process.exit(1);
      }

      const result = await generateImage({
        prompt: args[0],
        model: args[1],
        aspectRatio: args[2] as
          | "1:1"
          | "16:9"
          | "9:16"
          | "4:3"
          | "3:4"
          | undefined,
      });

      // save image to file
      if (result.image.uint8Array) {
        const filename = `/tmp/replicate-ai-sdk-${Date.now()}.png`;
        await Bun.write(filename, result.image.uint8Array);
        console.log(`\nimage saved to: ${filename}`);

        // open image
        await Bun.spawn(["open", filename]);
      }

      console.log("\nmetadata:");
      console.log(JSON.stringify(result.metadata, null, 2));
      break;
    }

    default:
      console.log(`
usage:
  bun run lib/ai-sdk/replicate.ts generate_image <prompt> [model] [aspectRatio]
      `);
      process.exit(1);
  }
}
