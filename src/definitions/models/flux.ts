/**
 * Flux image generation model
 * High-quality image generation from text
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

// Zod schemas
export const fluxInputSchema = z.object({
  prompt: z.string().describe("Text description of the image"),
  image_size: z
    .enum([
      "square_hd",
      "square",
      "portrait_4_3",
      "portrait_16_9",
      "landscape_4_3",
      "landscape_16_9",
    ])
    .optional()
    .default("landscape_4_3")
    .describe("Output image size/aspect"),
  num_inference_steps: z
    .number()
    .int()
    .optional()
    .default(28)
    .describe("Number of inference steps"),
  guidance_scale: z
    .number()
    .optional()
    .default(3.5)
    .describe("Guidance scale for generation"),
});

export const fluxOutputSchema = z.object({
  images: z.array(z.object({ url: z.string().url() })),
});

// Inferred types
export type FluxInput = z.infer<typeof fluxInputSchema>;
export type FluxOutput = z.infer<typeof fluxOutputSchema>;

export const definition: ModelDefinition<
  typeof fluxInputSchema,
  typeof fluxOutputSchema
> = {
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
  inputSchema: fluxInputSchema,
  outputSchema: fluxOutputSchema,
};

export default definition;
