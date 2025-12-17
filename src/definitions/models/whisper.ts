/**
 * Whisper transcription model
 * Speech-to-text transcription
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "whisper",
  description: "OpenAI Whisper model for speech-to-text transcription",
  providers: ["groq", "fireworks"],
  defaultProvider: "groq",
  providerModels: {
    groq: "whisper-large-v3",
    fireworks: "whisper-v3-large",
  },
  schema: {
    input: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "file-path",
          description: "Audio file to transcribe",
        },
        language: {
          type: "string",
          description: "Language code (e.g., 'en', 'es')",
        },
        prompt: {
          type: "string",
          description: "Optional prompt to guide transcription",
        },
        temperature: {
          type: "number",
          default: 0,
          description: "Sampling temperature",
        },
      },
    },
    output: {
      type: "string",
      description: "Transcribed text",
    },
  },
};

export default definition;
