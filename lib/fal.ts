#!/usr/bin/env bun

/**
 * fal.ai wrapper using @fal-ai/client directly
 * for video generation and advanced features
 *
 * usage: bun run lib/fal.ts <command> <args>
 */

import { existsSync } from "node:fs";
import { fal } from "@fal-ai/client";

interface FalImageToVideoArgs {
  prompt: string;
  imageUrl: string; // can be url or local file path
  modelVersion?: string;
  duration?: 5 | 10;
}

/**
 * upload local file to fal storage if needed
 * returns the url (either original or uploaded)
 */
async function ensureImageUrl(imagePathOrUrl: string): Promise<string> {
  // if it's already a url, return it
  if (
    imagePathOrUrl.startsWith("http://") ||
    imagePathOrUrl.startsWith("https://")
  ) {
    return imagePathOrUrl;
  }

  // check if local file exists
  if (!existsSync(imagePathOrUrl)) {
    throw new Error(`local file not found: ${imagePathOrUrl}`);
  }

  console.log(`[fal] uploading local file: ${imagePathOrUrl}`);

  // read file and upload to fal
  const file = await Bun.file(imagePathOrUrl).arrayBuffer();

  const uploadedUrl = await fal.storage.upload(
    new Blob([file], { type: "image/jpeg" }),
  );

  console.log(`[fal] uploaded to: ${uploadedUrl}`);
  return uploadedUrl;
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

  // upload local file if needed
  const imageUrl = await ensureImageUrl(args.imageUrl);

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: imageUrl,
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

interface FalImageToImageArgs {
  prompt: string;
  imageUrl: string; // can be url or local file path
  strength?: number;
  numInferenceSteps?: number;
  aspectRatio?: string; // auto, 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16
}

interface FalWan25Args {
  prompt: string;
  imageUrl: string; // can be url or local file path
  audioUrl: string; // can be url or local file path
  resolution?: "480p" | "720p" | "1080p";
  duration?: "5" | "10";
  negativePrompt?: string;
  enablePromptExpansion?: boolean;
  enableSafetyChecker?: boolean;
}

export async function imageToImage(args: FalImageToImageArgs) {
  const modelId = "fal-ai/nano-banana-pro/edit";

  console.log(`[fal] starting image-to-image: ${modelId}`);
  console.log(`[fal] prompt: ${args.prompt}`);
  console.log(`[fal] source image: ${args.imageUrl}`);

  // upload local file if needed
  const imageUrl = await ensureImageUrl(args.imageUrl);

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_urls: [imageUrl],
        aspect_ratio: args.aspectRatio || "auto",
        resolution: "2K",
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

interface FalWan25Args {
  prompt: string;
  imageUrl: string; // can be url or local file path
  audioUrl: string; // can be url or local file path
  resolution?: "480p" | "720p" | "1080p";
  duration?: "5" | "10";
  negativePrompt?: string;
  enablePromptExpansion?: boolean;
  enableSafetyChecker?: boolean;
}

/**
 * helper to upload audio file to fal storage if needed
 */
async function ensureAudioUrl(audioPathOrUrl: string): Promise<string> {
  // if it's already a url, return it
  if (
    audioPathOrUrl.startsWith("http://") ||
    audioPathOrUrl.startsWith("https://")
  ) {
    return audioPathOrUrl;
  }

  // check if local file exists
  if (!existsSync(audioPathOrUrl)) {
    throw new Error(`local audio file not found: ${audioPathOrUrl}`);
  }

  console.log(`[fal] uploading local audio: ${audioPathOrUrl}`);

  // read file and upload to fal
  const file = await Bun.file(audioPathOrUrl).arrayBuffer();

  const uploadedUrl = await fal.storage.upload(
    new Blob([file], { type: "audio/mpeg" }),
  );

  console.log(`[fal] uploaded audio to: ${uploadedUrl}`);
  return uploadedUrl;
}

export async function wan25(args: FalWan25Args) {
  const modelId = "fal-ai/wan-25-preview/image-to-video";

  console.log(`[fal] starting wan-25: ${modelId}`);
  console.log(`[fal] prompt: ${args.prompt}`);
  console.log(`[fal] image: ${args.imageUrl}`);
  console.log(`[fal] audio: ${args.audioUrl}`);

  // upload local files if needed
  const imageUrl = await ensureImageUrl(args.imageUrl);
  const audioUrl = await ensureAudioUrl(args.audioUrl);

  try {
    const result = await fal.subscribe(modelId, {
      input: {
        prompt: args.prompt,
        image_url: imageUrl,
        audio_url: audioUrl,
        resolution: args.resolution || "480p",
        duration: args.duration || "5",
        negative_prompt:
          args.negativePrompt ||
          "low resolution, error, worst quality, low quality, defects",
        enable_prompt_expansion: args.enablePromptExpansion ?? true,
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
    if (error && typeof error === "object" && "body" in error) {
      console.error(
        "[fal] validation details:",
        JSON.stringify(error.body, null, 2),
      );
    }
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
usage: bun run lib/fal.ts image_to_video <prompt> <image_path_or_url> [duration]

examples:
  bun run lib/fal.ts image_to_video "person talking" "https://image.url" 5
  bun run lib/fal.ts image_to_video "ocean waves" "./media/beach.jpg" 10
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

    case "image_to_image": {
      if (!args[0] || !args[1]) {
        console.log(`
usage: bun run lib/fal.ts image_to_image <prompt> <image_path_or_url> [aspect_ratio]

examples:
  bun run lib/fal.ts image_to_image "woman at busy conference hall" media/friend/katia.jpg
  bun run lib/fal.ts image_to_image "person in underground station" https://image.url 9:16
  
parameters:
  aspect_ratio: auto (preserves input), 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16 (default: auto)

note: now uses nano banana pro for better quality and aspect ratio preservation
        `);
        process.exit(1);
      }
      const aspectRatio = args[2] || "auto";
      const i2iResult = await imageToImage({
        prompt: args[0],
        imageUrl: args[1],
        aspectRatio,
      });
      console.log(JSON.stringify(i2iResult, null, 2));
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

    case "wan": {
      if (!args[0] || !args[1] || !args[2]) {
        console.log(`
usage: bun run lib/fal.ts wan <image_path_or_url> <audio_path_or_url> <prompt> [duration] [resolution]

examples:
  bun run lib/fal.ts wan media/friend/aleks/option2.jpg media/friend/aleks/voice.mp3 "selfie POV video, handheld camera" 5 480p
  bun run lib/fal.ts wan https://image.url https://audio.url "talking video" 10 720p

parameters:
  duration: 5 or 10 (default: 5)
  resolution: 480p, 720p, or 1080p (default: 480p)
        `);
        process.exit(1);
      }
      const wanDuration = args[3];
      if (wanDuration && wanDuration !== "5" && wanDuration !== "10") {
        console.error("duration must be 5 or 10");
        process.exit(1);
      }
      const wanResolution = args[4];
      if (
        wanResolution &&
        wanResolution !== "480p" &&
        wanResolution !== "720p" &&
        wanResolution !== "1080p"
      ) {
        console.error("resolution must be 480p, 720p, or 1080p");
        process.exit(1);
      }
      const wanResult = await wan25({
        imageUrl: args[0],
        audioUrl: args[1],
        prompt: args[2],
        duration: (wanDuration as "5" | "10") || "5",
        resolution:
          (wanResolution as "480p" | "720p" | "1080p" | undefined) || "480p",
      });
      console.log(JSON.stringify(wanResult, null, 2));
      break;
    }

    default:
      console.log(`
usage:
  # video generation (supports local files and urls)
  bun run lib/fal.ts image_to_video <prompt> <image_path_or_url> [duration]
  bun run lib/fal.ts text_to_video <prompt> [duration]
  bun run lib/fal.ts wan <image_path_or_url> <audio_path_or_url> <prompt> [duration] [resolution]
  
  # image generation (fal client with all features)
  bun run lib/fal.ts generate_image <prompt> [model] [imageSize]
  bun run lib/fal.ts image_to_image <prompt> <image_path_or_url> [strength]
  
note: for simpler image generation, use lib/ai-sdk/fal.ts instead
      `);
      process.exit(1);
  }
}
