/**
 * Lip sync action
 * Audio-to-video synchronization
 */

import type { ActionDefinition } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { ffmpegProvider } from "../../providers/ffmpeg";

export const definition: ActionDefinition = {
  type: "action",
  name: "sync",
  description: "Lip sync audio to video/image",
  schema: {
    input: {
      type: "object",
      required: ["image", "audio", "prompt"],
      properties: {
        image: {
          type: "string",
          format: "file-path",
          description: "Input image",
        },
        audio: {
          type: "string",
          format: "file-path",
          description: "Audio file",
        },
        prompt: { type: "string", description: "Description of the scene" },
        duration: {
          type: "string",
          enum: ["5", "10"],
          default: "5",
          description: "Output duration",
        },
        resolution: {
          type: "string",
          enum: ["480p", "720p", "1080p"],
          default: "480p",
          description: "Output resolution",
        },
      },
    },
    output: {
      type: "string",
      format: "url",
      description: "Generated video URL",
    },
  },
  routes: [],
  execute: async (inputs) => {
    const { image, audio, prompt, duration, resolution } =
      inputs as unknown as LipsyncOptions;
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
  const { originalVideo, lipsyncedVideo, outputPath } = options;

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
