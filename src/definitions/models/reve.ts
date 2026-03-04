/**
 * Reve image editing model
 * Upload an existing image and transform it via a text prompt
 * Edit-only model using singular image_url (not image_urls array)
 */

import { z } from "zod";
import type { ModelDefinition, ZodSchema } from "../../core/schema/types";

// Output format options
const reveOutputFormatSchema = z.enum(["png", "jpeg", "webp"]);

// Input schema with Zod
const reveInputSchema = z.object({
  prompt: z
    .string()
    .describe("Text description of how to edit the provided image"),
  image_url: z
    .string()
    .url()
    .describe(
      "URL of the reference image to edit. Supports PNG, JPEG, WebP, AVIF, and HEIF formats.",
    ),
  num_images: z
    .number()
    .int()
    .min(1)
    .max(4)
    .default(1)
    .describe("Number of images to generate (1-4)"),
  output_format: reveOutputFormatSchema
    .default("png")
    .describe("Output image format"),
});

// Output schema with Zod
const reveOutputSchema = z.object({
  images: z.array(
    z.object({
      url: z.string(),
      file_name: z.string().optional(),
      content_type: z.string().optional(),
    }),
  ),
});

// Schema object for the definition
const schema: ZodSchema<typeof reveInputSchema, typeof reveOutputSchema> = {
  input: reveInputSchema,
  output: reveOutputSchema,
};

export const definition: ModelDefinition<typeof schema> = {
  type: "model",
  name: "reve",
  description:
    "Reve edit model - upload an existing image and transform it via a text prompt. Uses singular image_url input.",
  providers: ["fal"],
  defaultProvider: "fal",
  providerModels: {
    fal: "fal-ai/reve/edit",
  },
  schema,
};

export default definition;
