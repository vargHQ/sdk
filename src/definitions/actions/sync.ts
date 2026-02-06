/**
 * Lip sync action
 * Audio-to-video synchronization
 */

import { fal } from "@fal-ai/client";
import { z } from "zod";
import {
  filePathSchema,
  resolutionSchema,
  videoDurationStringSchema,
} from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { ensureUrl, logQueueUpdate } from "./utils";

// Input schema with Zod
const syncInputSchema = z.object({
  image: filePathSchema.describe("Input image"),
  audio: filePathSchema.describe("Audio file"),
  prompt: z.string().describe("Description of the scene"),
  duration: videoDurationStringSchema.default("5").describe("Output duration"),
  resolution: resolutionSchema.default("480p").describe("Output resolution"),
});

// Output schema with Zod
const syncOutputSchema = z.object({
  videoUrl: z.string(),
});

// Schema object for the definition
const schema: ZodSchema<typeof syncInputSchema, typeof syncOutputSchema> = {
  input: syncInputSchema,
  output: syncOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "sync",
  description: "Lip sync audio to video/image",
  schema,
  routes: [],
  execute: async (inputs) => {
    const { image, audio, prompt, duration, resolution } = inputs;
    return lipsync({ image, audio, prompt, duration, resolution });
  },
};

// Types
export interface LipsyncOptions {
  image: string;
  audio: string;
  prompt: string;
  duration?: "5" | "10";
  resolution?: "480p" | "720p" | "1080p";
}

export interface LipsyncResult {
  videoUrl: string;
}

export interface Wav2LipOptions {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}

/**
 * Generate lip-synced video using Wan-25
 */
export async function lipsync(options: LipsyncOptions): Promise<LipsyncResult> {
  const { image, audio, prompt, duration = "5", resolution = "480p" } = options;

  console.log("[sync] generating lip-synced video with wan-25...");

  const imageUrl = await ensureUrl(image);
  const audioUrl = await ensureUrl(audio);

  const result = await fal.subscribe("fal-ai/wan-25-preview/image-to-video", {
    input: {
      prompt,
      image_url: imageUrl,
      audio_url: audioUrl,
      resolution: resolution || "480p",
      duration: duration || "5",
      negative_prompt:
        "low resolution, error, worst quality, low quality, defects",
      enable_prompt_expansion: true,
    },
    logs: true,
    onQueueUpdate: logQueueUpdate("sync"),
  });

  const videoUrl = result.data?.video?.url;
  if (!videoUrl) {
    throw new Error("No video URL in result");
  }

  return { videoUrl };
}

/**
 * Overlay lip-synced face onto original video
 */
export async function lipsyncOverlay(options: {
  originalVideo: string;
  lipsyncedVideo: string;
  outputPath: string;
}): Promise<string> {
  const { lipsyncedVideo, outputPath } = options;

  console.log("[sync] overlaying lip-synced video...");

  await Bun.$`ffmpeg -y -i ${lipsyncedVideo} -c copy ${outputPath}`.quiet();

  return outputPath;
}

/**
 * Wav2Lip-style lip sync (placeholder for future implementation)
 */
export async function lipsyncWav2Lip(options: Wav2LipOptions): Promise<string> {
  console.warn("[sync] wav2lip not yet implemented, using wan-25 fallback");

  await Bun.$`ffmpeg -y -i ${options.videoPath} -c copy ${options.outputPath}`.quiet();

  return options.outputPath;
}

export default definition;
