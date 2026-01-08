// models/kling/schema.ts
import { z } from "zod";

export const schema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(500, "Prompt too long")
    .describe("Text description of the video to generate"),

  image: z
    .string()
    .optional()
    .describe("Path or URL to input image for image-to-video mode"),

  duration: z
    .enum(["5", "10"])
    .default("5")
    .describe("Video duration in seconds"),

  aspect_ratio: z
    .enum(["16:9", "9:16", "1:1"])
    .default("16:9")
    .describe("Video aspect ratio"),

  negative_prompt: z
    .string()
    .optional()
    .describe("What to avoid in generation"),

  cfg_scale: z
    .number()
    .min(0)
    .max(1)
    .default(0.5)
    .optional()
    .describe("Classifier Free Guidance scale"),

  provider: z
    .enum(["fal"])
    .optional()
    .describe("Provider to use (auto-selected if not specified)"),
});

export type KlingParams = z.infer<typeof schema>;
