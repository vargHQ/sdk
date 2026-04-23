/**
 * Nano Banana 2 image model (Google's next-gen image generation/editing)
 * Supports both text-to-image (no images) and image editing (with image_urls)
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Nano Banana 2 resolution options (includes 0.5K unlike nano-banana-pro)
const nanoBanana2ResolutionSchema = z.enum(["0.5K", "1K", "2K", "4K"]);

// Nano Banana 2 aspect ratio options (supports "auto" unlike nano-banana-pro)
const nanoBanana2AspectRatioSchema = z.enum([
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
const nanoBanana2OutputFormatSchema = z.enum(["png", "jpeg", "webp"]);

// Safety tolerance level (string enum "1"-"6", unlike nano-banana-pro's semantic filter)
const nanoBanana2SafetyToleranceSchema = z.enum(["1", "2", "3", "4", "5", "6"]);

// Input schema with Zod
const nanoBanana2InputSchema = z.object({
  prompt: z.string().describe("Text description for image editing"),
  image_urls: z
    .array(z.string().url())
    .optional()
    .describe(
      "Input image URLs for image editing. When provided, routes to the /edit endpoint. Omit for text-to-image generation.",
    ),
  resolution: nanoBanana2ResolutionSchema
    .default("1K")
    .describe(
      "Output resolution: 0.5K (512px), 1K (1024px), 2K (2048px), or 4K",
    ),
  aspect_ratio: nanoBanana2AspectRatioSchema
    .default("auto")
    .describe("Output aspect ratio. 'auto' preserves input aspect ratio."),
  output_format: nanoBanana2OutputFormatSchema
    .default("png")
    .describe("Output image format"),
  safety_tolerance: nanoBanana2SafetyToleranceSchema
    .default("4")
    .describe("Safety tolerance level: 1 (most strict) to 6 (least strict)"),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
  seed: z
    .number()
    .int()
    .optional()
    .describe("Seed for the random number generator"),
  limit_generations: z
    .boolean()
    .default(true)
    .describe(
      "Limit generations from each round of prompting to 1. May affect quality.",
    ),
  enable_web_search: z
    .boolean()
    .default(false)
    .describe(
      "Enable web search to use latest information for image generation",
    ),
});

// Output schema with Zod
const nanoBanana2OutputSchema = z.object({
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
  typeof nanoBanana2InputSchema,
  typeof nanoBanana2OutputSchema
> = {
  input: nanoBanana2InputSchema,
  output: nanoBanana2OutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "nano-banana-2",
  description:
    "Google Nano Banana 2 - next-gen image generation and editing model. Supports text-to-image and image editing (with image_urls).",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/nano-banana-2",
  },
  schema,
  pricing: {
    fal: {
      description:
        "$0.08/image (1K), $0.06 (0.5K), $0.12 (2K), $0.16 (4K) via fal. Web search +$0.015, high thinking +$0.002.",
      calculate: ({ numImages = 1, resolution }) => {
        const rateMap: Record<string, number> = {
          "0.5K": 0.06,
          "1K": 0.08,
          "2K": 0.12,
          "4K": 0.16,
        };
        const rate = rateMap[resolution ?? "1K"] ?? 0.08;
        return rate * numImages;
      },
      minUsd: 0.06, // 1 image at 0.5K
      maxUsd: 0.64, // 4 images at 4K
    },
  },
};

export default definition;
