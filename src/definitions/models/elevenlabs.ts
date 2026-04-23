/**
 * ElevenLabs voice models
 * Text-to-speech generation
 */

import { z } from "zod";
import { elevenLabsModelSchema, percentSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const elevenlabsInputSchema = z.object({
  text: z.string().describe("Text to convert to speech"),
  voice_id: z.string().optional().describe("Voice ID to use"),
  model_id: elevenLabsModelSchema
    .default("eleven_multilingual_v2")
    .describe("TTS model to use"),
  stability: percentSchema.default(0.5).describe("Voice stability (0-1)"),
  similarity_boost: percentSchema
    .default(0.75)
    .describe("Voice similarity boost (0-1)"),
});

// Output schema with Zod
const elevenlabsOutputSchema = z.object({
  audio: z.instanceof(Buffer),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof elevenlabsInputSchema,
  typeof elevenlabsOutputSchema
> = {
  input: elevenlabsInputSchema,
  output: elevenlabsOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "elevenlabs-tts",
  description:
    "ElevenLabs text-to-speech model for high-quality voice generation",
  providers: ["elevenlabs"],
  defaultProvider: "elevenlabs",
  providerModels: {
    elevenlabs: "eleven_multilingual_v2",
  },
  schema,
  pricing: {
    elevenlabs: {
      description:
        "$0.10 per 1,000 characters via ElevenLabs (Multilingual v2/v3). Flash/Turbo: $0.05/1K.",
      calculate: ({ characters = 500 }) => 0.0001 * characters,
      minUsd: 0.01, // ~100 chars
      maxUsd: 0.4, // ~4000 chars
    },
  },
};

export default definition;
