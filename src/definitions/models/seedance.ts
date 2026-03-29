/**
 * Seedance 2 video generation model (via PiAPI)
 * High-quality video generation from text, images, or video editing
 *
 * Two variants:
 * - seedance-2-preview: Higher quality, $0.25/s, automatic watermark removal
 * - seedance-2-fast-preview: Faster, $0.15/s, no watermark removal needed
 */

import { z } from "zod";
import { aspectRatioSchema } from "../../core/schema/shared";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Seedance supports 5, 10, or 15 second durations
const seedanceDurationSchema = z.union([
  z.literal(5),
  z.literal(10),
  z.literal(15),
]);

// Extended aspect ratios supported by Seedance
const seedanceAspectRatioSchema = z.enum(["16:9", "9:16", "4:3", "3:4"]);

// Input schema
const seedanceInputSchema = z.object({
  prompt: z.string().describe("Text description of the video to generate"),
  image_urls: z
    .array(z.string().url())
    .max(9)
    .optional()
    .describe(
      "Reference image URLs for image-to-video or subject appearance control. Use @imageN in prompt to reference (e.g. @image1). Maximum 9 images.",
    ),
  video_urls: z
    .array(z.string().url())
    .max(1)
    .optional()
    .describe(
      "Video URL for video edit mode. When provided, the input video is edited based on the prompt. Duration parameter is ignored.",
    ),
  duration: seedanceDurationSchema
    .default(5)
    .describe(
      "Video duration in seconds (5, 10, or 15). Ignored in video edit mode.",
    ),
  aspect_ratio: seedanceAspectRatioSchema
    .default("16:9")
    .describe("Output aspect ratio"),
  parent_task_id: z
    .string()
    .optional()
    .describe("Parent task ID for extending a previously generated video"),
});

// Output schema
const seedanceOutputSchema = z.object({
  video: z.object({
    url: z.string(),
  }),
});

const schema: ZodSchema<
  typeof seedanceInputSchema,
  typeof seedanceOutputSchema
> = {
  input: seedanceInputSchema,
  output: seedanceOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "seedance-2-preview",
  description:
    "Seedance 2 video generation — high-quality video from text, images, or video editing. Powered by ByteDance via PiAPI.",
  providers: ["piapi"],
  defaultProvider: "piapi",
  providerModels: {
    piapi: "seedance-2-preview",
  },
  schema,
};

export const fastDefinition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "seedance-2-fast-preview",
  description:
    "Seedance 2 Fast — faster video generation from text, images, or video editing. Lower cost than seedance-2-preview.",
  providers: ["piapi"],
  defaultProvider: "piapi",
  providerModels: {
    piapi: "seedance-2-fast-preview",
  },
  schema,
};

export default definition;
