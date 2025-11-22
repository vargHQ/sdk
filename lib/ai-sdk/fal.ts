#!/usr/bin/env bun
/**
 * fal.ai wrapper using @ai-sdk/fal provider
 * recommended for standard image generation with vercel ai sdk
 *
 * usage: bun run lib/ai-sdk/fal.ts <command> <args>
 */

import { fal } from "@ai-sdk/fal";
import { experimental_generateImage as generateImageAI } from "ai";

export async function generateImage(args: {
  prompt: string;
  model?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}) {
  const modelId = args.model || "fal-ai/flux/dev";

  console.log(`[ai-sdk/fal] generating image with ${modelId}`);
  console.log(`[ai-sdk/fal] prompt: ${args.prompt}`);
  if (args.aspectRatio) {
    console.log(`[ai-sdk/fal] aspect ratio: ${args.aspectRatio}`);
  }

  try {
    const { image, providerMetadata } = await generateImageAI({
      model: fal.image(modelId),
      prompt: args.prompt,
      aspectRatio: args.aspectRatio,
    });

    console.log("[ai-sdk/fal] completed!");

    // return in consistent format
    return {
      image: {
        url: image.base64 ? `data:image/png;base64,${image.base64}` : undefined,
        uint8Array: image.uint8Array,
      },
      metadata: providerMetadata?.fal,
    };
  } catch (error) {
    console.error("[ai-sdk/fal] error:", error);
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
  bun run lib/ai-sdk/fal.ts generate_image <prompt> [model] [aspectRatio]

examples:
  bun run lib/ai-sdk/fal.ts generate_image "sunset over ocean" "fal-ai/flux/dev" "16:9"
  bun run lib/ai-sdk/fal.ts generate_image "portrait photo" "fal-ai/flux-pro/v1.1" "9:16"

available models:
  - fal-ai/flux/dev (default, fast)
  - fal-ai/flux-pro/v1.1 (high quality)
  - fal-ai/flux/schnell (very fast)
  - fal-ai/ideogram/character (character consistency)
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
        const filename = `/tmp/fal-ai-sdk-${Date.now()}.png`;
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
  bun run lib/ai-sdk/fal.ts generate_image <prompt> [model] [aspectRatio]
      `);
      process.exit(1);
  }
}
