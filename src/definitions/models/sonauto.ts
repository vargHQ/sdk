/**
 * Sonauto music generation model
 * Text-to-music generation
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

export const sonautoInputSchema = z.object({
  prompt: z.string().optional().describe("Music description"),
  tags: z.array(z.string()).optional().describe("Style tags"),
  lyrics_prompt: z.string().optional().describe("Lyrics to generate"),
  num_songs: z
    .union([z.literal(1), z.literal(2)])
    .default(1)
    .describe("Number of songs"),
  output_format: z
    .enum(["mp3", "wav", "flac", "ogg", "m4a"])
    .default("mp3")
    .describe("Output format"),
  bpm: z
    .union([z.number(), z.literal("auto")])
    .default("auto")
    .describe("Beats per minute"),
});

export const sonautoOutputSchema = z.object({
  songs: z.array(
    z.object({
      url: z.string(),
    }),
  ),
});

export type SonautoInput = z.infer<typeof sonautoInputSchema>;
export type SonautoOutput = z.infer<typeof sonautoOutputSchema>;

export const definition: ModelDefinition<
  typeof sonautoInputSchema,
  typeof sonautoOutputSchema
> = {
  type: "model",
  name: "sonauto",
  description: "Sonauto model for text-to-music generation",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/sonauto/bark",
  },
  inputSchema: sonautoInputSchema,
  outputSchema: sonautoOutputSchema,
};

export default definition;
