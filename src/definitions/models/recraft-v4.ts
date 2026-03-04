/**
 * Recraft V4 Pro image generation model
 * Built for brand systems and production-ready workflows
 * Text-to-image only
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Image size can be an enum string or an object with width/height
const recraftV4ImageSizeSchema = z.union([
  z.enum([
    "square_hd",
    "square",
    "landscape_4_3",
    "landscape_16_9",
    "portrait_4_3",
    "portrait_16_9",
  ]),
  z.object({
    width: z.number().int(),
    height: z.number().int(),
  }),
]);

// RGB color schema
const rgbColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

// Output format - Recraft V4 outputs webp by default
const recraftV4OutputFormatSchema = z.enum(["png", "jpeg", "webp"]);

// Input schema with Zod
const recraftV4InputSchema = z.object({
  prompt: z.string().describe("Text description for image generation"),
  image_size: recraftV4ImageSizeSchema
    .default("square_hd")
    .describe(
      "Output image size. Can be an enum (e.g. 'landscape_16_9') or {width, height} object.",
    ),
  colors: z
    .array(rgbColorSchema)
    .default([])
    .describe("Array of preferable RGB colors for the generated image"),
  background_color: rgbColorSchema
    .optional()
    .describe("Preferable background color of the generated image"),
  enable_safety_checker: z
    .boolean()
    .default(true)
    .describe("Enable content safety checker"),
  output_format: recraftV4OutputFormatSchema
    .optional()
    .describe("Output image format"),
});

// Output schema with Zod
const recraftV4OutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      file_name: z.string().optional(),
      file_size: z.number().optional(),
      content_type: z.string().optional(),
    }),
  ),
});

// Schema object for the definition
const schema: ZodSchema<
  typeof recraftV4InputSchema,
  typeof recraftV4OutputSchema
> = {
  input: recraftV4InputSchema,
  output: recraftV4OutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "recraft-v4-pro",
  description:
    "Recraft V4 Pro - professional text-to-image model built for brand systems and production-ready workflows. Strong composition, refined lighting, realistic materials.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/recraft/v4/pro/text-to-image",
  },
  schema,
};

export default definition;
