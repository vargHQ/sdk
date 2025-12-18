/**
 * Image generation action
 * Routes to Fal or Higgsfield based on options
 */

import { z } from "zod";
import { imageSizeSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { higgsfieldProvider } from "../../providers/higgsfield";
import { storageProvider } from "../../providers/storage";

// Input schema with Zod
const imageInputSchema = z.object({
  prompt: z.string().describe("What to generate"),
  size: imageSizeSchema
    .default("landscape_4_3")
    .describe("Image size/aspect ratio"),
  provider: z
    .enum(["fal", "higgsfield"])
    .default("fal")
    .describe("Generation provider"),
});

// Output schema with Zod
const imageOutputSchema = z.object({
  imageUrl: z.string(),
  uploaded: z.string().optional(),
});

// Schema object for the definition
const schema: ZodSchema<typeof imageInputSchema, typeof imageOutputSchema> = {
  input: imageInputSchema,
  output: imageOutputSchema,
};

export const definition: ActionDefinition<typeof schema> = {
  type: "action",
  name: "image",
  description: "Generate image from text",
  schema,
  routes: [
    {
      target: "flux",
      when: { provider: "fal" },
      priority: 5,
    },
    {
      target: "soul",
      when: { provider: "higgsfield" },
      priority: 10,
    },
  ],
  execute: async (inputs) => {
    const { prompt, size, provider } = inputs;

    if (provider === "higgsfield") {
      return generateWithSoul(prompt);
    }

    return generateWithFal(prompt, { model: size });
  },
};

export interface ImageGenerationResult {
  imageUrl: string;
  uploaded?: string;
}

export async function generateWithFal(
  prompt: string,
  options: { model?: string; upload?: boolean } = {},
): Promise<ImageGenerationResult> {
  console.log("[image] generating with fal");

  const result = await falProvider.generateImage({
    prompt,
    model: options.model,
  });

  const imageUrl = (result.data as { images?: Array<{ url?: string }> })
    ?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `images/fal/${timestamp}.png`;
    uploaded = await storageProvider.uploadFromUrl(imageUrl, objectKey);
    console.log(`[image] uploaded to ${uploaded}`);
  }

  return { imageUrl, uploaded };
}

export async function generateWithSoul(
  prompt: string,
  options: { styleId?: string; upload?: boolean } = {},
): Promise<ImageGenerationResult> {
  console.log("[image] generating with higgsfield soul");

  const result = await higgsfieldProvider.generateSoul({
    prompt,
    styleId: options.styleId,
  });

  const imageUrl = result.jobs?.[0]?.results?.raw?.url;
  if (!imageUrl) {
    throw new Error("No image URL in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `images/soul/${timestamp}.png`;
    uploaded = await storageProvider.uploadFromUrl(imageUrl, objectKey);
    console.log(`[image] uploaded to ${uploaded}`);
  }

  return { imageUrl, uploaded };
}

export default definition;
