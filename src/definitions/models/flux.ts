/**
 * Flux image generation model
 * High-quality image generation from text
 */

import { z } from "zod";
import { imageSizeSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

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
};

export default definition;
