/**
 * Wan-25 lip sync model
 * Audio-driven video generation with lip sync
 */

import { z } from "zod";
import {
  resolutionSchema,
  videoDurationStringSchema,
} from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const wanInputSchema = z.object({
  prompt: z.string().describe("Scene description"),
  image_url: z.string().url().describe("Input image of the character"),
  audio_url: z.string().url().describe("Audio file for lip sync"),
  duration: videoDurationStringSchema
    .default("5")
    .describe("Video duration in seconds"),
  resolution: resolutionSchema.default("480p").describe("Output resolution"),
  negative_prompt: z
    .string()
    .optional()
    .describe("What to avoid in generation"),
});

// Output schema with Zod
const wanOutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
});

// Schema object for the definition
const schema: ZodSchema<typeof wanInputSchema, typeof wanOutputSchema> = {
  input: wanInputSchema,
  output: wanOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "wan",
  description: "Wan-25 model for audio-driven video generation with lip sync",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/wan-25-preview/image-to-video",
    replicate: "wan-video/wan-2.5-i2v",
  },
  schema,
  pricing: {
    fal: {
      description:
        "$0.05/sec (480p), $0.10/sec (720p), $0.15/sec (1080p) via fal",
      calculate: ({ duration = 5, resolution }) => {
        const rateMap: Record<string, number> = {
          "480p": 0.05,
          "720p": 0.1,
          "1080p": 0.15,
        };
        const rate = rateMap[resolution ?? "480p"] ?? 0.05;
        return rate * duration;
      },
      minUsd: 0.25, // 5s * $0.05 (480p)
      maxUsd: 1.5, // 10s * $0.15 (1080p)
    },
  },
};

export default definition;
