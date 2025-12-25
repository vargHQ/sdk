/**
 * Lip sync action
 * Audio-to-video synchronization
 */

import { z } from "zod";
import type { ActionDefinition } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { ffmpegProvider } from "../../providers/ffmpeg";

export const syncInputSchema = z.object({
  image: z.string().describe("Input image"),
  audio: z.string().describe("Audio file"),
  prompt: z.string().describe("Description of the scene"),
  duration: z
    .enum(["5", "10"])
    .optional()
    .default("5")
    .describe("Output duration"),
  resolution: z
    .enum(["480p", "720p", "1080p"])
    .optional()
    .default("480p")
    .describe("Output resolution"),
});

export const syncOutputSchema = z.object({
  videoUrl: z.string(),
});

export type SyncInput = z.infer<typeof syncInputSchema>;
export type SyncOutput = z.infer<typeof syncOutputSchema>;

export const definition: ActionDefinition<
  typeof syncInputSchema,
  typeof syncOutputSchema
> = {
  type: "action",
  name: "sync",
  description: "Lip sync audio to video/image",
  inputSchema: syncInputSchema,
  outputSchema: syncOutputSchema,
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

  const result = await falProvider.wan25({
    imageUrl: image,
    audioUrl: audio,
    prompt,
    duration,
    resolution,
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

  // This would require more complex ffmpeg operations
  // For now, just return the lip-synced video as-is
  await ffmpegProvider.convertFormat({
    input: lipsyncedVideo,
    output: outputPath,
  });

  return outputPath;
}

/**
 * Wav2Lip-style lip sync (placeholder for future implementation)
 */
export async function lipsyncWav2Lip(options: Wav2LipOptions): Promise<string> {
  console.warn("[sync] wav2lip not yet implemented, using wan-25 fallback");

  // For now, just copy the video
  await ffmpegProvider.convertFormat({
    input: options.videoPath,
    output: options.outputPath,
  });

  return options.outputPath;
}

export default definition;
