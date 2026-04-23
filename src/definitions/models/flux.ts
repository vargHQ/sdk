/**
 * Flux image generation model
 * High-quality image generation from text
 */

import { z } from "zod";
import { imageSizeSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const fluxInputSchema = z.object({
  prompt: z.string().describe("Text description of the image"),
  image_size: imageSizeSchema
    .default("landscape_4_3")
    .describe("Output image size/aspect"),
  num_inference_steps: z
    .number()
    .int()
    .default(28)
    .describe("Number of inference steps"),
  guidance_scale: z
    .number()
    .default(3.5)
    .describe("Guidance scale for generation"),
});

// Output schema with Zod
const fluxOutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
    }),
  ),
});

// Schema object for the definition
const schema: ZodSchema<typeof fluxInputSchema, typeof fluxOutputSchema> = {
  input: fluxInputSchema,
  output: fluxOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "flux",
  description:
    "Flux Pro image generation model for high-quality images from text",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/flux-pro/v1.1",
    replicate: "black-forest-labs/flux-1.1-pro",
  },
  schema,
  pricing: {
    fal: {
      description:
        "$0.04 per megapixel via fal (rounded up). Standard 1MP image = $0.04.",
      calculate: ({ numImages = 1, width = 1024, height = 768 }) => {
        const megapixels = Math.ceil((width * height) / 1_000_000);
        return 0.04 * megapixels * numImages;
      },
      minUsd: 0.04, // 1 image at 1MP
      maxUsd: 0.16, // 4 images at 1MP
    },
  },
};

export default definition;
