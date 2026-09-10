/**
 * OpenAI GPT Image 2.5
 * High-quality image generation and editing with natural lighting and rich textures.
 * Two variants: Flare (fast, default) and Sunburst (premium, tighter edit control).
 * Available on fal (hosted) and OpenAI (native) providers.
 */

import { z } from "zod";
import { imageSizeSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Quality tiers — auto/low/medium/high/xhigh/max
const qualitySchema = z.enum(["auto", "low", "medium", "high", "xhigh", "max"]);

// Output format options
const outputFormatSchema = z.enum(["jpeg", "png", "webp"]);

// Background options
const backgroundSchema = z.enum(["auto", "transparent", "opaque"]);

// Input schema with Zod
const gptImage25InputSchema = z.object({
  prompt: z
    .string()
    .min(2)
    .max(32000)
    .describe("Text description for generation or editing"),
  image_urls: z
    .array(z.string().url())
    .max(16)
    .optional()
    .describe(
      "Reference images for editing (up to 16). Omit for text-to-image generation.",
    ),
  image_size: imageSizeSchema
    .default("landscape_4_3")
    .describe(
      "Output image size. Use 'auto' to let the model pick, or a preset/explicit {width, height}.",
    ),
  quality: qualitySchema
    .default("high")
    .describe(
      "Image quality. Higher = more detail, latency, and token usage. 'auto' lets the model choose.",
    ),
  background: backgroundSchema
    .default("auto")
    .describe("Background for the generated image."),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
  output_format: outputFormatSchema
    .default("png")
    .describe("Output image format"),
});

// Output schema with Zod
const gptImage25OutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      content_type: z.string().nullable().optional(),
      file_name: z.string().nullable().optional(),
      file_size: z.number().nullable().optional(),
      width: z.number().nullable().optional(),
      height: z.number().nullable().optional(),
    }),
  ),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof gptImage25InputSchema,
  typeof gptImage25OutputSchema
> = {
  input: gptImage25InputSchema,
  output: gptImage25OutputSchema,
};

// Quality → per-image cost (USD), conservative 1024x1024 reference.
// Token-based pricing: text $5/$1.25/$10 per 1M, image $8/$2/$30 per 1M.
// Per-image cost depends on quality + size; these are conservative estimates.
const QUALITY_RATE_USD: Record<string, number> = {
  low: 0.02,
  medium: 0.1,
  high: 0.22,
  xhigh: 0.3,
  max: 0.41,
  auto: 0.22, // falls to default = high
};

function calculateGptImage25Cost(
  params: {
    numImages?: number;
    providerOptions?: Record<string, unknown>;
  },
  defaultQuality = "high",
): number {
  const numImages = params.numImages ?? 1;
  const quality = (params.providerOptions?.quality as string) ?? defaultQuality;
  const rate: number =
    QUALITY_RATE_USD[quality] ??
    QUALITY_RATE_USD[defaultQuality] ??
    QUALITY_RATE_USD["high"] ??
    0.22;
  return rate * numImages;
}

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "gpt-image-2-5",
  description:
    "OpenAI GPT Image 2.5 — fast, high-quality generation with natural lighting, rich textures, and support for complex layouts including transparent backgrounds. Flare (default, fast) and Sunburst (premium, tighter edit control) variants. Supports text-to-image and image editing with up to 16 reference images.",
  providers: ["fal", "openai"],
  defaultProvider: "fal",
  providerModels: {
    // fal-hosted (Flare = default, Sunburst via exact addressing)
    fal: "openai/gpt-image-2.5/flare/text-to-image",
    // OpenAI native (Flare variant; Sunburst = gpt-image-2.5-sunburst)
    openai: "gpt-image-2.5-flare",
  },
  schema,
  pricing: {
    fal: {
      description:
        "Token-based via fal: text $5/$1.25/$10 per 1M, image $8/$2/$30 per 1M (in/cached/out). Tiered by quality: low ~2¢, medium ~10¢, high ~22¢ (default), xhigh ~30¢, max ~41¢ per image (1024x1024 reference, conservative). num_images 1-4 → max 164¢.",
      calculate: (params) => calculateGptImage25Cost(params, "high"),
      minUsd: 0.02, // 1 image at low quality
      maxUsd: 1.64, // 4 images at max quality
    },
    openai: {
      description:
        "OpenAI native: conservative per-image estimate tiered by quality. low ~2¢, medium ~10¢, high ~22¢ (default), xhigh ~30¢, max ~41¢ per image. Edit adds image-input token cost per reference (up to 16, ~0.8¢ each) — covered by ceiling.",
      calculate: (params) => calculateGptImage25Cost(params, "high"),
      minUsd: 0.02, // 1 image at low quality
      maxUsd: 1.64, // 4 images at max quality
    },
  },
};

export default definition;
