/**
 * Replicate provider for varg SDK v2
 * Supports video and image models
 */

import Replicate from "replicate";
import type { ZodSchema } from "zod";
import { REPLICATE_IMAGE_SCHEMAS, REPLICATE_VIDEO_SCHEMAS } from "../schemas";
import {
  type ImageGenerateOptions,
  type ImageGenerateResult,
  type ImageModel,
  MediaResult,
  type ProviderSettings,
  type VideoGenerateOptions,
  type VideoGenerateResult,
  type VideoModel,
} from "../types";

const VIDEO_MODELS: Record<string, string> = {
  minimax: "minimax/video-01",
  "minimax-video-01": "minimax/video-01",
  kling: "fofr/kling-v1.5",
  "kling-v1.5": "fofr/kling-v1.5",
  luma: "fofr/ltx-video",
  "ltx-video": "fofr/ltx-video",
  "runway-gen3": "replicate/runway-gen3-turbo",
  "wan-2.5": "wan-video/wan-2.5-i2v",
};

const IMAGE_MODELS: Record<string, string> = {
  "flux-pro": "black-forest-labs/flux-1.1-pro",
  "flux-dev": "black-forest-labs/flux-dev",
  "flux-schnell": "black-forest-labs/flux-schnell",
  sdxl: "stability-ai/sdxl",
};

function resolveModelId(
  modelId: string,
  registry: Record<string, string>,
): string {
  if (modelId.startsWith("raw:")) {
    return modelId.slice(4);
  }
  if (registry[modelId]) {
    return registry[modelId];
  }
  return modelId;
}

async function ensureUrl(input: string | ArrayBuffer): Promise<string> {
  if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return input;
    }
    if (input.startsWith("data:")) {
      return input;
    }
    const file = Bun.file(input);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${input}`);
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = file.type || "application/octet-stream";
    return `data:${mimeType};base64,${base64}`;
  }
  const base64 = Buffer.from(input).toString("base64");
  return `data:application/octet-stream;base64,${base64}`;
}

class ReplicateVideoModel implements VideoModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "replicate";
  readonly type = "video" as const;
  readonly modelId: string;

  private settings: ReplicateProviderSettings;
  private client: Replicate;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ReplicateProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.client = new Replicate({
      auth: settings.apiKey || process.env.REPLICATE_API_TOKEN || "",
    });
    this.schema = REPLICATE_VIDEO_SCHEMAS[modelId];
  }

  async doGenerate(
    options: VideoGenerateOptions,
  ): Promise<VideoGenerateResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as VideoGenerateOptions;
    const { prompt, image, duration, aspectRatio, providerOptions } = validated;

    const model = resolveModelId(this.modelId, VIDEO_MODELS);

    const input: Record<string, unknown> = {
      prompt,
      ...(providerOptions?.replicate ?? {}),
    };

    if (image) {
      input.image = await ensureUrl(image);
    }

    if (duration) {
      input.duration = duration;
    }

    if (aspectRatio && !image) {
      input.aspect_ratio = aspectRatio;
    }

    console.log(`[replicate] generating video with ${model}...`);

    const output = await this.client.run(model as `${string}/${string}`, {
      input,
    });

    const videoUrl = Array.isArray(output) ? output[0] : output;

    if (!videoUrl || typeof videoUrl !== "string") {
      throw new Error("No video URL in replicate response");
    }

    console.log(`[replicate] video generated: ${videoUrl}`);

    return {
      video: new MediaResult(videoUrl, "video/mp4"),
    };
  }
}

class ReplicateImageModel implements ImageModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "replicate";
  readonly type = "image" as const;
  readonly modelId: string;

  private settings: ReplicateProviderSettings;
  private client: Replicate;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ReplicateProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.client = new Replicate({
      auth: settings.apiKey || process.env.REPLICATE_API_TOKEN || "",
    });
    this.schema = REPLICATE_IMAGE_SCHEMAS[modelId];
  }

  async doGenerate(
    options: ImageGenerateOptions,
  ): Promise<ImageGenerateResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as ImageGenerateOptions;
    const { prompt, size, n, providerOptions } = validated;

    const model = resolveModelId(this.modelId, IMAGE_MODELS);

    const input: Record<string, unknown> = {
      ...(providerOptions?.replicate ?? {}),
    };

    if (typeof prompt === "string") {
      input.prompt = prompt;
    } else {
      input.prompt = prompt.text;
      if (prompt.images && prompt.images.length > 0 && prompt.images[0]) {
        input.image = await ensureUrl(prompt.images[0]);
      }
    }

    if (size) {
      input.aspect_ratio = size;
    }

    if (n && n > 1) {
      input.num_outputs = n;
    }

    console.log(`[replicate] generating image with ${model}...`);

    const output = await this.client.run(model as `${string}/${string}`, {
      input,
    });

    const urls = Array.isArray(output) ? output : [output];

    if (!urls.length || typeof urls[0] !== "string") {
      throw new Error("No image URL in replicate response");
    }

    console.log(`[replicate] generated ${urls.length} image(s)`);

    return {
      images: urls.map((url) => new MediaResult(url as string, "image/png")),
    };
  }
}

export interface ReplicateProviderSettings extends ProviderSettings {}

export interface ReplicateProvider {
  video(modelId: string): VideoModel;
  image(modelId: string): ImageModel;
}

export function createReplicate(
  settings: ReplicateProviderSettings = {},
): ReplicateProvider {
  return {
    video(modelId: string) {
      return new ReplicateVideoModel(modelId, settings);
    },
    image(modelId: string) {
      return new ReplicateImageModel(modelId, settings);
    },
  };
}

export const replicate_provider = createReplicate();

export { replicate_provider as replicate };
