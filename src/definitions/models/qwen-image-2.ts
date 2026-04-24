/**
 * Qwen Image 2 generation and editing model
 * Next-generation unified generation-and-editing model from Alibaba
 * Supports both text-to-image and image-to-image editing
 * Available in standard and pro tiers
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Image size can be an enum string or an object with width/height
const qwenImage2ImageSizeSchema = z.union([
  z.enum([
    "square_hd",
    "square",
    "landscape_4_3",
    "landscape_16_9",
    "portrait_4_3",
    "portrait_16_9",
  ]),
  z.object({
    width: z.number().int().min(512).max(2048),
    height: z.number().int().min(512).max(2048),
  }),
]);

// Output format options
const qwenImage2OutputFormatSchema = z.enum(["png", "jpeg", "webp"]);

// Input schema with Zod
const qwenImage2InputSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Text description for generation or editing. Supports Chinese and English.",
    ),
  negative_prompt: z
    .string()
    .default("")
    .describe("Content to avoid in the generated image. Max 500 characters."),
  image_size: qwenImage2ImageSizeSchema
    .optional()
    .describe(
      "Output image size. Can be an enum (e.g. 'square_hd') or {width, height} object. Pixels must be between 512x512 and 2048x2048.",
    ),
  image_urls: z
    .array(z.string().url())
    .optional()
    .describe(
      "Reference images for editing (1-6 images). Order matters: reference as 'image 1', 'image 2' in prompt. Required for /edit endpoints.",
    ),
  enable_prompt_expansion: z
    .boolean()
    .default(true)
    .describe("Enable LLM prompt optimization for better results"),
  seed: z
    .number()
    .int()
    .min(0)
    .max(2147483647)
    .optional()
    .describe("Random seed for reproducibility"),
  enable_safety_checker: z
    .boolean()
    .default(true)
    .describe("Enable content moderation for input and output"),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(6)
    .default(1)
    .describe("Number of images to generate (1-4 for t2i, 1-6 for edit)"),
  output_format: qwenImage2OutputFormatSchema
    .default("png")
    .describe("Output image format"),
});

// Output schema with Zod
const qwenImage2OutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      file_name: z.string().optional(),
      content_type: z.string().optional(),
    }),
  ),
  seed: z.number().int().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof qwenImage2InputSchema,
  typeof qwenImage2OutputSchema
> = {
  input: qwenImage2InputSchema,
  output: qwenImage2OutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "qwen-image-2",
  description:
    "Qwen Image 2.0 - next-gen unified generation-and-editing model. Supports text-to-image and image-to-image editing in standard and pro tiers.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/qwen-image-2/text-to-image",
  },
  schema,
  pricing: {
    fal: {
      description:
        "$0.035 per image via fal (standard). Pro endpoint: $0.075/image.",
      calculate: ({ numImages = 1 }) => 0.035 * numImages,
      minUsd: 0.035, // 1 image
      maxUsd: 0.21, // 6 images
    },
  },
};

export default definition;
