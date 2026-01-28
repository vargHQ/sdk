/**
 * Video generation action
 * Routes to appropriate video generation models based on input
 */

import { z } from "zod";
import {
  aspectRatioSchema,
  filePathSchema,
  videoDurationSchema,
} from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { storageProvider } from "../../providers/storage";

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
    {
      target: "decart-lucy",
      when: { provider: "decart" },
      priority: 8,
    },
  ],
  execute: async (inputs) => {
    // inputs is now fully typed as VideoInput - no more `as` cast!
    const { prompt, image, duration, aspectRatio } = inputs;

    let result: { data?: { video?: { url?: string }; duration?: number } };

    if (image) {
      console.log("[action/video] generating video from image");
      result = await falProvider.imageToVideo({
        prompt,
        imageUrl: image,
        duration,
      });
    } else {
      console.log("[action/video] generating video from text");
      result = await falProvider.textToVideo({
        prompt,
        duration,
        aspectRatio,
      });
    }

    const videoUrl = result.data?.video?.url;
    if (!videoUrl) {
      throw new Error("No video URL in result");
    }

    return {
      videoUrl,
      duration: result.data?.duration,
    };
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
  options: { duration?: 5 | 10; upload?: boolean } = {},
): Promise<VideoGenerationResult> {
  console.log("[video] generating video from image");

  const result = await falProvider.imageToVideo({
    prompt,
    imageUrl,
    duration: options.duration,
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("No video URL in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `videos/generated/${timestamp}.mp4`;
    uploaded = await storageProvider.uploadFromUrl(videoUrl, objectKey);
    console.log(`[video] uploaded to ${uploaded}`);
  }

  return {
    videoUrl,
    duration: result.data?.duration,
    uploaded,
  };
}

export async function generateVideoFromText(
  prompt: string,
  options: {
    duration?: 5 | 10;
    upload?: boolean;
    aspectRatio?: "16:9" | "9:16" | "1:1";
  } = {},
): Promise<VideoGenerationResult> {
  console.log("[video] generating video from text");

  const result = await falProvider.textToVideo({
    prompt,
    duration: options.duration,
    aspectRatio: options.aspectRatio,
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("No video URL in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `videos/generated/${timestamp}.mp4`;
    uploaded = await storageProvider.uploadFromUrl(videoUrl, objectKey);
    console.log(`[video] uploaded to ${uploaded}`);
  }

  return {
    videoUrl,
    duration: result.data?.duration,
    uploaded,
  };
}

export default definition;
