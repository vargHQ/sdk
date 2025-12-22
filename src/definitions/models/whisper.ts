/**
 * Whisper transcription model
 * Speech-to-text transcription
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

export const whisperInputSchema = z.object({
  file: z.string().describe("Audio file to transcribe"),
  language: z.string().optional().describe("Language code (e.g., 'en', 'es')"),
  prompt: z.string().optional().describe("Optional prompt to guide transcription"),
  temperature: z.number().default(0).describe("Sampling temperature"),
});

export const whisperOutputSchema = z.object({
  text: z.string(),
});

export type WhisperInput = z.infer<typeof whisperInputSchema>;
export type WhisperOutput = z.infer<typeof whisperOutputSchema>;

export const definition: ModelDefinition<
  typeof whisperInputSchema,
  typeof whisperOutputSchema
> = {
  type: "model",
  name: "whisper",
  description: "OpenAI Whisper model for speech-to-text transcription",
  providers: ["groq", "fireworks"],
  defaultProvider: "groq",
  providerModels: {
    groq: "whisper-large-v3",
    fireworks: "whisper-v3-large",
  },
  inputSchema: whisperInputSchema,
  outputSchema: whisperOutputSchema,
};

export default definition;
