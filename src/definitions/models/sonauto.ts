/**
 * Sonauto music generation model
 * Text-to-music generation
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "sonauto",
  description: "Sonauto model for text-to-music generation",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/sonauto/bark",
  },
  schema: {
    input: {
      type: "object",
      required: [],
      properties: {
        prompt: { type: "string", description: "Music description" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Style tags",
        },
        lyrics_prompt: {
          type: "string",
          description: "Lyrics to generate",
        },
        num_songs: {
          type: "integer",
          enum: [1, 2],
          default: 1,
          description: "Number of songs",
        },
        output_format: {
          type: "string",
          enum: ["mp3", "wav", "flac", "ogg", "m4a"],
          default: "mp3",
          description: "Output format",
        },
        bpm: {
          type: "string",
          default: "auto",
          description: "Beats per minute",
        },
      },
    },
    output: {
      type: "object",
      description: "Music generation result",
    },
  },
};

export default definition;
