/**
 * 60db voice models
 * Text-to-speech generation
 */

import { z } from "zod";
import type {
  ModelDefinition,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const sixtydbInputSchema = z.object({
  text: z.string().describe("Text to convert to speech (max 5000 characters)"),
  voice_id: z.string().optional().describe("60db voice_id (UUID) to use"),
  speed: z
    .number()
    .min(0.5)
    .max(2)
    .default(1)
    .describe("Speech speed multiplier (0.5-2.0)"),
  stability: z
    .number()
    .min(0)
    .max(100)
    .default(50)
    .describe("Voice stability (0-100, lower = more expressive)"),
  similarity: z
    .number()
    .min(0)
    .max(100)
    .default(75)
    .describe("Voice similarity to source (0-100)"),
  enhance: z.boolean().default(true).describe("Audio quality enhancement"),
});

// Output schema with Zod
const sixtydbOutputSchema = z.object({
  audio: z.instanceof(Buffer),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof sixtydbInputSchema,
  typeof sixtydbOutputSchema
> = {
  input: sixtydbInputSchema,
  output: sixtydbOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "60db-tts",
  description: "60db text-to-speech model for high-quality voice generation",
  providers: ["60db"],
  defaultProvider: "60db",
  providerModels: {
    "60db": "60db-fast",
  },
  schema,
  pricing: {
    "60db": {
      description: "$0.00002 per character via 60db ($0.01 minimum).",
      calculate: ({ characters = 500 }) => 0.00002 * characters,
      minUsd: 0.01,
      maxUsd: 0.1, // ~5,000 char max input
    },
  },
};

export default definition;
