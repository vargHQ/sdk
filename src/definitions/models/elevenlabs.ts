/**
 * ElevenLabs voice models
 * Text-to-speech generation
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "elevenlabs-tts",
  description:
    "ElevenLabs text-to-speech model for high-quality voice generation",
  providers: ["elevenlabs"],
  defaultProvider: "elevenlabs",
  providerModels: {
    elevenlabs: "eleven_multilingual_v2",
  },
  schema: {
    input: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", description: "Text to convert to speech" },
        voice_id: {
          type: "string",
          description: "Voice ID to use",
        },
        model_id: {
          type: "string",
          enum: [
            "eleven_multilingual_v2",
            "eleven_monolingual_v1",
            "eleven_turbo_v2",
          ],
          default: "eleven_multilingual_v2",
          description: "TTS model to use",
        },
        stability: {
          type: "number",
          default: 0.5,
          description: "Voice stability (0-1)",
        },
        similarity_boost: {
          type: "number",
          default: 0.75,
          description: "Voice similarity boost (0-1)",
        },
      },
    },
    output: {
      type: "object",
      format: "audio",
      description: "Generated audio buffer",
    },
  },
};

export default definition;
