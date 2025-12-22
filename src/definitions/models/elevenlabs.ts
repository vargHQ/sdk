/**
 * ElevenLabs voice models
 * Text-to-speech generation
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

export const elevenlabsInputSchema = z.object({
  text: z.string().describe("Text to convert to speech"),
  voice_id: z.string().optional().describe("Voice ID to use"),
  model_id: z
    .enum([
      "eleven_multilingual_v2",
      "eleven_monolingual_v1",
      "eleven_turbo_v2",
    ])
    .default("eleven_multilingual_v2")
    .describe("TTS model to use"),
  stability: z.number().default(0.5).describe("Voice stability (0-1)"),
  similarity_boost: z
    .number()
    .default(0.75)
    .describe("Voice similarity boost (0-1)"),
});

export const elevenlabsOutputSchema = z.object({
  audio: z.instanceof(ArrayBuffer),
});

export type ElevenlabsInput = z.infer<typeof elevenlabsInputSchema>;
export type ElevenlabsOutput = z.infer<typeof elevenlabsOutputSchema>;

export const definition: ModelDefinition<
  typeof elevenlabsInputSchema,
  typeof elevenlabsOutputSchema
> = {
  type: "model",
  name: "elevenlabs-tts",
  description:
    "ElevenLabs text-to-speech model for high-quality voice generation",
  providers: ["elevenlabs"],
  defaultProvider: "elevenlabs",
  providerModels: {
    elevenlabs: "eleven_multilingual_v2",
  },
  inputSchema: elevenlabsInputSchema,
  outputSchema: elevenlabsOutputSchema,
};

export default definition;
