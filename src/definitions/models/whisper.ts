/**
 * Whisper transcription model
 * Speech-to-text transcription
 */

import { z } from "zod";
import { filePathSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

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
};

export default definition;
