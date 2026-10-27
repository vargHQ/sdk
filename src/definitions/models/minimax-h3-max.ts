/**
 * MiniMax H3 Max — post-trained variant of MiniMax H3 on fal
 * Tuned for stronger prompt adherence and better aesthetics, co-optimized
 * with fal's custom inference stack for higher throughput.
 *
 * Three modes (separate model definitions, each maps to one fal endpoint):
 * - minimax-h3-max-text-to-video    t2v from prompt, 5-15s, 480P/768P, 7 aspect ratios
 * - minimax-h3-max-image-to-video   i2v from start image (or start+end keyframe), 5-15s
 * - minimax-h3-max-reference-to-video  r2v from multimodal references (images, video, audio)
 *
 * fal model IDs: minimax/h3-max/{text-to-video,image-to-video,reference-to-video}
 * Pricing: $0.05/sec at 480P, $0.08/sec at 768P (regular rates from 2026-09-01)
 * r2v: $0.08/sec flat + reference token surcharges (first 4096 tokens free, then $0.02/1K)
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// ─── shared schemas ──────────────────────────────────────────────────────────

const h3MaxDurationSchema = z
  .number()
  .int()
  .min(5)
  .max(15)
  .default(5)
  .describe("Video duration in seconds (5–15)");

const h3MaxResolutionSchema = z
  .enum(["480P", "768P"])
  .default("768P")
  .describe("Native generation resolution");

const h3MaxAspectRatioSchema = z
  .enum(["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])
  .default("16:9")
  .describe("Output aspect ratio");

const promptExpansionModeSchema = z
  .enum(["balanced", "quality"])
  .default("balanced")
  .describe(
    "Prompt rewriting effort: 'balanced' (~1s) or 'quality' (~30s for a richer prompt)",
  );

const h3MaxOutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
});

// ─── 1. text-to-video ────────────────────────────────────────────────────────

const t2vInputSchema = z.object({
  prompt: z.string().describe("Text prompt for video generation"),
  duration: h3MaxDurationSchema,
  resolution: h3MaxResolutionSchema,
  aspect_ratio: h3MaxAspectRatioSchema,
  prompt_expansion_mode: promptExpansionModeSchema,
  seed: z.number().int().optional().describe("Random seed (omit for random)"),
});

const t2vSchema: ZodSchema<typeof t2vInputSchema, typeof h3MaxOutputSchema> = {
  input: t2vInputSchema,
  output: h3MaxOutputSchema,
};

export const textToVideoDefinition: ModelDefinition<typeof t2vSchema> = {
  type: "model",
  name: "minimax-h3-max-text-to-video",
  description:
    "MiniMax H3 Max text-to-video — post-trained H3 variant tuned for stronger prompt adherence and better aesthetics. 480P/768P from a text prompt, 5-15s, seven aspect ratios.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "minimax/h3-max/text-to-video",
  },
  schema: t2vSchema,
  pricing: {
    fal: {
      description:
        "$0.05/sec at 480P, $0.08/sec at 768P (regular rates from 2026-09-01)",
      calculate: ({ duration = 5, resolution }) => {
        const rate = resolution === "480P" ? 0.05 : 0.08;
        return rate * duration;
      },
      minUsd: 0.25, // 5s * $0.05 (480P)
      maxUsd: 1.2, // 15s * $0.08 (768P)
    },
  },
};

// ─── 2. image-to-video ───────────────────────────────────────────────────────

const i2vInputSchema = z.object({
  prompt: z.string().describe("Text prompt for video generation"),
  image_url: z
    .string()
    .url()
    .describe(
      "URL of the image to use as the first frame (output aspect ratio follows this image)",
    ),
  end_image_url: z
    .string()
    .url()
    .optional()
    .describe(
      "URL of the image to use as the last frame (first-to-last keyframe generation)",
    ),
  duration: h3MaxDurationSchema,
  resolution: h3MaxResolutionSchema,
  prompt_expansion_mode: promptExpansionModeSchema,
  seed: z.number().int().optional().describe("Random seed (omit for random)"),
});

const i2vSchema: ZodSchema<typeof i2vInputSchema, typeof h3MaxOutputSchema> = {
  input: i2vInputSchema,
  output: h3MaxOutputSchema,
};

export const imageToVideoDefinition: ModelDefinition<typeof i2vSchema> = {
  type: "model",
  name: "minimax-h3-max-image-to-video",
  description:
    "MiniMax H3 Max image-to-video — animates a supplied image into 480P/768P video (first frame, or first+last frame transition). Aspect ratio follows the input image.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "minimax/h3-max/image-to-video",
  },
  schema: i2vSchema,
  pricing: {
    fal: {
      description:
        "$0.05/sec at 480P, $0.08/sec at 768P. Image input free (regular rates from 2026-09-01)",
      calculate: ({ duration = 5, resolution }) => {
        const rate = resolution === "480P" ? 0.05 : 0.08;
        return rate * duration;
      },
      minUsd: 0.25, // 5s * $0.05 (480P)
      maxUsd: 1.2, // 15s * $0.08 (768P)
    },
  },
};

// ─── 3. reference-to-video ───────────────────────────────────────────────────

const r2vAspectRatioSchema = z
  .enum(["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"])
  .default("adaptive")
  .describe("Output aspect ratio ('adaptive' follows the reference content)");

const r2vInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Text prompt. Refer to reference assets by modality and order: Image 1, Image 2, Video 1, Audio 1, etc.",
    ),
  reference_image_urls: z
    .array(z.string().url())
    .max(12)
    .optional()
    .describe(
      "URLs of subject/style reference images, referenced in the prompt as Image 1, Image 2, etc. Total reference files (images + videos + audio) must be at most 12.",
    ),
  reference_video_urls: z
    .array(z.string().url())
    .max(12)
    .optional()
    .describe(
      "URLs of motion/reference video clips (2-15s each, combined duration at most 15s), referenced as Video 1, Video 2, etc.",
    ),
  reference_audio_urls: z
    .array(z.string().url())
    .max(12)
    .optional()
    .describe(
      "URLs of reference audio clips (2-15s each, combined duration at most 15s), referenced as Audio 1, Audio 2, etc. Cannot be the only reference — provide at least one image or video.",
    ),
  duration: h3MaxDurationSchema,
  resolution: h3MaxResolutionSchema,
  aspect_ratio: r2vAspectRatioSchema,
  prompt_expansion_mode: promptExpansionModeSchema,
  seed: z.number().int().optional().describe("Random seed (omit for random)"),
});

const r2vSchema: ZodSchema<typeof r2vInputSchema, typeof h3MaxOutputSchema> = {
  input: r2vInputSchema,
  output: h3MaxOutputSchema,
};

export const referenceToVideoDefinition: ModelDefinition<typeof r2vSchema> = {
  type: "model",
  name: "minimax-h3-max-reference-to-video",
  description:
    "MiniMax H3 Max reference-to-video — 480P/768P video from multimodal references: up to 12 files (images, videos, audio) cited in the prompt by order. Keeps subjects consistent while following referenced motion and audio.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "minimax/h3-max/reference-to-video",
  },
  schema: r2vSchema,
  pricing: {
    fal: {
      description:
        "$0.08/sec flat output. Reference token surcharges: first 4096 tokens free, then $0.02/1K tokens (1024² image = 1K tokens, 2048² image = 4K tokens). Up to 12 ref files.",
      calculate: ({ duration = 5 }) => 0.08 * duration,
      minUsd: 0.4, // 5s * $0.08
      maxUsd: 2.08, // 15s * $0.08 + worst-case ref surcharge (~$0.88)
    },
  },
};

// ─── exports ─────────────────────────────────────────────────────────────────

export const allH3MaxDefinitions = [
  textToVideoDefinition,
  imageToVideoDefinition,
  referenceToVideoDefinition,
];

export default textToVideoDefinition;
