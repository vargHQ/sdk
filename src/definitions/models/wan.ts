/**
 * Wan-25 lip sync model
 * Audio-driven video generation with lip sync
 */

import { z } from "zod";
import {
  resolutionSchema,
  videoDurationStringSchema,
} from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

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
};

export default definition;
