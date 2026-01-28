/**
 * Decart AI provider for the AI SDK
 *
 * Supports:
 * - Video generation (text-to-video, image-to-video, video-to-video)
 * - Image generation (text-to-image, image-to-image)
 *
 * Uses the @decartai/sdk queue API for batch video jobs
 * and the process API for synchronous image generation.
 */

import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type ImageModelV3CallOptions,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
} from "@ai-sdk/provider";
import {
  createDecartClient,
  models as decartModels,
  type JobStatusResponse,
} from "@decartai/sdk";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

// ============================================================================
// Model ID mappings
// ============================================================================

const VIDEO_MODELS: Record<string, string> = {
  // Video-to-video
  "lucy-pro-v2v": "lucy-pro-v2v",
  "lucy-fast-v2v": "lucy-fast-v2v",
  // Text-to-video
  "lucy-pro-t2v": "lucy-pro-t2v",
  // Image-to-video
  "lucy-pro-i2v": "lucy-pro-i2v",
  "lucy-dev-i2v": "lucy-dev-i2v",
  // Special
  "lucy-motion": "lucy-motion",
  "lucy-pro-flf2v": "lucy-pro-flf2v",
  "lucy-restyle-v2v": "lucy-restyle-v2v",
};

const IMAGE_MODELS: Record<string, string> = {
  "lucy-pro-t2i": "lucy-pro-t2i",
  "lucy-pro-i2i": "lucy-pro-i2i",
};

// ============================================================================
// Helpers
// ============================================================================

function getClient(apiKey?: string) {
  const key = apiKey ?? process.env.DECART_API_KEY;
  if (!key) {
    throw new Error(
      "DECART_API_KEY environment variable is required. Get one at https://platform.decart.ai",
    );
  }
  return createDecartClient({ apiKey: key });
}

function detectMediaType(
  file: import("@ai-sdk/provider").ImageModelV3File,
): string | undefined {
  if (file.type === "file") return file.mediaType;
  const ext = file.url.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return mimeTypes[ext ?? ""];
}

async function fileToBlob(
  file: import("@ai-sdk/provider").ImageModelV3File,
): Promise<Blob> {
  if (file.type === "url") {
    const response = await fetch(file.url);
    return await response.blob();
  }
  const data = file.data;
  const bytes =
    typeof data === "string"
      ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      : data;
  const mediaType = file.mediaType ?? "application/octet-stream";
  return new Blob([bytes], { type: mediaType });
}

// ============================================================================
// Video Model
// ============================================================================

class DecartVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "decart";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  private apiKey?: string;

  constructor(modelId: string, options: { apiKey?: string } = {}) {
    this.modelId = modelId;
    this.apiKey = options.apiKey;
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    const { prompt, files, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];
    const client = getClient(this.apiKey);

    const modelName = VIDEO_MODELS[this.modelId] ?? this.modelId;
    const videoModel = decartModels.video(modelName as "lucy-pro-v2v");

    // Build queue input
    const input: Record<string, unknown> = {
      model: videoModel,
      prompt: prompt ?? "",
      enhance_prompt: true,
      ...(providerOptions?.decart as Record<string, unknown>),
    };

    // Handle resolution via providerOptions (Decart uses "480p" / "720p" strings)
    if (options.resolution) {
      // Map "1280x720" -> "720p", "854x480" -> "480p"
      const [, height] = options.resolution.split("x").map(Number);
      if (height && height <= 480) {
        input.resolution = "480p";
      } else {
        input.resolution = "720p";
      }
    }

    if (options.seed !== undefined) {
      input.seed = options.seed;
    }

    // Handle file inputs
    if (files && files.length > 0) {
      const videoFile = files.find((f) =>
        detectMediaType(f)?.startsWith("video/"),
      );
      const imageFile = files.find((f) =>
        detectMediaType(f)?.startsWith("image/"),
      );

      // Primary input data (video or image)
      if (videoFile) {
        input.data = await fileToBlob(videoFile);
      } else if (imageFile) {
        input.data = await fileToBlob(imageFile);
      }

      // Second image file used as reference_image
      const secondImage = files.filter((f) =>
        detectMediaType(f)?.startsWith("image/"),
      )[1];
      if (secondImage) {
        input.reference_image = await fileToBlob(secondImage);
      }
    }

    // Unsupported option warnings
    if (options.aspectRatio !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "aspectRatio",
        details:
          "Decart uses resolution (480p/720p) instead. Pass resolution or use providerOptions.decart.resolution.",
      });
    }

    if (options.duration !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "duration",
        details: "Decart video duration is determined by the model.",
      });
    }

    if (options.fps !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "fps",
        details: "FPS is not configurable for Decart batch models.",
      });
    }

    // Submit and poll
    input.onStatusChange = (job: JobStatusResponse) => {
      console.log(`[decart-ai-sdk] job ${job.job_id}: ${job.status}`);
    };
    const result = await client.queue.submitAndPoll(input as never);

    // The result contains a blob of the video
    const blob = result as unknown as Blob;
    let videoBytes: Uint8Array;

    if (blob instanceof Blob) {
      videoBytes = new Uint8Array(await blob.arrayBuffer());
    } else {
      // If result has a different shape, try to extract data
      const resultAny = result as Record<string, unknown>;
      if (resultAny.data instanceof Blob) {
        videoBytes = new Uint8Array(
          await (resultAny.data as Blob).arrayBuffer(),
        );
      } else if (resultAny.url && typeof resultAny.url === "string") {
        const response = await fetch(resultAny.url as string, {
          signal: abortSignal,
        });
        videoBytes = new Uint8Array(await response.arrayBuffer());
      } else {
        throw new Error(
          "Unexpected Decart result format: no video blob or URL found",
        );
      }
    }

    return {
      videos: [videoBytes],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

// ============================================================================
// Image Model
// ============================================================================

class DecartImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "decart";
  readonly modelId: string;
  readonly maxImagesPerCall = 1;

  private apiKey?: string;

  constructor(modelId: string, options: { apiKey?: string } = {}) {
    this.modelId = modelId;
    this.apiKey = options.apiKey;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const { prompt, files, providerOptions, abortSignal } = options;
    const warnings: SharedV3Warning[] = [];
    const client = getClient(this.apiKey);

    const modelName = IMAGE_MODELS[this.modelId] ?? this.modelId;
    const isI2I = modelName === "lucy-pro-i2i";

    const imageModel = isI2I
      ? decartModels.image("lucy-pro-i2i")
      : decartModels.image("lucy-pro-t2i");

    // Build process input
    const input: Record<string, unknown> = {
      model: imageModel,
      prompt: prompt ?? "",
      enhance_prompt: true,
      ...(providerOptions?.decart as Record<string, unknown>),
    };

    // Handle resolution
    if (options.aspectRatio) {
      // Decart uses orientation, not aspect ratio
      const [w, h] = options.aspectRatio.split(":").map(Number);
      if (w && h) {
        input.orientation = w > h ? "landscape" : "portrait";
      }
    }

    if (options.seed !== undefined) {
      input.seed = options.seed;
    }

    // Handle image input for i2i
    if (isI2I && files && files.length > 0) {
      input.data = await fileToBlob(files[0]!);
    }

    // Unsupported option warnings
    if (options.size !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "size",
        details:
          "Decart uses resolution (480p/720p). Pass via providerOptions.decart.resolution.",
      });
    }

    const result = await client.process(input as never);
    const blob = result as Blob;

    let imageBytes: Uint8Array;
    if (blob instanceof Blob) {
      imageBytes = new Uint8Array(await blob.arrayBuffer());
    } else {
      throw new Error("Unexpected Decart image result format");
    }

    return {
      images: [imageBytes],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

// ============================================================================
// Provider
// ============================================================================

export interface DecartProviderSettings {
  apiKey?: string;
}

export interface DecartProvider extends ProviderV3 {
  videoModel(modelId: string): VideoModelV3;
  imageModel(modelId: string): ImageModelV3;
}

export function createDecart(
  settings: DecartProviderSettings = {},
): DecartProvider {
  const apiKey = settings.apiKey ?? process.env.DECART_API_KEY;

  return {
    specificationVersion: "v3",
    videoModel(modelId: string): DecartVideoModel {
      return new DecartVideoModel(modelId, { apiKey });
    },
    imageModel(modelId: string): DecartImageModel {
      return new DecartImageModel(modelId, { apiKey });
    },
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({
        modelId,
        modelType: "languageModel",
      });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({
        modelId,
        modelType: "embeddingModel",
      });
    },
  };
}

export const decart = createDecart();
