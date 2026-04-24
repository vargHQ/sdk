/**
 * Phota image models — personalized photo generation, editing, and enhancement
 * Three separate models:
 *   - phota: text-to-image with profile-based personalization
 *   - phota/edit: image editing with identity preservation
 *   - phota/enhance: image enhancement with identity preservation
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Shared enums
const photaOutputFormatSchema = z.enum(["jpeg", "png", "webp"]);
const photaResolutionSchema = z.enum(["1K", "4K"]);
const photaAspectRatioSchema = z.enum([
  "auto",
  "1:1",
  "16:9",
  "4:3",
  "3:4",
  "9:16",
]);

// Shared output schema — all three endpoints return { images: [{ url }] }
const photaOutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      file_name: z.string().optional(),
      content_type: z.string().optional(),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Phota — text-to-image
// ---------------------------------------------------------------------------

const photaInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Text description of the desired image. Use @Profile1, @Profile2, etc. to reference profiles.",
    ),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
  profile_ids: z
    .array(z.string())
    .optional()
    .describe(
      "Profile IDs for personalization. Tag them in the prompt as @Profile1, @Profile2, etc.",
    ),
  output_format: photaOutputFormatSchema
    .default("jpeg")
    .describe("Output image format"),
  resolution: photaResolutionSchema
    .default("1K")
    .describe("Output resolution: 1K or 4K"),
  aspect_ratio: photaAspectRatioSchema
    .default("auto")
    .describe("Output aspect ratio"),
});

const photaSchema: ZodSchema<
  typeof photaInputSchema,
  typeof photaOutputSchema
> = {
  input: photaInputSchema,
  output: photaOutputSchema,
};

export const photaDefinition: ModelDefinition<typeof photaSchema> = {
  type: "model",
  name: "phota",
  description:
    "Phota text-to-image — personalized photograph generation with profile-based identity control.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/phota",
  },
  schema: photaSchema,
  pricing: {
    fal: {
      description: "$0.09 per 1K image via fal",
      calculate: ({ numImages = 1 }) => 0.09 * numImages,
      minUsd: 0.09,
      maxUsd: 0.36, // 4 images
    },
  },
};

// ---------------------------------------------------------------------------
// Phota Edit — image-to-image editing
// ---------------------------------------------------------------------------

const photaEditInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Text description of the desired edit. Use @Profile1, @Profile2, etc. to reference profiles.",
    ),
  image_urls: z
    .array(z.string())
    .optional()
    .describe("Image URLs to edit (up to 10 images)"),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
  profile_ids: z
    .array(z.string())
    .optional()
    .describe(
      "Profile IDs for personalization. Tag them in the prompt as @Profile1, @Profile2, etc.",
    ),
  output_format: photaOutputFormatSchema
    .default("jpeg")
    .describe("Output image format"),
  resolution: photaResolutionSchema
    .default("1K")
    .describe("Output resolution: 1K or 4K"),
  aspect_ratio: photaAspectRatioSchema
    .default("auto")
    .describe("Output aspect ratio"),
});

const photaEditSchema: ZodSchema<
  typeof photaEditInputSchema,
  typeof photaOutputSchema
> = {
  input: photaEditInputSchema,
  output: photaOutputSchema,
};

export const photaEditDefinition: ModelDefinition<typeof photaEditSchema> = {
  type: "model",
  name: "phota/edit",
  description:
    "Phota edit — personalized photo editing that preserves identity while erasing distractions.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/phota/edit",
  },
  schema: photaEditSchema,
  pricing: {
    fal: {
      description: "$0.09 per 1K image via fal",
      calculate: ({ numImages = 1 }) => 0.09 * numImages,
      minUsd: 0.09,
      maxUsd: 0.36,
    },
  },
};

// ---------------------------------------------------------------------------
// Phota Enhance — image enhancement with identity preservation
// ---------------------------------------------------------------------------

const photaEnhanceInputSchema = z.object({
  image_url: z
    .string()
    .describe("URL or Base64 data URI of the image to enhance"),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
  profile_ids: z
    .array(z.string())
    .optional()
    .describe(
      "Profile IDs for identity preservation. Sent profiles are used as candidates.",
    ),
  output_format: photaOutputFormatSchema
    .default("jpeg")
    .describe("Output image format"),
});

const photaEnhanceSchema: ZodSchema<
  typeof photaEnhanceInputSchema,
  typeof photaOutputSchema
> = {
  input: photaEnhanceInputSchema,
  output: photaOutputSchema,
};

export const photaEnhanceDefinition: ModelDefinition<
  typeof photaEnhanceSchema
> = {
  type: "model",
  name: "phota/enhance",
  description:
    "Phota enhance — upscale and enhance images while preserving identities.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/phota/enhance",
  },
  schema: photaEnhanceSchema,
  pricing: {
    fal: {
      description: "$0.13 per image via fal",
      calculate: ({ numImages = 1 }) => 0.13 * numImages,
      minUsd: 0.13,
      maxUsd: 0.52,
    },
  },
};

// Default export for the primary text-to-image model
export default photaDefinition;
