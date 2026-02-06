/**
 * Image generation action
 * Routes to Fal or Higgsfield based on options
 */

import { fal } from "@fal-ai/client";
import { HiggsfieldClient } from "@higgsfield/client";
import { z } from "zod";
import { imageSizeSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { logQueueUpdate } from "./utils";

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

    return generateWithFal(prompt, { imageSize: size });
  },
};

export interface ImageGenerationResult {
  imageUrl: string;
  uploaded?: string;
}

export async function generateWithFal(
  prompt: string,
  options: { imageSize?: string } = {},
): Promise<ImageGenerationResult> {
  console.log("[image] generating with fal");

  type FalResult = { data: { images?: Array<{ url?: string }> } };
  const result = (await fal.subscribe("fal-ai/flux-pro/v1.1" as string, {
    input: {
      prompt,
      image_size: options.imageSize || "landscape_4_3",
    },
    logs: true,
    onQueueUpdate: logQueueUpdate("image"),
  })) as FalResult;

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("No image URL in result");
  }

  return { imageUrl };
}

export async function generateWithSoul(
  prompt: string,
  options: { styleId?: string } = {},
): Promise<ImageGenerationResult> {
  console.log("[image] generating with higgsfield soul");

  const client = new HiggsfieldClient({
    apiKey: process.env.HIGGSFIELD_API_KEY || process.env.HF_API_KEY,
    apiSecret: process.env.HIGGSFIELD_SECRET || process.env.HF_API_SECRET,
  });

  const jobSet = await client.generate("/v1/text2image/soul", {
    prompt,
    ...(options.styleId && { style_id: options.styleId }),
  });

  const imageUrl = jobSet?.jobs?.[0]?.results?.raw?.url;
  if (!imageUrl) {
    throw new Error("No image URL in result");
  }

  return { imageUrl };
}

export default definition;
