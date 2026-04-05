/**
 * HeyGen avatar video model
 * Generates talking avatar videos from script + voice + image/avatar
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

const heygenInputSchema = z.object({
  script: z.string().describe("Script text for the avatar to speak"),
  voice_id: z.string().describe("HeyGen voice ID"),
  avatar_id: z.string().optional().describe("Pre-registered HeyGen avatar ID"),
  image_url: z
    .string()
    .optional()
    .describe("Image URL to animate (alternative to avatar_id)"),
  motion_prompt: z
    .string()
    .optional()
    .describe("Natural language motion control prompt"),
  expressiveness: z
    .enum(["low", "medium", "high"])
    .optional()
    .default("medium")
    .describe("Expressiveness level of the avatar"),
  aspect_ratio: z
    .enum(["16:9", "9:16"])
    .optional()
    .default("16:9")
    .describe("Video aspect ratio"),
  resolution: z
    .enum(["720p", "1080p"])
    .optional()
    .default("1080p")
    .describe("Video resolution"),
});

const heygenOutputSchema = z.object({
  videoUrl: z.string(),
  duration: z.number().optional(),
});

const schema: ZodSchema<typeof heygenInputSchema, typeof heygenOutputSchema> = {
  input: heygenInputSchema,
  output: heygenOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "heygen-avatar",
  description:
    "HeyGen Avatar IV model for generating talking avatar videos from script and voice",
  providers: ["heygen"],
  defaultProvider: "heygen",
  providerModels: {
    heygen: "avatar-iv",
  },
  schema,
};

export default definition;
