/**
 * Higgsfield Soul image generation model
 * Character-focused image generation
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "soul",
  description: "Higgsfield Soul model for character-focused image generation",
  providers: ["higgsfield"],
  defaultProvider: "higgsfield",
  providerModels: {
    higgsfield: "/v1/text2image/soul",
  },
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "Character description" },
        width_and_height: {
          type: "string",
          enum: [
            "SQUARE_1024x1024",
            "PORTRAIT_1152x2048",
            "LANDSCAPE_2048x1152",
          ],
          default: "PORTRAIT_1152x2048",
          description: "Output dimensions",
        },
        quality: {
          type: "string",
          enum: ["SD", "HD", "UHD"],
          default: "HD",
          description: "Output quality",
        },
        style_id: {
          type: "string",
          description: "Style preset ID",
        },
        batch_size: {
          type: "integer",
          enum: [1, 2, 4],
          default: 1,
          description: "Number of images to generate",
        },
        enhance_prompt: {
          type: "boolean",
          default: false,
          description: "Enhance prompt with AI",
        },
      },
    },
    output: {
      type: "object",
      description: "Image generation result",
    },
  },
};

export default definition;
