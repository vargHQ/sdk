/**
 * Video generation action
 * Routes to appropriate video generation models based on input
 */

import type { ActionDefinition } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { storageProvider } from "../../providers/storage";

export const definition: ActionDefinition = {
  type: "action",
  name: "video",
  description: "Generate video from text or image",
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "What to generate" },
        image: {
          type: "string",
          format: "file-path",
          description: "Input image (enables image-to-video)",
        },
        duration: {
          type: "integer",
          enum: [5, 10],
          default: 5,
          description: "Video duration in seconds",
        },
        aspectRatio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1"],
          default: "16:9",
          description: "Aspect ratio for text-to-video",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "Video URL" },
  },
  routes: [
    {
      target: "kling",
      priority: 10,
    },
  ],
  execute: async (inputs) => {
    const { prompt, image, duration, aspectRatio } = inputs as {
      prompt: string;
      image?: string;
      duration?: 5 | 10;
      aspectRatio?: "16:9" | "9:16" | "1:1";
    };

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
