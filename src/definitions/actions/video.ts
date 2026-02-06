/**
 * Video generation action
 * Routes to appropriate video generation models based on input
 */

import { fal } from "@fal-ai/client";
import { z } from "zod";
import {
  aspectRatioSchema,
  filePathSchema,
  videoDurationSchema,
} from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { ensureUrl, logQueueUpdate } from "./utils";

// Input schema with Zod
const videoInputSchema = z.object({
  prompt: z.string().describe("What to generate"),
  image: filePathSchema
    .optional()
    .describe("Input image (enables image-to-video)"),
  duration: videoDurationSchema
    .default(5)
    .describe("Video duration in seconds"),
  aspectRatio: aspectRatioSchema
    .default("16:9")
    .describe("Aspect ratio for text-to-video"),
});

// Output schema with Zod
const videoOutputSchema = z.object({
  videoUrl: z.string(),
  duration: z.number().optional(),
});

// Schema object for the definition
const schema: ZodSchema<typeof videoInputSchema, typeof videoOutputSchema> = {
  input: videoInputSchema,
  output: videoOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "video",
  description: "Generate video from text or image",
  schema,
  routes: [
    {
      target: "kling",
      priority: 10,
    },
  ],
  execute: async (inputs) => {
    const { prompt, image, duration, aspectRatio } = inputs;

    type FalResult = { data: { video?: { url?: string } } };
    let result: FalResult;

    if (image) {
      console.log("[action/video] generating video from image");
      const imageUrl = await ensureUrl(image);
      result = (await fal.subscribe(
        "fal-ai/kling-video/v2.5-turbo/pro/image-to-video" as string,
        {
          input: {
            prompt,
            image_url: imageUrl,
            duration: String(duration || 5),
          },
          logs: true,
          onQueueUpdate: logQueueUpdate("video"),
        },
      )) as FalResult;
    } else {
      console.log("[action/video] generating video from text");
      result = (await fal.subscribe(
        "fal-ai/kling-video/v2.5-turbo/pro/text-to-video" as string,
        {
          input: {
            prompt,
            duration: String(duration || 5),
            aspect_ratio: aspectRatio || "16:9",
          },
          logs: true,
          onQueueUpdate: logQueueUpdate("video"),
        },
      )) as FalResult;
    }

    const videoUrl = result.data?.video?.url;
    if (!videoUrl) {
      throw new Error("No video URL in result");
    }

    return { videoUrl };
  },
};

// Re-export types and functions for backward compatibility
export interface VideoGenerationResult {
  videoUrl: string;
  duration?: number;
  uploaded?: string;
}

export async function generateVideoFromImage(
  prompt: string,
  imageUrl: string,
  options: { duration?: 5 | 10 } = {},
): Promise<VideoGenerationResult> {
  console.log("[video] generating video from image");

  type FalResult = { data: { video?: { url?: string } } };
  const url = await ensureUrl(imageUrl);
  const result = (await fal.subscribe(
    "fal-ai/kling-video/v2.5-turbo/pro/image-to-video" as string,
    {
      input: {
        prompt,
        image_url: url,
        duration: String(options.duration || 5),
      },
      logs: true,
      onQueueUpdate: logQueueUpdate("video"),
    },
  )) as FalResult;

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("No video URL in result");
  }

  return { videoUrl };
}

export async function generateVideoFromText(
  prompt: string,
  options: {
    duration?: 5 | 10;
    aspectRatio?: "16:9" | "9:16" | "1:1";
  } = {},
): Promise<VideoGenerationResult> {
  console.log("[video] generating video from text");

  type FalResult = { data: { video?: { url?: string } } };
  const result = (await fal.subscribe(
    "fal-ai/kling-video/v2.5-turbo/pro/text-to-video" as string,
    {
      input: {
        prompt,
        duration: String(options.duration || 5),
        aspect_ratio: options.aspectRatio || "16:9",
      },
      logs: true,
      onQueueUpdate: logQueueUpdate("video"),
    },
  )) as FalResult;

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("No video URL in result");
  }

  return { videoUrl };
}

export default definition;
