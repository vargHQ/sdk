/**
 * Kling video generation model
 * High-quality video generation from text/image
 */

import { z } from "zod";
import {
  aspectRatioSchema,
  videoDurationSchema,
} from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Input schema with Zod
const klingInputSchema = z.object({
  prompt: z.string().describe("Text description of the video"),
  image_url: z
    .string()
    .url()
    .optional()
    .describe("Input image for image-to-video"),
  duration: videoDurationSchema
    .default(5)
    .describe("Video duration in seconds"),
  aspect_ratio: aspectRatioSchema
    .default("16:9")
    .describe("Output aspect ratio"),
});

// Output schema with Zod
const klingOutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
});

// Schema object for the definition
const schema: ZodSchema<typeof klingInputSchema, typeof klingOutputSchema> = {
  input: klingInputSchema,
  output: klingOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
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
  schema,
};

export default definition;
