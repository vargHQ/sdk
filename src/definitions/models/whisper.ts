/**
 * Whisper transcription model
 * Speech-to-text transcription
 */

import { z } from "zod";
import { filePathSchema } from "../../core/schema/shared";
import type {
  ModelDefinition,
  ProviderPricing,
  ZodSchema,
} from "../../core/schema/types";

// Input schema with Zod
const whisperInputSchema = z.object({
  file: filePathSchema.describe("Audio file to transcribe"),
  language: z.string().optional().describe("Language code (e.g., 'en', 'es')"),
  prompt: z
    .string()
    .optional()
    .describe("Optional prompt to guide transcription"),
  temperature: z.number().default(0).describe("Sampling temperature"),
});

// Output schema with Zod
const whisperOutputSchema = z.string().describe("Transcribed text");

// Schema object for the definition
const schema: ZodSchema<typeof whisperInputSchema, typeof whisperOutputSchema> =
  {
    input: whisperInputSchema,
    output: whisperOutputSchema,
  };

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "whisper",
  description: "OpenAI Whisper model for speech-to-text transcription",
  providers: ["groq", "fireworks"],
  defaultProvider: "groq",
  providerModels: {
    groq: "whisper-large-v3",
    fireworks: "whisper-v3-large",
  },
  schema,
  pricing: {
    groq: {
      description:
        "$0.111 per hour of audio via Groq (min 10s billing per request)",
      calculate: ({ duration = 60 }) => {
        const billableSeconds = Math.max(duration, 10);
        return (billableSeconds / 3600) * 0.111;
      },
      minUsd: 0.0003, // 10s minimum
      maxUsd: 0.111, // 1 hour
    },
    fireworks: {
      description: "$0.0015 per audio minute via Fireworks (billed per second)",
      calculate: ({ duration = 60 }) => {
        return (duration / 60) * 0.0015;
      },
      minUsd: 0.0001, // few seconds
      maxUsd: 0.09, // 1 hour
    },
  },
};

export default definition;
