/**
 * Higgsfield Soul image generation model
 * Character-focused image generation
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

export const soulInputSchema = z.object({
  prompt: z.string().describe("Character description"),
  width_and_height: z
    .enum(["SQUARE_1024x1024", "PORTRAIT_1152x2048", "LANDSCAPE_2048x1152"])
    .default("PORTRAIT_1152x2048")
    .describe("Output dimensions"),
  quality: z.enum(["SD", "HD", "UHD"]).default("HD").describe("Output quality"),
  style_id: z.string().optional().describe("Style preset ID"),
  batch_size: z
    .union([z.literal(1), z.literal(2), z.literal(4)])
    .default(1)
    .describe("Number of images to generate"),
  enhance_prompt: z
    .boolean()
    .default(false)
    .describe("Enhance prompt with AI"),
});

export const soulOutputSchema = z.object({
  jobs: z.array(
    z.object({
      results: z.object({
        raw: z.object({ url: z.string() }),
      }),
    }),
  ),
});

export type SoulInput = z.infer<typeof soulInputSchema>;
export type SoulOutput = z.infer<typeof soulOutputSchema>;

export const definition: ModelDefinition<
  typeof soulInputSchema,
  typeof soulOutputSchema
> = {
  type: "model",
  name: "soul",
  description: "Higgsfield Soul model for character-focused image generation",
  providers: ["higgsfield"],
  defaultProvider: "higgsfield",
  providerModels: {
    higgsfield: "/v1/text2image/soul",
  },
  inputSchema: soulInputSchema,
  outputSchema: soulOutputSchema,
};

export default definition;
