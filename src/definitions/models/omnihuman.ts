/**
 * Bytedance OmniHuman v1.5
 * Image + audio -> video (full-body human animation)
 */

import { z } from "zod";
import { urlSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

const omnihumanResolutionSchema = z
  .enum(["720p", "1080p"])
  .describe("Output resolution");

// Input schema with Zod
const omnihumanInputSchema = z.object({
  prompt: z
    .string()
    .optional()
    .describe("The text prompt used to guide the video generation"),
  image_url: urlSchema.describe(
    "The URL of the image used to generate the video",
  ),
  audio_url: urlSchema.describe(
    "The URL of the audio file to generate the video",
  ),
  turbo_mode: z
    .boolean()
    .optional()
    .default(false)
    .describe("Faster generation with slight quality trade-off"),
  resolution: omnihumanResolutionSchema
    .optional()
    .default("1080p")
    .describe(
      "The resolution of the generated video. 720p generation is faster and higher in quality",
    ),
});

// Output schema with Zod
const omnihumanOutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
  duration: z
    .number()
    .optional()
    .describe("Duration of audio input/video output as used for billing"),
});

const schema: ZodSchema<
  typeof omnihumanInputSchema,
  typeof omnihumanOutputSchema
> = {
  input: omnihumanInputSchema,
  output: omnihumanOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "omnihuman",
  description:
    "OmniHuman v1.5 - generate a vivid talking video from an image and an audio file",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/bytedance/omnihuman/v1.5",
  },
  schema,
  pricing: {
    fal: {
      description: "$0.16 per second of output video via fal",
      calculate: ({ duration = 5 }) => 0.16 * duration,
      minUsd: 0.48, // ~3s minimum
      maxUsd: 9.6, // 60s at 720p max
    },
  },
};

export default definition;
