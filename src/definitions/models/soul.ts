/**
 * Higgsfield Soul image generation model
 * Character-focused image generation
 */

import { z } from "zod";
import { soulQualitySchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Soul-specific dimension schema
const soulDimensionSchema = z.enum([
  "SQUARE_1024x1024",
  "PORTRAIT_1152x2048",
  "LANDSCAPE_2048x1152",
]);

// Soul-specific batch size schema
const soulBatchSizeSchema = z.union([z.literal(1), z.literal(2), z.literal(4)]);

// Input schema with Zod
const soulInputSchema = z.object({
  prompt: z.string().describe("Character description"),
  width_and_height: soulDimensionSchema
    .default("PORTRAIT_1152x2048")
    .describe("Output dimensions"),
  quality: soulQualitySchema.default("HD").describe("Output quality"),
  style_id: z.string().optional().describe("Style preset ID"),
  batch_size: soulBatchSizeSchema
    .default(1)
    .describe("Number of images to generate"),
  enhance_prompt: z.boolean().default(false).describe("Enhance prompt with AI"),
});

// Output schema with Zod
const soulOutputSchema = z.object({
  jobs: z.array(
    z.object({
      results: z.object({
        raw: z.object({
          url: z.string(),
        }),
      }),
    }),
  ),
});

// Schema object for the definition
const schema: ZodSchema<typeof soulInputSchema, typeof soulOutputSchema> = {
  input: soulInputSchema,
  output: soulOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "soul",
  description: "Higgsfield Soul model for character-focused image generation",
  providers: ["higgsfield"],
  defaultProvider: "higgsfield",
  providerModels: {
    higgsfield: "/v1/text2image/soul",
  },
  schema,
};

export default definition;
