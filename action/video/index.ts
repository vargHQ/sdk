#!/usr/bin/env bun
/**
 * video generation service combining fal and higgsfield
 * usage: bun run service/video.ts <command> <args>
 */

import type { ActionMeta } from "../../cli/types";
import { imageToVideo, textToVideo } from "../../lib/fal";
import { uploadFromUrl } from "../../utilities/s3";

export const meta: ActionMeta = {
  name: "video",
  type: "action",
  description: "generate video from text or image",
  inputType: "text/image",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "what to generate" },
        image: {
          type: "string",
          format: "file-path",
          description: "input image (enables image-to-video)",
        },
        duration: {
          type: "integer",
          enum: [5, 10],
          default: 5,
          description: "video duration in seconds",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { prompt, image, duration } = options as {
      prompt: string;
      image?: string;
      duration?: 5 | 10;
    };
    if (image) {
      return generateVideoFromImage(prompt, image, { duration });
    }
    return generateVideoFromText(prompt, { duration });
  },
};

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
  console.log("[service/video] generating video from image");

  const result = await imageToVideo({
    prompt,
    imageUrl,
    duration: options.duration,
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("no video url in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `videos/generated/${timestamp}.mp4`;
    uploaded = await uploadFromUrl(videoUrl, objectKey);
    console.log(`[service/video] uploaded to ${uploaded}`);
  }

  return {
    videoUrl,
    duration: result.data?.duration,
    uploaded,
  };
}

export async function generateVideoFromText(
  prompt: string,
  options: { duration?: 5 | 10; upload?: boolean } = {},
): Promise<VideoGenerationResult> {
  console.log("[service/video] generating video from text");

  const result = await textToVideo({
    prompt,
    duration: options.duration,
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("no video url in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `videos/generated/${timestamp}.mp4`;
    uploaded = await uploadFromUrl(videoUrl, objectKey);
    console.log(`[service/video] uploaded to ${uploaded}`);
  }

  return {
    videoUrl,
    duration: result.data?.duration,
    uploaded,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
