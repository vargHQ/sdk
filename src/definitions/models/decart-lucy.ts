/**
 * Decart Lucy model definition
 * Batch video and image generation/transformation via the Decart AI platform
 *
 * Video models: lucy-pro-v2v, lucy-fast-v2v, lucy-pro-t2v, lucy-pro-i2v,
 *   lucy-dev-i2v, lucy-motion, lucy-pro-flf2v, lucy-restyle-v2v
 * Image models: lucy-pro-t2i, lucy-pro-i2i
 */

import { z } from "zod";
import { filePathSchema, resolutionSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Input schema
const decartLucyInputSchema = z.object({
  prompt: z.string().describe("Text prompt describing the desired output"),
  data: filePathSchema
    .optional()
    .describe("Input video or image file (for v2v, i2v, i2i, restyle modes)"),
  reference_image: filePathSchema
    .optional()
    .describe("Reference image for style guidance"),
  mode: z
    .enum([
      "v2v",
      "fast-v2v",
      "t2v",
      "i2v",
      "dev-i2v",
      "motion",
      "flf2v",
      "restyle",
      "t2i",
      "i2i",
    ])
    .default("v2v")
    .describe("Generation mode"),
  resolution: resolutionSchema
    .extract(["480p", "720p"])
    .default("720p")
    .describe("Output resolution"),
  enhance_prompt: z
    .boolean()
    .default(true)
    .describe("Whether to enhance the prompt with AI"),
  orientation: z
    .enum(["landscape", "portrait"])
    .optional()
    .describe("Output orientation (for t2v, t2i)"),
  seed: z.number().optional().describe("Random seed for reproducibility"),
  num_inference_steps: z
    .number()
    .optional()
    .describe("Number of inference steps (higher = better quality)"),
});

// Output schema
const decartLucyOutputSchema = z.object({
  url: z.string().describe("Path or URL to the generated output"),
  type: z
    .enum(["video", "image"])
    .describe("Whether the output is a video or image"),
});

// Schema object
const schema: ZodSchema<
  typeof decartLucyInputSchema,
  typeof decartLucyOutputSchema
> = {
  input: decartLucyInputSchema,
  output: decartLucyOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "decart-lucy",
  description:
    "Decart Lucy model for batch video transformation, text-to-video, image-to-video, and image generation",
  providers: ["decart"],
  defaultProvider: "decart",
  providerModels: {
    decart: "lucy-pro-v2v",
  },
  schema,
};

export default definition;
