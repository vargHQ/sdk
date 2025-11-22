#!/usr/bin/env bun
/**
 * fal.ai wrapper using @fal-ai/client directly
 * for video generation and advanced features
 *
 * usage: bun run lib/fal.ts <command> <args>
 */

import { fal } from "@fal-ai/client";

interface FalImageToVideoArgs {
  prompt: string;
  imageUrl: string;
  modelVersion?: string;
  duration?: 5 | 10;
}

interface FalTextToVideoArgs {
  prompt: string;
  modelVersion?: string;
  duration?: 5 | 10;
}

export async function imageToVideo(args: FalImageToVideoArgs) {
  const modelId = `fal-ai/kling-video/${args.modelVersion || "v2.5-turbo/pro"}/image-to-video`;

  console.log(`[fal] starting image-to-video: ${modelId}`);
  console.log(`[fal] prompt: ${args.prompt}`);
  console.log(`[fal] image: ${args.imageUrl}`);

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: args.imageUrl,
        duration: args.duration || 5,
      },
      logs: true,
      onQueueUpdate: (update: {
        status: string;
        logs?: Array<{ message: string }>;
      }) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  } catch (error) {
    console.error("[fal] error:", error);
    throw error;
  }
}

export async function textToVideo(args: FalTextToVideoArgs) {
  const modelId = `fal-ai/kling-video/${args.modelVersion || "v2.5-turbo/pro"}/text-to-video`;

  console.log(`[fal] starting text-to-video: ${modelId}`);
  console.log(`[fal] prompt: ${args.prompt}`);

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        duration: args.duration || 5,
      },
      logs: true,
      onQueueUpdate: (update: {
        status: string;
        logs?: Array<{ message: string }>;
      }) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  } catch (error) {
    console.error("[fal] error:", error);
    throw error;
  }
}

export async function generateImage(args: {
  prompt: string;
  model?: string;
  imageSize?: string;
}) {
  const modelId = args.model || "fal-ai/flux-pro/v1.1";

  console.log(`[fal] generating image with ${modelId}`);
  console.log(`[fal] prompt: ${args.prompt}`);

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_size: args.imageSize || "landscape_4_3",
      },
      logs: true,
      onQueueUpdate: (update: {
        status: string;
        logs?: Array<{ message: string }>;
      }) => {
        if (update.status === "IN_PROGRESS") {
          console.log(
            `[fal] ${update.logs?.map((l) => l.message).join(" ") || "processing..."}`,
          );
        }
      },
    });

    console.log("[fal] completed!");
    return result;
  } catch (error) {
    console.error("[fal] error:", error);
    throw error;
  }
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "image_to_video": {
      if (!args[0] || !args[1]) {
        console.log(`
Usage: bun run lib/fal.ts image_to_video <prompt> <image_url> [duration]
Example:
  bun run lib/fal.ts image_to_video "person talking" "https://image.url" 5
        `);
        process.exit(1);
      }
      const duration = args[2];
      if (duration && duration !== "5" && duration !== "10") {
        console.error("duration must be 5 or 10");
        process.exit(1);
      }
      const i2vResult = await imageToVideo({
        prompt: args[0],
        imageUrl: args[1],
        duration: duration === "10" ? 10 : 5,
      });
      console.log(JSON.stringify(i2vResult, null, 2));
      break;
    }

    case "text_to_video": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/fal.ts text_to_video <prompt> [duration]

examples:
  bun run lib/fal.ts text_to_video "ocean waves crashing" 5
        `);
        process.exit(1);
      }
      const duration = args[1];
      if (duration && duration !== "5" && duration !== "10") {
        console.error("duration must be 5 or 10");
        process.exit(1);
      }
      const t2vResult = await textToVideo({
        prompt: args[0],
        duration: duration === "10" ? 10 : 5,
      });
      console.log(JSON.stringify(t2vResult, null, 2));
      break;
    }

    case "generate_image": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/fal.ts generate_image <prompt> [model] [imageSize]

examples:
  bun run lib/fal.ts generate_image "mountain landscape" "fal-ai/flux-pro/v1.1"
  
available image sizes:
  - square_hd, square, portrait_4_3, portrait_16_9
  - landscape_4_3, landscape_16_9
        `);
        process.exit(1);
      }
      const imgResult = await generateImage({
        prompt: args[0],
        model: args[1],
        imageSize: args[2],
      });
      console.log(JSON.stringify(imgResult, null, 2));
      break;
    }

    default:
      console.log(`
usage:
  # video generation (requires fal client)
  bun run lib/fal.ts image_to_video <prompt> <imageUrl> [duration]
  bun run lib/fal.ts text_to_video <prompt> [duration]
  
  # image generation (fal client with all features)
  bun run lib/fal.ts generate_image <prompt> [model] [imageSize]
  
note: for simpler image generation, use lib/ai-sdk/fal.ts instead
      `);
      process.exit(1);
  }
}
