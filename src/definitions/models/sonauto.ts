/**
 * Sonauto music generation model
 * Text-to-music generation
 */

import { z } from "zod";
import { audioFormatSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const sonautoInputSchema = z.object({
  prompt: z.string().optional().describe("Music description"),
  tags: z.array(z.string()).optional().describe("Style tags"),
  lyrics_prompt: z.string().optional().describe("Lyrics to generate"),
  num_songs: z
    .union([z.literal(1), z.literal(2)])
    .default(1)
    .describe("Number of songs"),
  output_format: audioFormatSchema.default("mp3").describe("Output format"),
  bpm: z
    .union([z.number(), z.literal("auto")])
    .default("auto")
    .describe("Beats per minute"),
});

// Output schema with Zod
const sonautoOutputSchema = z.object({
  seed: z.number(),
  tags: z.array(z.string()).optional(),
  lyrics: z.string().optional(),
  audio: z.union([
    z.array(
      z.object({
        url: z.string(),
        file_name: z.string(),
        content_type: z.string(),
        file_size: z.number(),
      }),
    ),
    z.object({
      url: z.string(),
      file_name: z.string(),
      content_type: z.string(),
      file_size: z.number(),
    }),
  ]),
});

// Schema object for the definition
const schema: ZodSchema<typeof sonautoInputSchema, typeof sonautoOutputSchema> =
  {
    input: sonautoInputSchema,
    output: sonautoOutputSchema,
  };

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "sonauto",
  description: "Sonauto model for text-to-music generation",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/sonauto/bark",
  },
  schema,
  pricing: {
    fal: {
      description: "$0.25 per track via fal (num_songs 1-2)",
      calculate: ({ numImages = 1 }) => 0.25 * numImages,
      minUsd: 0.25, // 1 song
      maxUsd: 0.5, // 2 songs
    },
  },
};

export default definition;
