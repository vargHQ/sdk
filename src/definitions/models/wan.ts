/**
 * Wan-25 lip sync model
 * Audio-driven video generation with lip sync
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "wan",
  description: "Wan-25 model for audio-driven video generation with lip sync",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/wan-25-preview/image-to-video",
    replicate: "wan-video/wan-2.5-i2v",
  },
  schema: {
    input: {
      type: "object",
      required: ["image_url", "audio_url", "prompt"],
      properties: {
        prompt: { type: "string", description: "Scene description" },
        image_url: {
          type: "string",
          format: "url",
          description: "Input image of the character",
        },
        audio_url: {
          type: "string",
          format: "url",
          description: "Audio file for lip sync",
        },
        duration: {
          type: "string",
          enum: ["5", "10"],
          default: "5",
          description: "Video duration in seconds",
        },
        resolution: {
          type: "string",
          enum: ["480p", "720p", "1080p"],
          default: "480p",
          description: "Output resolution",
        },
        negative_prompt: {
          type: "string",
          description: "What to avoid in generation",
        },
      },
    },
    output: {
      type: "object",
      description: "Video generation result with URL",
    },
  },
};

export default definition;
