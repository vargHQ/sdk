/**
 * Image generation action
 * Routes to Fal or Higgsfield based on options
 */

import { z } from "zod";
import { executeJobUrl, resolveVargConfig } from "../../ai-sdk/providers/varg";
import { imageSizeSchema } from "../../core/schema/shared";
import type { ActionDefinition, ZodSchema } from "../../core/schema/types";
import { falProvider } from "../../providers/fal";
import { higgsfieldProvider } from "../../providers/higgsfield";
import { magnificProvider } from "../../providers/magnific";
import { storageProvider } from "../../providers/storage";

// Input schema with Zod
const imageInputSchema = z.object({
  prompt: z.string().describe("What to generate"),
  size: imageSizeSchema
    .default("landscape_4_3")
    .describe("Image size/aspect ratio"),
  provider: z
    .enum(["fal", "higgsfield", "magnific", "openai"])
    .default("fal")
    .describe("Generation provider"),
  model: z
    .string()
    .optional()
    .describe(
      "Provider-specific model name. For fal: gpt-image-2-5, gpt-image-2-5/edit, gpt-image-2-5-sunburst, gpt-image-2-5-sunburst/edit, mai-image-2-5, mai-image-2-5/edit, seedream-5-pro, seedream-5-pro/edit, nano-banana-pro, nano-banana-pro/edit, flux-pro, flux-dev, flux-schnell, seedream-v4.5/edit, qwen-image-2, qwen-image-2-pro, grok-imagine-image, phota, phota/edit, seedvr, recraft-clarity, topaz. For openai (native, via varg API): gpt-image-2.5-flare, gpt-image-2.5-sunburst, gpt-image-2, gpt-image-1.5, gpt-image-1, chatgpt-image-latest. For magnific: mystic (default), flux-2-pro, flux-2-turbo, flux-2-klein, flux-pro-v1.1, flux-dev, hyperflux, seedream-4, seedream-v4.5, runway-image.",
    ),
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
    {
      target: "magnific/mystic",
      when: { provider: "magnific" },
      priority: 5,
    },
    {
      target: "gpt-image-2-5",
      when: { provider: "openai" },
      priority: 5,
    },
  ],
  execute: async (inputs) => {
    const { prompt, size, provider, model } = inputs;

    if (provider === "higgsfield") {
      return generateWithSoul(prompt);
    }
    if (provider === "magnific") {
      return generateWithMagnific(prompt, { size, model });
    }
    if (provider === "openai") {
      return generateWithOpenAI(prompt, { size, model });
    }

    return generateWithFal(prompt, { imageSize: size, model });
  },
};

export interface ImageGenerationResult {
  imageUrl: string;
  uploaded?: string;
}

export async function generateWithFal(
  prompt: string,
  options: { imageSize?: string; model?: string; upload?: boolean } = {},
): Promise<ImageGenerationResult> {
  const modelLabel = options.model ? ` (${options.model})` : "";
  console.log(`[image] generating with fal${modelLabel}`);

  const result = await falProvider.generateImage({
    prompt,
    model: options.model,
    imageSize: options.imageSize,
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

export async function generateWithMagnific(
  prompt: string,
  options: { size?: string; model?: string; upload?: boolean } = {},
): Promise<ImageGenerationResult> {
  const model = options.model || "mystic";
  console.log(`[image] generating with magnific/${model}`);

  // Map of v1 models → capability path. The Layer A surface
  // (varg.imageModel("magnific/...")) covers these too; here we use the Layer B
  // provider directly so the CLI doesn't depend on the AI-SDK module.
  const paths: Record<string, string> = {
    mystic: "ai/mystic",
    "flux-2-pro": "ai/text-to-image/flux-2-pro",
    "flux-2-turbo": "ai/text-to-image/flux-2-turbo",
    "flux-2-klein": "ai/text-to-image/flux-2-klein",
    "flux-pro-v1.1": "ai/text-to-image/flux-pro-v1-1",
    "flux-dev": "ai/text-to-image/flux-dev",
    hyperflux: "ai/text-to-image/hyperflux",
    "seedream-4": "ai/text-to-image/seedream-v4",
    "seedream-v4.5": "ai/text-to-image/seedream-v4-5",
    "runway-image": "ai/text-to-image/runway",
  };
  const path = paths[model];
  if (!path) {
    throw new Error(
      `[image] unknown magnific model "${model}". Available: ${Object.keys(paths).join(", ")}`,
    );
  }

  // Map varg's imageSize enum into Magnific's aspect_ratio enum where possible.
  const aspect = mapImageSizeToMagnific(options.size);
  const body: Record<string, unknown> = { prompt };
  const ACCEPTS_ASPECT_RATIO = new Set([
    "flux-2-klein",
    "flux-pro-v1.1",
    "flux-dev",
    "hyperflux",
    "seedream-4",
    "seedream-v4.5",
    "mystic",
  ]);
  if (aspect && ACCEPTS_ASPECT_RATIO.has(model)) body.aspect_ratio = aspect;

  const result = await magnificProvider.runImage(path, body);
  const imageUrl = result.url;

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `images/magnific/${timestamp}.png`;
    uploaded = await storageProvider.uploadFromUrl(imageUrl, objectKey);
    console.log(`[image] uploaded to ${uploaded}`);
  }

  return { imageUrl, uploaded };
}

/**
 * Generate image via OpenAI native endpoint (through the varg API).
 *
 * Routes to the OpenAI provider in the varg API using the `openai:` model-key
 * prefix. Default model is `gpt-image-2.5-flare` (fast variant); use
 * `gpt-image-2.5-sunburst` for the premium tier, or any other OpenAI image
 * model id (gpt-image-2, gpt-image-1.5, gpt-image-1, chatgpt-image-latest).
 *
 * The varg API handles aspect_ratio → size mapping, file uploads, and
 * billing; this function just submits + polls and returns the output URL.
 */
export async function generateWithOpenAI(
  prompt: string,
  options: { size?: string; model?: string; upload?: boolean } = {},
): Promise<ImageGenerationResult> {
  const model = options.model ?? "gpt-image-2.5-flare";
  console.log(`[image] generating with openai (${model})`);

  const { apiKey, baseUrl } = resolveVargConfig();
  const params: Record<string, unknown> = {
    model: `openai:${model}`,
    prompt,
  };
  if (options.size) params.aspect_ratio = options.size;

  const { url: imageUrl } = await executeJobUrl(
    baseUrl,
    apiKey,
    "image",
    params,
  );

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `images/openai/${timestamp}.png`;
    uploaded = await storageProvider.uploadFromUrl(imageUrl, objectKey);
    console.log(`[image] uploaded to ${uploaded}`);
  }

  return { imageUrl, uploaded };
}

function mapImageSizeToMagnific(size?: string): string | undefined {
  if (!size) return undefined;
  const map: Record<string, string> = {
    square_hd: "square_1_1",
    square: "square_1_1",
    portrait_4_3: "traditional_3_4",
    portrait_16_9: "social_story_9_16",
    landscape_4_3: "classic_4_3",
    landscape_16_9: "widescreen_16_9",
  };
  return map[size];
}

export default definition;
