/**
 * Ideogram 4.5
 * Posters, logos and designs with accurate typography, plus prompt edits with
 * reference images, an optional mask and a high-precision mode.
 * fal endpoints: ideogram/v4.5 (text-to-image), ideogram/v4.5/edit.
 */

import { z } from "zod";
import { imageSizeSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

const explicitSizeSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// t2i quality: low / medium / high. Edit adds very_low.
const qualitySchema = z.enum(["very_low", "low", "medium", "high"]);

const ideogramV45InputSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .max(10000)
    .describe("Text to render or the edit to apply"),
  image_url: z
    .string()
    .url()
    .optional()
    .describe("Source image to edit. Omit for text-to-image."),
  reference_image_urls: z
    .array(z.string().url())
    .max(4)
    .optional()
    .describe("Edit only: up to 4 reference images (3 when a mask is used)"),
  mask_url: z
    .string()
    .url()
    .optional()
    .describe(
      "Edit only: mask matching the source size. Black is edited, white is preserved.",
    ),
  edit_precision: z
    .enum(["regular", "high"])
    .default("regular")
    .describe(
      "Edit only: 'high' uses Precise Edit and restores unchanged pixels. Same price.",
    ),
  quality: qualitySchema
    .default("medium")
    .describe(
      "Quality tier. very_low is edit-only. Price depends on quality, not size.",
    ),
  image_size: z
    .union([imageSizeSchema, z.literal("auto"), explicitSizeSchema])
    .optional()
    .describe(
      "Output size. t2i default square_hd; edit default auto (keeps source size). 'auto' is edit-only. Explicit t2i sizes must be one of Ideogram's 36 supported sizes (e.g. 1248x832 for 3:2).",
    ),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(8)
    .default(1)
    .describe("Number of images to generate (1-8)"),
  enable_prompt_expansion: z
    .boolean()
    .default(true)
    .describe("Text-to-image only: let Ideogram expand the prompt"),
  seed: z.number().int().optional().describe("Random seed"),
});

const ideogramV45OutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      content_type: z.string().nullable().optional(),
      file_name: z.string().nullable().optional(),
      file_size: z.number().nullable().optional(),
    }),
  ),
  seed: z.number(),
});

const schema: ZodSchema<
  typeof ideogramV45InputSchema,
  typeof ideogramV45OutputSchema
> = {
  input: ideogramV45InputSchema,
  output: ideogramV45OutputSchema,
};

// fal list (2026-09), per image. Size, edit_precision, references and mask do
// not change the price (verified via fal's x-fal-billable-units header).
const QUALITY_RATE_USD: Record<string, number> = {
  very_low: 0.008,
  low: 0.03,
  medium: 0.06,
  high: 0.22,
};

export function calculateIdeogramV45Cost(params: {
  numImages?: number;
  providerOptions?: Record<string, unknown>;
}): number {
  const numImages = params.numImages ?? 1;
  const quality = (params.providerOptions?.quality as string) ?? "medium";
  const rate = QUALITY_RATE_USD[quality] ?? QUALITY_RATE_USD.medium ?? 0.06;
  return rate * numImages;
}

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "ideogram-v4-5",
  description:
    "Ideogram 4.5 — posters, logos and designs with accurate text rendering. Text-to-image (low/medium/high quality) and editing with up to 4 reference images, an optional mask and a high-precision mode that keeps unchanged pixels. Price depends on quality only.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "ideogram/v4.5",
  },
  schema,
  pricing: {
    fal: {
      description:
        "Per image by quality: very_low $0.008 (edit only), low $0.03, medium $0.06 (default), high $0.22. Size, edit precision, references and mask don't change the price. num_images 1-8 → max $1.76.",
      calculate: calculateIdeogramV45Cost,
      minUsd: 0.008, // 1 edit at very_low
      maxUsd: 1.76, // 8 images at high
    },
  },
};

export default definition;
