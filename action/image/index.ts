#!/usr/bin/env bun
/**
 * image generation service combining fal and higgsfield
 * usage: bun run service/image.ts <command> <args>
 */

import type { ActionMeta } from "../../cli/types";
import { generateImage } from "../../lib/fal";
import { generateSoul } from "../../lib/higgsfield";
import { uploadFromUrl } from "../../utilities/s3";

export const meta: ActionMeta = {
  name: "image",
  type: "action",
  description: "generate image from text",
  inputType: "text",
  outputType: "image",
  schema: {
    input: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: { type: "string", description: "what to generate" },
        size: {
          type: "string",
          enum: [
            "square_hd",
            "landscape_4_3",
            "portrait_4_3",
            "landscape_16_9",
          ],
          default: "landscape_4_3",
          description: "image size/aspect",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "image path" },
  },
  async run(options) {
    const { prompt, size } = options as { prompt: string; size?: string };
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
  console.log("[service/image] generating with fal");

  const result = await generateImage({ prompt, model: options.model });

  const imageUrl = result.data?.images?.[0]?.url;
  if (!imageUrl) {
    throw new Error("no image url in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `images/fal/${timestamp}.png`;
    uploaded = await uploadFromUrl(imageUrl, objectKey);
    console.log(`[service/image] uploaded to ${uploaded}`);
  }

  return { imageUrl, uploaded };
}

export async function generateWithSoul(
  prompt: string,
  options: { styleId?: string; upload?: boolean } = {},
): Promise<ImageGenerationResult> {
  console.log("[service/image] generating with higgsfield soul");

  const result = await generateSoul({
    prompt,
    styleId: options.styleId,
  });

  const imageUrl = result.jobs?.[0]?.results?.raw?.url;
  if (!imageUrl) {
    throw new Error("no image url in result");
  }

  let uploaded: string | undefined;
  if (options.upload) {
    const timestamp = Date.now();
    const objectKey = `images/soul/${timestamp}.png`;
    uploaded = await uploadFromUrl(imageUrl, objectKey);
    console.log(`[service/image] uploaded to ${uploaded}`);
  }

  return { imageUrl, uploaded };
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "fal": {
      if (!args[0]) {
        console.log(`
usage:
  bun run service/image.ts fal <prompt> [model] [upload]
        `);
        process.exit(1);
      }
      const falResult = await generateWithFal(args[0], {
        model: args[1],
        upload: args[2] === "true",
      });
      console.log(JSON.stringify(falResult, null, 2));
      break;
    }

    case "soul": {
      if (!args[0]) {
        console.log(`
usage:
  bun run service/image.ts soul <prompt> [styleId] [upload]
        `);
        process.exit(1);
      }
      const soulResult = await generateWithSoul(args[0], {
        styleId: args[1],
        upload: args[2] === "true",
      });
      console.log(JSON.stringify(soulResult, null, 2));
      break;
    }

    default:
      console.log(`
usage:
  bun run service/image.ts fal <prompt> [model] [upload]
  bun run service/image.ts soul <prompt> [styleId] [upload]
      `);
      process.exit(1);
  }
}
