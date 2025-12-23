/**
 * Wan-25 lip sync model
 * Audio-driven video generation with lip sync
 */

import { z } from "zod";
import type { ModelDefinition } from "../../core/schema/types";

export const wanInputSchema = z.object({
  prompt: z.string().describe("Scene description"),
  image_url: z.string().describe("Input image of the character"),
  audio_url: z.string().describe("Audio file for lip sync"),
  duration: z
    .enum(["5", "10"])
    .optional()
    .default("5")
    .describe("Video duration in seconds"),
  resolution: z
    .enum(["480p", "720p", "1080p"])
    .optional()
    .default("480p")
    .describe("Output resolution"),
  negative_prompt: z
    .string()
    .optional()
    .describe("What to avoid in generation"),
});

export const wanOutputSchema = z.object({
  video: z.object({ url: z.string() }),
});

export type WanInput = z.infer<typeof wanInputSchema>;
export type WanOutput = z.infer<typeof wanOutputSchema>;

export const definition: ModelDefinition<
  typeof wanInputSchema,
  typeof wanOutputSchema
> = {
  type: "model",
  name: "wan",
  description: "Wan-25 model for audio-driven video generation with lip sync",
  providers: ["fal", "replicate"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/wan-25-preview/image-to-video",
    replicate: "wan-video/wan-2.5-i2v",
  },
  inputSchema: wanInputSchema,
  outputSchema: wanOutputSchema,
};

export default definition;
