/**
 * Bytedance OmniHuman — v1.5 and v2.0
 * Image + audio -> video (full-body human animation)
 *
 * v2.0: up to 5 min (300s), understands tone/emotion, $0.07/sec (40% cheaper
 * than v1.5's $0.12/sec). Optional text prompt for scene/camera control.
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

// Input schema with Zod (shared by v1.5 and v2 — v2 drops turbo_mode)
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
    .describe("Faster generation with slight quality trade-off (v1.5 only)"),
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

// ── v1.5 ──────────────────────────────────────────────────────────────────────

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

// ── v2.0 ──────────────────────────────────────────────────────────────────────
// Up to 5 min (300s) in a single continuous shot, understands tone/emotion,
// 40%+ cheaper ($0.07/sec vs v1.5's $0.12/sec).

export const v2Definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "omnihuman_v2",
  description:
    "OmniHuman v2.0 - understands your audio (tone, emotion, every word) and performs it. Up to 5 min continuous shot, 40%+ cheaper than v1.5",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/bytedance/omnihuman/v2",
  },
  schema,
  pricing: {
    fal: {
      description:
        "$0.07 per second of output video via fal (40%+ cheaper than v1.5)",
      calculate: ({ duration = 5 }) => 0.07 * duration,
      minUsd: 0.28, // ~4s minimum
      maxUsd: 21.0, // 300s max
    },
  },
};

export default definition;
