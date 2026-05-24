/**
 * Kling video generation model
 * High-quality video generation from text/image
 */

import { z } from "zod";
import {
  aspectRatioSchema,
  videoDurationSchema,
} from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const klingInputSchema = z.object({
  prompt: z.string().describe("Text description of the video"),
  image_url: z
    .string()
    .url()
    .optional()
    .describe("Input image for image-to-video"),
  duration: videoDurationSchema
    .default(5)
    .describe("Video duration in seconds"),
  aspect_ratio: aspectRatioSchema
    .default("16:9")
    .describe("Output aspect ratio"),
});

// Output schema with Zod
const klingOutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
});

// Schema object for the definition
const schema: ZodSchema<typeof klingInputSchema, typeof klingOutputSchema> = {
  input: klingInputSchema,
  output: klingOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "kling",
  description:
    "Kling video generation model for high-quality video from text or image",
  providers: ["fal", "replicate", "magnific"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/o3/pro",
    replicate: "fofr/kling-v1.5",
    magnific: "ai/video/kling-v3-pro",
  },
  schema,
  pricing: {
    fal: {
      description: "Kling O3 Pro: $0.112/sec (audio off), $0.14/sec (audio on)",
      calculate: ({ duration = 5, generateAudio = false }) => {
        const rate = generateAudio ? 0.14 : 0.112;
        return rate * duration;
      },
      minUsd: 0.336, // 3s * $0.112 (audio off)
      maxUsd: 2.1, // 15s * $0.14 (audio on)
    },
  },
};

// ---------------------------------------------------------------------------
// Kling O3 4K — native 4K output (image-to-video)
// ---------------------------------------------------------------------------

const kling4kInputSchema = z.object({
  prompt: z.string().describe("Text description guiding the video generation"),
  image_url: z.string().url().describe("URL of the start frame image"),
  end_image_url: z
    .string()
    .url()
    .optional()
    .describe("URL of the end frame image (optional)"),
  duration: z
    .number()
    .int()
    .min(3)
    .max(15)
    .default(5)
    .describe("Video duration in seconds (3–15)"),
  generate_audio: z
    .boolean()
    .default(false)
    .describe("Whether to generate native audio"),
});

const kling4kSchema: ZodSchema<
  typeof kling4kInputSchema,
  typeof klingOutputSchema
> = {
  input: kling4kInputSchema,
  output: klingOutputSchema,
};

export const kling4kDefinition: ModelDefinition<typeof kling4kSchema> = {
  type: "model",
  name: "kling-v3-4k-image-to-video",
  description:
    "Kling O3 4K — native 4K video output from image, no upscaling needed",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/o3/4k/image-to-video",
  },
  schema: kling4kSchema,
  pricing: {
    fal: {
      description: "Kling O3 4K: $0.42/sec regardless of audio",
      calculate: ({ duration = 5 }) => 0.42 * duration,
      minUsd: 1.26, // 3s
      maxUsd: 6.3, // 15s
    },
  },
};

// ---------------------------------------------------------------------------
// Kling O3 Reference-to-Video (Pro) — images/elements → video with consistency
// ---------------------------------------------------------------------------

const klingRefInputSchema = z.object({
  prompt: z
    .string()
    .optional()
    .describe(
      "Text prompt for video generation. Reference elements as @Element1, @Element2",
    ),
  start_image_url: z
    .string()
    .url()
    .optional()
    .describe("Image to use as the first frame"),
  end_image_url: z
    .string()
    .url()
    .optional()
    .describe("Image to use as the last frame"),
  image_urls: z
    .array(z.string().url())
    .max(7)
    .optional()
    .describe(
      "Reference images for style/appearance. Reference in prompt as @Image1, @Image2. Max 7 total (elements + images)",
    ),
  duration: z
    .number()
    .int()
    .min(3)
    .max(15)
    .default(5)
    .describe("Video duration in seconds (3–15)"),
  aspect_ratio: aspectRatioSchema
    .default("16:9")
    .describe("Output aspect ratio"),
  generate_audio: z
    .boolean()
    .default(false)
    .describe("Whether to generate native audio"),
});

const klingRefSchema: ZodSchema<
  typeof klingRefInputSchema,
  typeof klingOutputSchema
> = {
  input: klingRefInputSchema,
  output: klingOutputSchema,
};

export const klingRefDefinition: ModelDefinition<typeof klingRefSchema> = {
  type: "model",
  name: "kling-v3-pro-reference-to-video",
  description:
    "Kling O3 Pro reference-to-video — generate video with character/object consistency from reference images and elements",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/o3/pro/reference-to-video",
  },
  schema: klingRefSchema,
  pricing: {
    fal: {
      description:
        "Kling O3 Pro ref: $0.112/sec (audio off), $0.14/sec (audio on)",
      calculate: ({ duration = 5, generateAudio = false }) => {
        const rate = generateAudio ? 0.14 : 0.112;
        return rate * duration;
      },
      minUsd: 0.336, // 3s * $0.112
      maxUsd: 2.1, // 15s * $0.14
    },
  },
};

// ---------------------------------------------------------------------------
// Kling O3 4K Reference-to-Video — 4K reference-to-video
// ---------------------------------------------------------------------------

export const kling4kRefDefinition: ModelDefinition<typeof klingRefSchema> = {
  type: "model",
  name: "kling-v3-4k-reference-to-video",
  description:
    "Kling O3 4K reference-to-video — native 4K video with character/object consistency from reference images and elements",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/o3/4k/reference-to-video",
  },
  schema: klingRefSchema,
  pricing: {
    fal: {
      description: "Kling O3 4K ref: $0.42/sec regardless of audio",
      calculate: ({ duration = 5 }) => 0.42 * duration,
      minUsd: 1.26, // 3s
      maxUsd: 6.3, // 15s
    },
  },
};

// ---------------------------------------------------------------------------
// Kling O3 Video-to-Video Reference (Standard) — v2v preserving motion/camera
// ---------------------------------------------------------------------------

const klingV2VRefInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Text prompt for video generation. Reference video as @Video1, elements as @Element1",
    ),
  video_url: z
    .string()
    .url()
    .describe(
      "Reference video URL. Only .mp4/.mov, 3–10s duration, 720–2160px resolution, max 200MB",
    ),
  image_urls: z
    .array(z.string().url())
    .max(4)
    .optional()
    .describe(
      "Reference images for style/appearance. Max 4 total (elements + images) when using video",
    ),
  keep_audio: z
    .boolean()
    .default(true)
    .describe("Whether to keep the original audio from the reference video"),
  duration: z
    .number()
    .int()
    .min(3)
    .max(15)
    .optional()
    .describe("Video duration in seconds (3–15)"),
  aspect_ratio: z
    .enum(["auto", "16:9", "9:16", "1:1"])
    .default("auto")
    .describe("Output aspect ratio"),
});

const klingV2VRefSchema: ZodSchema<
  typeof klingV2VRefInputSchema,
  typeof klingOutputSchema
> = {
  input: klingV2VRefInputSchema,
  output: klingOutputSchema,
};

export const klingV2VRefDefinition: ModelDefinition<typeof klingV2VRefSchema> =
  {
    type: "model",
    name: "kling-v3-standard-v2v-reference",
    description:
      "Kling O3 video-to-video reference — generate new video guided by reference video, preserving motion and camera style",
    providers: ["fal"],
    defaultProvider: "fal",
    providerModels: {
      fal: "fal-ai/kling-video/o3/standard/video-to-video/reference",
    },
    schema: klingV2VRefSchema,
    pricing: {
      fal: {
        description: "Kling O3 Standard v2v ref: $0.126/sec",
        calculate: ({ duration = 5 }) => 0.126 * duration,
        minUsd: 0.378, // 3s
        maxUsd: 1.89, // 15s
      },
    },
  };

// ---------------------------------------------------------------------------
// Kling V3 Motion Control — transfer motion from reference video to character image
// ---------------------------------------------------------------------------

const klingV3MotionInputSchema = z.object({
  prompt: z.string().optional().describe("Text prompt for video generation"),
  image_url: z
    .string()
    .url()
    .describe(
      "Reference image URL. Characters should have clear body proportions, avoid occlusion, and occupy >5% of image area",
    ),
  video_url: z
    .string()
    .url()
    .describe(
      "Reference video URL for motion transfer. Max 10s with character_orientation 'image', max 30s with 'video'",
    ),
  character_orientation: z
    .enum(["image", "video"])
    .default("video")
    .describe(
      "'video': orientation matches reference video, better for complex motions (max 30s). 'image': orientation matches reference image, better for camera movements (max 10s)",
    ),
  keep_original_sound: z
    .boolean()
    .default(true)
    .describe("Whether to keep the original sound from the reference video"),
});

const klingV3MotionSchema: ZodSchema<
  typeof klingV3MotionInputSchema,
  typeof klingOutputSchema
> = {
  input: klingV3MotionInputSchema,
  output: klingOutputSchema,
};

export const klingV3MotionDefinition: ModelDefinition<
  typeof klingV3MotionSchema
> = {
  type: "model",
  name: "kling-v3-pro-motion-control",
  description:
    "Kling V3 Pro motion control — transfer movements from reference video to any character image. Supports up to 30s with video orientation",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v3/pro/motion-control",
  },
  schema: klingV3MotionSchema,
  pricing: {
    fal: {
      description: "Kling V3 Pro motion control: $0.168/sec",
      calculate: ({ inputDuration = 5 }) => 0.168 * inputDuration,
      minUsd: 0.504, // 3s
      maxUsd: 5.04, // 30s
    },
  },
};

export const klingV3MotionStdDefinition: ModelDefinition<
  typeof klingV3MotionSchema
> = {
  type: "model",
  name: "kling-v3-standard-motion-control",
  description:
    "Kling V3 Standard motion control — cost-effective motion transfer from reference video to character image. Supports up to 30s with video orientation",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v3/standard/motion-control",
  },
  schema: klingV3MotionSchema,
  pricing: {
    fal: {
      description: "Kling V3 Standard motion control: $0.126/sec",
      calculate: ({ inputDuration = 5 }) => 0.126 * inputDuration,
      minUsd: 0.378, // 3s
      maxUsd: 3.78, // 30s
    },
  },
};

export default definition;
