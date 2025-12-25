/**
 * ElevenLabs voice models
 * Text-to-speech generation
 */

import { z } from "zod";
import { elevenLabsModelSchema, percentSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

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
};

export default definition;
