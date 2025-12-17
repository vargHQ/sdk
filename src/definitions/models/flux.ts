/**
 * Flux image generation model
 * High-quality image generation from text
 */

import type { ModelDefinition } from "../../core/schema/types";

export const definition: ModelDefinition = {
  type: "model",
  name: "flux",
  description:
    "Flux Pro image generation model for high-quality images from text",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/flux-pro/v1.1",
    replicate: "black-forest-labs/flux-1.1-pro",
  },
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description: "Text description of the image",
        },
        image_size: {
          type: "string",
          enum: [
            "square_hd",
            "square",
            "portrait_4_3",
            "portrait_16_9",
            "landscape_4_3",
            "landscape_16_9",
          ],
          default: "landscape_4_3",
          description: "Output image size/aspect",
        },
        num_inference_steps: {
          type: "integer",
          default: 28,
          description: "Number of inference steps",
        },
        guidance_scale: {
          type: "number",
          default: 3.5,
          description: "Guidance scale for generation",
        },
      },
    },
    output: {
      type: "object",
      description: "Image generation result with URL",
    },
  },
};

export default definition;
