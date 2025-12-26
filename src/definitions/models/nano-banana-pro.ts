/**
 * Nano Banana Pro image generation model (Google Gemini 3 Pro Image)
 * High-quality image generation and editing from text or images
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Nano Banana Pro resolution options
const nanoBananaResolutionSchema = z.enum(["1K", "2K", "4K"]);

// Nano Banana Pro aspect ratio options
const nanoBananaAspectRatioSchema = z.enum([
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
]);

// Output format options
const nanoBananaOutputFormatSchema = z.enum(["png", "jpeg", "webp"]);

// Safety filter level options
const nanoBananaSafetyFilterSchema = z.enum([
  "block_only_high",
  "block_medium_and_above",
  "block_low_and_above",
  "block_none",
]);

// Input schema with Zod
const nanoBananaProInputSchema = z.object({
  prompt: z
    .string()
    .describe("Text description for image generation or editing"),
  image_urls: z
    .array(z.string().url())
    .optional()
    .describe("Input image URLs for image-to-image editing (up to 14 images)"),
  resolution: nanoBananaResolutionSchema
    .default("1K")
    .describe("Output resolution: 1K (1024px), 2K (2048px), or 4K"),
  aspect_ratio: nanoBananaAspectRatioSchema
    .default("auto")
    .describe("Output aspect ratio"),
  output_format: nanoBananaOutputFormatSchema
    .default("png")
    .describe("Output image format"),
  safety_filter_level: nanoBananaSafetyFilterSchema
    .default("block_only_high")
    .describe("Safety filter strictness level"),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
});

// Output schema with Zod
const nanoBananaProOutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      file_name: z.string().optional(),
      content_type: z.string().optional(),
    }),
  ),
  description: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof nanoBananaProInputSchema,
  typeof nanoBananaProOutputSchema
> = {
  input: nanoBananaProInputSchema,
  output: nanoBananaProOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "nano-banana-pro",
  description:
    "Google Nano Banana Pro (Gemini 3 Pro Image) for high-quality image generation and editing. Supports text-to-image and image-to-image with semantic understanding.",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/nano-banana-pro",
    replicate: "google/nano-banana-pro",
  },
  schema,
};

export default definition;
