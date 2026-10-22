/**
 * Kling 4.0 — Kuaishou's latest video generation model on fal
 *
 * Kling 4.0 generates video at 720p or 1080p, 3-30 seconds, with multi-shot
 * prompts, up to 7 reference elements, 10 keyframes, and video editing.
 * Flash variant: 720p only, 3-20 seconds, no end frame / keyframes / edit.
 *
 * Six modes (separate model definitions, each maps to one fal endpoint):
 * - kling-v4                        t2v + i2v (start/end frame), multi-shot
 * - kling-v4-flash                  t2v + i2v (start frame only), fast 720p
 * - kling-v4-reference-to-video     images/elements → video with consistency
 * - kling-v4-flash-reference-to-video  flash variant of reference mode
 * - kling-v4-keyframes-to-video     keyframes (up to 10) + native audio
 * - kling-v4-video-edit              video editing from source video
 *
 * fal model IDs: fal-ai/kling-video/v4/{text-to-video,image-to-video,...}
 * Pricing: $0.157/s at 720p, $0.235/s at 1080p (fal list, default 5% markup)
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// ─── shared schemas ──────────────────────────────────────────────────────────

const v4DurationSchema = z
  .number()
  .int()
  .min(3)
  .max(30)
  .default(5)
  .describe("Video duration in seconds (3–30)");

const v4FlashDurationSchema = z
  .number()
  .int()
  .min(3)
  .max(20)
  .default(5)
  .describe("Video duration in seconds (3–20)");

const v4ResolutionSchema = z
  .enum(["720p", "1080p"])
  .default("1080p")
  .describe("Output resolution");

const v4FlashResolutionSchema = z
  .enum(["720p"])
  .default("720p")
  .describe("Output resolution (Flash is 720p only)");

const v4AspectRatioSchema = z
  .enum(["16:9", "9:16", "1:1", "21:9"])
  .default("16:9")
  .describe("Output aspect ratio");

const v4OutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
});

// ─── 1. kling-v4 (text-to-video + image-to-video) ────────────────────────────

const v4InputSchema = z.object({
  prompt: z
    .string()
    .max(2500)
    .optional()
    .describe(
      "Text prompt. Either prompt or multi_prompt must be provided (multi_prompt via providerOptions.fal).",
    ),
  image_url: z
    .string()
    .url()
    .optional()
    .describe("Image to use as the first frame (enables image-to-video)"),
  end_image_url: z
    .string()
    .url()
    .optional()
    .describe("Image to use as the last frame"),
  duration: v4DurationSchema,
  resolution: v4ResolutionSchema,
  aspect_ratio: v4AspectRatioSchema,
});

const v4Schema: ZodSchema<typeof v4InputSchema, typeof v4OutputSchema> = {
  input: v4InputSchema,
  output: v4OutputSchema,
};

export const klingV4Definition: ModelDefinition<typeof v4Schema> = {
  type: "model",
  name: "kling-v4",
  description:
    "Kling 4.0 by Kuaishou — text-to-video and image-to-video at 720p/1080p, 3-30 seconds. Supports multi-shot prompts, start/end frames, and per-shot duration control.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v4/text-to-video",
  },
  schema: v4Schema,
  pricing: {
    fal: {
      description:
        "$0.157/s at 720p, $0.235/s at 1080p (fal list, default 5% markup)",
      calculate: ({ duration = 5, resolution }) => {
        const rate = resolution === "1080p" ? 0.235 : 0.157;
        return rate * duration;
      },
      minUsd: 0.471, // 3s * $0.157 (720p)
      maxUsd: 7.05, // 30s * $0.235 (1080p)
    },
  },
};

// ─── 2. kling-v4-flash (text-to-video + image-to-video, 720p only) ──────────

const v4FlashInputSchema = z.object({
  prompt: z.string().max(2500).describe("Text prompt for video generation"),
  image_url: z
    .string()
    .url()
    .optional()
    .describe("Image to use as the first frame (enables image-to-video)"),
  duration: v4FlashDurationSchema,
  resolution: v4FlashResolutionSchema,
  aspect_ratio: v4AspectRatioSchema,
});

const v4FlashSchema: ZodSchema<
  typeof v4FlashInputSchema,
  typeof v4OutputSchema
> = {
  input: v4FlashInputSchema,
  output: v4OutputSchema,
};

export const klingV4FlashDefinition: ModelDefinition<typeof v4FlashSchema> = {
  type: "model",
  name: "kling-v4-flash",
  description:
    "Kling 4.0 Flash by Kuaishou — fast 720p drafts, 3-20 seconds from text or a start frame. No end frame, keyframes, or edit mode.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v4/flash/text-to-video",
  },
  schema: v4FlashSchema,
  pricing: {
    fal: {
      description: "$0.157/s at 720p (fal list, default 5% markup)",
      calculate: ({ duration = 5 }) => 0.157 * duration,
      minUsd: 0.471, // 3s * $0.157
      maxUsd: 3.14, // 20s * $0.157
    },
  },
};

// ─── 3. kling-v4-reference-to-video ──────────────────────────────────────────

const v4RefInputSchema = z.object({
  prompt: z
    .string()
    .max(2500)
    .optional()
    .describe(
      "Text prompt. Reference elements as @Element1, @Element2, images as @Image1. Elements and voice via providerOptions.fal.",
    ),
  image_urls: z
    .array(z.string().url())
    .max(10)
    .optional()
    .describe("Reference images (up to 10 total with elements)"),
  duration: v4DurationSchema,
  resolution: v4ResolutionSchema,
  aspect_ratio: z
    .enum(["auto", "16:9", "9:16", "1:1", "21:9"])
    .default("auto")
    .describe("Output aspect ratio ('auto' adapts to references)"),
});

const v4RefSchema: ZodSchema<typeof v4RefInputSchema, typeof v4OutputSchema> = {
  input: v4RefInputSchema,
  output: v4OutputSchema,
};

export const klingV4RefDefinition: ModelDefinition<typeof v4RefSchema> = {
  type: "model",
  name: "kling-v4-reference-to-video",
  description:
    "Kling 4.0 reference-to-video — generate video with character/object consistency from reference images, video references, and elements (up to 7). Supports voice binding via providerOptions.fal.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v4/reference-to-video",
  },
  schema: v4RefSchema,
  pricing: {
    fal: {
      description:
        "$0.157/s at 720p, $0.235/s at 1080p (fal list, default 5% markup)",
      calculate: ({ duration = 5, resolution }) => {
        const rate = resolution === "1080p" ? 0.235 : 0.157;
        return rate * duration;
      },
      minUsd: 0.471, // 3s * $0.157
      maxUsd: 7.05, // 30s * $0.235
    },
  },
};

// ─── 4. kling-v4-flash-reference-to-video ────────────────────────────────────

const v4FlashRefInputSchema = z.object({
  prompt: z
    .string()
    .max(2500)
    .optional()
    .describe(
      "Text prompt. Reference elements as @Element1, @Element2. Flash does not accept voice references.",
    ),
  image_urls: z
    .array(z.string().url())
    .max(10)
    .optional()
    .describe("Reference images (up to 10 total with elements)"),
  duration: v4FlashDurationSchema,
  resolution: v4FlashResolutionSchema,
  aspect_ratio: z
    .enum(["auto", "16:9", "9:16", "1:1", "21:9"])
    .default("auto")
    .describe("Output aspect ratio ('auto' adapts to references)"),
});

const v4FlashRefSchema: ZodSchema<
  typeof v4FlashRefInputSchema,
  typeof v4OutputSchema
> = {
  input: v4FlashRefInputSchema,
  output: v4OutputSchema,
};

export const klingV4FlashRefDefinition: ModelDefinition<
  typeof v4FlashRefSchema
> = {
  type: "model",
  name: "kling-v4-flash-reference-to-video",
  description:
    "Kling 4.0 Flash reference-to-video — fast 720p drafts from reference images and elements (up to 7). No voice references.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v4/flash/reference-to-video",
  },
  schema: v4FlashRefSchema,
  pricing: {
    fal: {
      description: "$0.157/s at 720p (fal list, default 5% markup)",
      calculate: ({ duration = 5 }) => 0.157 * duration,
      minUsd: 0.471, // 3s * $0.157
      maxUsd: 3.14, // 20s * $0.157
    },
  },
};

// ─── 5. kling-v4-keyframes-to-video ─────────────────────────────────────────

const v4KeyframesInputSchema = z.object({
  prompt: z
    .string()
    .max(2500)
    .describe("Text prompt describing the motion between keyframes"),
  image_url: z
    .string()
    .url()
    .optional()
    .describe(
      "First keyframe image (use providerOptions.fal.keyframes for full keyframe array with time)",
    ),
  duration: z
    .number()
    .int()
    .min(3)
    .max(30)
    .default(10)
    .describe("Video duration in seconds (3–30)"),
  resolution: v4ResolutionSchema,
  aspect_ratio: v4AspectRatioSchema,
  generate_audio: z
    .boolean()
    .default(false)
    .describe("Whether to generate native audio"),
});

const v4KeyframesSchema: ZodSchema<
  typeof v4KeyframesInputSchema,
  typeof v4OutputSchema
> = {
  input: v4KeyframesInputSchema,
  output: v4OutputSchema,
};

export const klingV4KeyframesDefinition: ModelDefinition<
  typeof v4KeyframesSchema
> = {
  type: "model",
  name: "kling-v4-keyframes-to-video",
  description:
    "Kling 4.0 keyframes-to-video — generate video from 2-10 ordered keyframe images with native audio. Keyframes passed via providerOptions.fal.keyframes, voices via providerOptions.fal.voice_ids.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v4/keyframes-to-video",
  },
  schema: v4KeyframesSchema,
  pricing: {
    fal: {
      description:
        "$0.157/s at 720p, $0.235/s at 1080p (fal list, default 5% markup)",
      calculate: ({ duration = 10, resolution }) => {
        const rate = resolution === "1080p" ? 0.235 : 0.157;
        return rate * duration;
      },
      minUsd: 0.471, // 3s * $0.157
      maxUsd: 7.05, // 30s * $0.235
    },
  },
};

// ─── 6. kling-v4-video-edit ─────────────────────────────────────────────────

const v4EditInputSchema = z.object({
  prompt: z
    .string()
    .max(2500)
    .describe(
      "Text prompt describing the edit. Reference the source video as @Video1, elements as @Element1.",
    ),
  video_url: z
    .string()
    .url()
    .describe("The video to edit (3-30s, referenced as @Video1)"),
  image_urls: z
    .array(z.string().url())
    .optional()
    .describe("Reference images for the edit"),
  duration: z
    .number()
    .int()
    .min(3)
    .max(30)
    .optional()
    .describe("Output duration in seconds (3-30). Defaults to source length."),
  resolution: v4ResolutionSchema,
});

const v4EditSchema: ZodSchema<typeof v4EditInputSchema, typeof v4OutputSchema> =
  {
    input: v4EditInputSchema,
    output: v4OutputSchema,
  };

export const klingV4EditDefinition: ModelDefinition<typeof v4EditSchema> = {
  type: "model",
  name: "kling-v4-video-edit",
  description:
    "Kling 4.0 video editing — edit a source video guided by a text prompt and optional reference images/elements. Duration defaults to source length (max 30s).",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v4/video-to-video/edit",
  },
  schema: v4EditSchema,
  pricing: {
    fal: {
      description:
        "$0.157/s at 720p, $0.235/s at 1080p (fal list, default 5% markup). Duration defaults to source length, capped at 30s.",
      calculate: ({ duration = 5, resolution }) => {
        const rate = resolution === "1080p" ? 0.235 : 0.157;
        return rate * duration;
      },
      minUsd: 0.471, // 3s * $0.157
      maxUsd: 7.05, // 30s * $0.235
    },
  },
};

// ─── exports ─────────────────────────────────────────────────────────────────

export const allKlingV4Definitions = [
  klingV4Definition,
  klingV4FlashDefinition,
  klingV4RefDefinition,
  klingV4FlashRefDefinition,
  klingV4KeyframesDefinition,
  klingV4EditDefinition,
];

export default klingV4Definition;
