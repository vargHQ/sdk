/**
 * Kling video generation model
 * High-quality video generation from text/image
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "kling",
  description:
    "Kling video generation model for high-quality video from text or image",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/kling-video/v2.5-turbo/pro",
    replicate: "fofr/kling-v1.5",
  },
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the video",
        },
        image_url: {
          type: "string",
          format: "url",
          description: "Input image for image-to-video",
        },
        duration: {
          type: "integer",
          enum: [5, 10],
          default: 5,
          description: "Video duration in seconds",
        },
        aspect_ratio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1"],
          default: "16:9",
          description: "Output aspect ratio",
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
