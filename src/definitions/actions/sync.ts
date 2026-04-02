/**
 * Lip sync action
 * Audio-to-video synchronization
 */

import { z } from "zod";
import {
  filePathSchema,
  resolutionSchema,
  videoDurationStringSchema,
} from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { ffmpegProvider } from "../../providers/ffmpeg";

// Input schema with Zod
const syncInputSchema = z.object({
  model: z
    .enum(["wan-25", "omnihuman-v1.5", "veed-fabric-1.0", "ltx-2-a2v"])
    .optional()
    .default("wan-25")
    .describe("Lip sync / avatar backend model"),
  image: filePathSchema
    .optional()
    .describe("Input image (optional for ltx-2-a2v)"),
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
    const { model, image, audio, prompt, duration, resolution } = inputs;
    return lipsync({ model, image, audio, prompt, duration, resolution });
  },
};

// Types
export interface LipsyncOptions {
  model?: "wan-25" | "omnihuman-v1.5" | "veed-fabric-1.0" | "ltx-2-a2v";
  image?: string;
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
 * Generate lip-synced / avatar video using selected backend.
 */
export async function lipsync(options: LipsyncOptions): Promise<LipsyncResult> {
  const {
    model = "wan-25",
    image,
    audio,
    prompt,
    duration = "5",
    resolution = "480p",
  } = options;

  console.log(`[sync] generating lip-synced video with ${model}...`);

  if (model !== "ltx-2-a2v" && !image) {
    throw new Error(`[sync] ${model} requires an input image`);
  }

  if (model === "omnihuman-v1.5" && resolution === "480p") {
    console.warn(
      "[sync] omnihuman-v1.5 does not support 480p; using 720p instead",
    );
  }
  if (model === "veed-fabric-1.0" && resolution === "1080p") {
    console.warn(
      "[sync] veed-fabric-1.0 does not support 1080p; using 720p instead",
    );
  }

  const result =
    model === "ltx-2-a2v"
      ? await falProvider.ltx2AudioToVideo({
          prompt,
          audioUrl: audio,
          ...(image ? { imageUrl: image } : {}),
        })
      : model === "omnihuman-v1.5"
        ? await falProvider.omnihuman15({
            imageUrl: image!,
            audioUrl: audio,
            prompt,
            resolution: (resolution === "480p" ? "720p" : resolution) as
              | "720p"
              | "1080p",
          })
        : model === "veed-fabric-1.0"
          ? await falProvider.veedFabric10({
              imageUrl: image!,
              audioUrl: audio,
              resolution: (resolution === "1080p" ? "720p" : resolution) as
                | "480p"
                | "720p",
            })
          : await falProvider.wan25({
              imageUrl: image!,
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
