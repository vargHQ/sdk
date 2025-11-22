#!/usr/bin/env bun

/**
 * replicate.com api wrapper for video/image generation
 * supports models like minimax, kling, luma, stable diffusion
 */

import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "",
});

// types
export interface RunVideoOptions {
  model: string;
  input: Record<string, unknown>;
}

export interface RunImageOptions {
  model: string;
  input: Record<string, unknown>;
}

// core functions
export async function runModel(model: string, input: Record<string, unknown>) {
  console.log(`[replicate] running ${model}...`);

  try {
    const output = await replicate.run(model as `${string}/${string}`, {
      input,
    });
    console.log(`[replicate] completed`);
    return output;
  } catch (error) {
    console.error(`[replicate] error:`, error);
    throw error;
  }
}

export async function runVideo(options: RunVideoOptions) {
  const { model, input } = options;

  if (!model || !input) {
    throw new Error("model and input are required");
  }

  return await runModel(model, input);
}

export async function runImage(options: RunImageOptions) {
  const { model, input } = options;

  if (!model || !input) {
    throw new Error("model and input are required");
  }

  return await runModel(model, input);
}

// popular models
export const MODELS = {
  // video generation
  VIDEO: {
    MINIMAX: "minimax/video-01",
    KLING: "fofr/kling-v1.5",
    LUMA: "fofr/ltx-video",
    RUNWAY_GEN3: "replicate/runway-gen3-turbo",
  },
  // image generation
  IMAGE: {
    FLUX_PRO: "black-forest-labs/flux-1.1-pro",
    FLUX_DEV: "black-forest-labs/flux-dev",
    FLUX_SCHNELL: "black-forest-labs/flux-schnell",
    STABLE_DIFFUSION: "stability-ai/sdxl",
  },
};

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run lib/replicate.ts <command> [args]

commands:
  video <model> <prompt> [imageUrl]     generate video
  image <model> <prompt>                generate image
  minimax <prompt> [imageUrl]           generate video with minimax-01
  kling <prompt> [imageUrl]             generate video with kling-v1.5
  flux <prompt>                         generate image with flux-dev
  help                                  show this help

examples:
  bun run lib/replicate.ts minimax "person walking on beach"
  bun run lib/replicate.ts minimax "camera zoom in" https://example.com/img.jpg
  bun run lib/replicate.ts kling "cinematic city scene"
  bun run lib/replicate.ts flux "cyberpunk cityscape"
  bun run lib/replicate.ts video "minimax/video-01" "dancing robot"
  bun run lib/replicate.ts image "black-forest-labs/flux-dev" "sunset landscape"

environment:
  REPLICATE_API_TOKEN - your replicate api token
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "minimax": {
        const prompt = args[1];
        const imageUrl = args[2];

        if (!prompt) {
          throw new Error("prompt is required");
        }

        const input: Record<string, unknown> = { prompt };
        if (imageUrl) {
          input.first_frame_image = imageUrl;
        }

        const output = await runVideo({
          model: MODELS.VIDEO.MINIMAX,
          input,
        });

        console.log(`[replicate] minimax output:`, output);
        break;
      }

      case "kling": {
        const prompt = args[1];
        const imageUrl = args[2];

        if (!prompt) {
          throw new Error("prompt is required");
        }

        const input: Record<string, unknown> = { prompt };
        if (imageUrl) {
          input.image = imageUrl;
        }

        const output = await runVideo({
          model: MODELS.VIDEO.KLING,
          input,
        });

        console.log(`[replicate] kling output:`, output);
        break;
      }

      case "flux": {
        const prompt = args[1];

        if (!prompt) {
          throw new Error("prompt is required");
        }

        const output = await runImage({
          model: MODELS.IMAGE.FLUX_DEV,
          input: { prompt },
        });

        console.log(`[replicate] flux output:`, output);
        break;
      }

      case "video": {
        const model = args[1];
        const prompt = args[2];
        const imageUrl = args[3];

        if (!model || !prompt) {
          throw new Error("model and prompt are required");
        }

        const input: Record<string, unknown> = { prompt };
        if (imageUrl) {
          input.image = imageUrl;
        }

        const output = await runVideo({ model, input });
        console.log(`[replicate] video output:`, output);
        break;
      }

      case "image": {
        const model = args[1];
        const prompt = args[2];

        if (!model || !prompt) {
          throw new Error("model and prompt are required");
        }

        const output = await runImage({
          model,
          input: { prompt },
        });

        console.log(`[replicate] image output:`, output);
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run lib/replicate.ts help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[replicate] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
