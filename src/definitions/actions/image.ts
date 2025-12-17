/**
 * Image generation action
 * Routes to Fal or Higgsfield based on options
 */

import type { ActionDefinition } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { higgsfieldProvider } from "../../providers/higgsfield";
import { storageProvider } from "../../providers/storage";

export const definition: ActionDefinition = {
  type: "action",
  name: "image",
  description: "Generate image from text",
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "What to generate" },
        size: {
          type: "string",
          enum: [
            "square_hd",
            "landscape_4_3",
            "portrait_4_3",
            "landscape_16_9",
          ],
          default: "landscape_4_3",
          description: "Image size/aspect ratio",
        },
        provider: {
          type: "string",
          enum: ["fal", "higgsfield"],
          default: "fal",
          description: "Generation provider",
        },
      },
    },
    output: { type: "string", format: "url", description: "Image URL" },
  },
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
    const {
      prompt,
      size,
      provider = "fal",
    } = inputs as {
      prompt: string;
      size?: string;
      provider?: "fal" | "higgsfield";
    };

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
