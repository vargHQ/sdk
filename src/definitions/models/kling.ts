/**
 * Kling video generation model
 * High-quality video generation from text/image
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

export const klingInputSchema = z.object({
  prompt: z.string().describe("Text description of the video"),
  image_url: z.string().optional().describe("Input image for image-to-video"),
  duration: z
    .union([z.literal(5), z.literal(10)])
    .optional()
    .default(5)
    .describe("Video duration in seconds"),
  aspect_ratio: z
    .enum(["16:9", "9:16", "1:1"])
    .optional()
    .default("16:9")
    .describe("Output aspect ratio"),
});

export const klingOutputSchema = z.object({
  video: z.object({ url: z.string() }),
});

export type KlingInput = z.infer<typeof klingInputSchema>;
export type KlingOutput = z.infer<typeof klingOutputSchema>;

export const definition: ModelDefinition<
  typeof klingInputSchema,
  typeof klingOutputSchema
> = {
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
  inputSchema: klingInputSchema,
  outputSchema: klingOutputSchema,
};

export default definition;
