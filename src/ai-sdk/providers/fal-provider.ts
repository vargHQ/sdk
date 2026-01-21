import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type ImageModelV3CallOptions,
  type ImageModelV3File,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
  type TranscriptionModelV3,
  type TranscriptionModelV3CallOptions,
} from "@ai-sdk/provider";
import { fal } from "@fal-ai/client";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

const VIDEO_MODELS: Record<string, { t2v: string; i2v: string }> = {
  "kling-v2.5": {
    t2v: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
  },
  "kling-v2.1": {
    t2v: "fal-ai/kling-video/v2.1/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.1/pro/image-to-video",
  },
  "kling-v2": {
    t2v: "fal-ai/kling-video/v2/master/text-to-video",
    i2v: "fal-ai/kling-video/v2/master/image-to-video",
  },
  "wan-2.5": {
    t2v: "fal-ai/wan-25/text-to-video",
    i2v: "fal-ai/wan-25/image-to-video",
  },
  "wan-2.5-preview": {
    t2v: "fal-ai/wan-25-preview/text-to-video",
    i2v: "fal-ai/wan-25-preview/image-to-video",
  },
  minimax: {
    t2v: "fal-ai/minimax-video/text-to-video",
    i2v: "fal-ai/minimax-video/image-to-video",
  },
};

// lipsync models - video + audio input
const LIPSYNC_MODELS: Record<string, string> = {
  "sync-v2": "fal-ai/sync-lipsync",
  "sync-v2-pro": "fal-ai/sync-lipsync/v2",
  lipsync: "fal-ai/sync-lipsync",
};

const IMAGE_MODELS: Record<string, string> = {
  "flux-pro": "fal-ai/flux-pro/v1.1",
  "flux-dev": "fal-ai/flux/dev",
  "flux-schnell": "fal-ai/flux/schnell",
  "recraft-v3": "fal-ai/recraft/v3/text-to-image",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
  "nano-banana-pro/edit": "fal-ai/nano-banana-pro/edit",
  "seedream-v4.5/edit": "fal-ai/bytedance/seedream/v4.5/edit",
};

// Models that use image_size instead of aspect_ratio
const IMAGE_SIZE_MODELS = new Set(["seedream-v4.5/edit"]);

// Map aspect ratio strings to image_size enum values
const ASPECT_RATIO_TO_IMAGE_SIZE: Record<string, string> = {
  "1:1": "square",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};

const TRANSCRIPTION_MODELS: Record<string, string> = {
  whisper: "fal-ai/whisper",
  "whisper-large-v3": "fal-ai/whisper",
};

function getMediaType(file: ImageModelV3File): string | undefined {
  if (file.type === "file") return file.mediaType;
  const ext = file.url.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
  };
  return mimeTypes[ext ?? ""];
}

function detectImageType(bytes: Uint8Array): string | undefined {
  // Check magic bytes for common image formats
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return "image/webp";
  }
  return undefined;
}

async function fileToUrl(file: ImageModelV3File): Promise<string> {
  if (file.type === "url") return file.url;
  const data = file.data;
  const bytes =
    typeof data === "string"
      ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      : data;
  // Use mediaType from file if available, otherwise detect from bytes or default to png
  const mediaType = file.mediaType ?? detectImageType(bytes) ?? "image/png";
  // Create a proper ArrayBuffer copy to satisfy TS 5.9's stricter BlobPart type
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return fal.storage.upload(new Blob([buffer], { type: mediaType }));
}

async function uploadBuffer(buffer: ArrayBuffer): Promise<string> {
  return fal.storage.upload(new Blob([buffer]));
}

class FalVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "fal";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    const {
      prompt,
      duration,
      aspectRatio,
      files,
      providerOptions,
      abortSignal,
    } = options;
    const warnings: SharedV3Warning[] = [];

    const _hasVideoInput = files?.some((f) =>
      getMediaType(f)?.startsWith("video/"),
    );
    const hasImageInput = files?.some((f) =>
      getMediaType(f)?.startsWith("image/"),
    );
    const _hasAudioInput = files?.some((f) =>
      getMediaType(f)?.startsWith("audio/"),
    );

    const isLipsync = LIPSYNC_MODELS[this.modelId] !== undefined;
    const endpoint = isLipsync
      ? this.resolveLipsyncEndpoint()
      : this.resolveEndpoint(hasImageInput ?? false);

    const input: Record<string, unknown> = {
      ...(providerOptions?.fal ?? {}),
    };

    if (isLipsync) {
      const videoFile = files?.find((f) =>
        getMediaType(f)?.startsWith("video/"),
      );
      const audioFile = files?.find((f) =>
        getMediaType(f)?.startsWith("audio/"),
      );

      if (videoFile) {
        input.video_url = await fileToUrl(videoFile);
      }
      if (audioFile) {
        input.audio_url = await fileToUrl(audioFile);
      }
    } else {
      input.prompt = prompt;
      input.duration = duration ?? 5;

      if (hasImageInput && files) {
        const imageFile = files.find((f) =>
          getMediaType(f)?.startsWith("image/"),
        );
        if (imageFile) {
          input.image_url = await fileToUrl(imageFile);
        }
      } else {
        input.aspect_ratio = aspectRatio ?? "16:9";
      }

      const audioFile = files?.find((f) =>
        getMediaType(f)?.startsWith("audio/"),
      );
      if (audioFile) {
        input.audio_url = await fileToUrl(audioFile);
      }
    }

    if (options.seed !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "seed",
        details: "Seed is not supported by this model",
      });
    }

    if (options.resolution !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "resolution",
        details: "Use aspectRatio instead",
      });
    }

    if (options.fps !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "fps",
        details: "FPS is not configurable for this model",
      });
    }

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
    });

    const data = result.data as { video?: { url?: string } };
    const videoUrl = data?.video?.url;

    if (!videoUrl) {
      throw new Error("No video URL in fal response");
    }

    const videoResponse = await fetch(videoUrl, { signal: abortSignal });
    const videoBuffer = await videoResponse.arrayBuffer();

    return {
      videos: [new Uint8Array(videoBuffer)],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private resolveEndpoint(hasImage: boolean): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    const mapping = VIDEO_MODELS[this.modelId];
    if (mapping) {
      return hasImage ? mapping.i2v : mapping.t2v;
    }

    return this.modelId;
  }

  private resolveLipsyncEndpoint(): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    return LIPSYNC_MODELS[this.modelId] ?? this.modelId;
  }
}

class FalImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "fal";
  readonly modelId: string;
  readonly maxImagesPerCall = 4;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const {
      prompt,
      n,
      size,
      aspectRatio,
      seed,
      files,
      providerOptions,
      abortSignal,
    } = options;
    const warnings: SharedV3Warning[] = [];

    const input: Record<string, unknown> = {
      prompt,
      num_images: n ?? 1,
      ...(providerOptions?.fal ?? {}),
    };

    const usesImageSize = IMAGE_SIZE_MODELS.has(this.modelId);

    if (size) {
      // size format is "{width}x{height}"
      const [width, height] = size.split("x").map(Number);
      if (usesImageSize) {
        input.image_size = { width, height };
      } else {
        input.image_size = size;
      }
    }

    if (aspectRatio) {
      if (usesImageSize) {
        // Convert aspect ratio to image_size enum for models that require it
        // Only set if size wasn't already provided
        if (!input.image_size) {
          const imageSizeEnum = ASPECT_RATIO_TO_IMAGE_SIZE[aspectRatio];
          if (imageSizeEnum) {
            input.image_size = imageSizeEnum;
          } else {
            warnings.push({
              type: "unsupported",
              feature: "aspectRatio",
              details: `Aspect ratio "${aspectRatio}" not supported, use one of: ${Object.keys(ASPECT_RATIO_TO_IMAGE_SIZE).join(", ")}`,
            });
          }
        }
      } else {
        input.aspect_ratio = aspectRatio;
      }
    }

    if (seed !== undefined) {
      input.seed = seed;
    }

    const hasFiles = files && files.length > 0;
    if (hasFiles) {
      input.image_urls = await Promise.all(files.map((f) => fileToUrl(f)));
    }

    const hasImageUrls =
      hasFiles ||
      !!(providerOptions?.fal as Record<string, unknown>)?.image_urls;
    if (hasImageUrls) {
      if (!files) {
        throw new Error("No files provided");
      }
    }

    const finalEndpoint = this.resolveEndpoint();

    // Debug: log the input being sent
    if (IMAGE_SIZE_MODELS.has(this.modelId)) {
      console.log(
        "[fal-provider] seedream input:",
        JSON.stringify(input, null, 2),
      );
    }

    const result = await fal.subscribe(finalEndpoint, {
      input,
      logs: true,
    });

    const data = result.data as { images?: Array<{ url?: string }> };
    const images = data?.images ?? [];

    if (images.length === 0) {
      throw new Error("No images in fal response");
    }

    const imageBuffers = await Promise.all(
      images.map(async (img) => {
        const response = await fetch(img.url!, { signal: abortSignal });
        return new Uint8Array(await response.arrayBuffer());
      }),
    );

    return {
      images: imageBuffers,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }

  private resolveEndpoint(): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    return IMAGE_MODELS[this.modelId] ?? this.modelId;
  }
}

class FalTranscriptionModel implements TranscriptionModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "fal";
  readonly modelId: string;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: TranscriptionModelV3CallOptions) {
    const { audio, providerOptions } = options;
    const warnings: SharedV3Warning[] = [];

    const endpoint = TRANSCRIPTION_MODELS[this.modelId] ?? this.modelId;

    const audioBytes =
      typeof audio === "string"
        ? Uint8Array.from(atob(audio), (c) => c.charCodeAt(0))
        : audio;

    const audioUrl = await uploadBuffer(audioBytes.buffer as ArrayBuffer);

    const input: Record<string, unknown> = {
      audio_url: audioUrl,
      task: "transcribe",
      ...(providerOptions?.fal ?? {}),
    };

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
    });

    const data = result.data as {
      text?: string;
      chunks?: Array<{ timestamp: [number, number]; text: string }>;
      language?: string;
    };

    return {
      text: data?.text ?? "",
      segments: (data?.chunks ?? []).map((chunk) => ({
        text: chunk.text,
        startSecond: chunk.timestamp[0],
        endSecond: chunk.timestamp[1],
      })),
      language: data?.language,
      durationInSeconds: undefined,
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

export interface FalProviderSettings {
  apiKey?: string;
}

export interface FalProvider extends ProviderV3 {
  videoModel(modelId: string): VideoModelV3;
  imageModel(modelId: string): ImageModelV3;
  transcriptionModel(modelId: string): TranscriptionModelV3;
}

export function createFal(settings: FalProviderSettings = {}): FalProvider {
  if (settings.apiKey) {
    fal.config({ credentials: settings.apiKey });
  }

  return {
    specificationVersion: "v3",
    videoModel(modelId: string): FalVideoModel {
      return new FalVideoModel(modelId);
    },
    imageModel(modelId: string): FalImageModel {
      return new FalImageModel(modelId);
    },
    transcriptionModel(modelId: string): FalTranscriptionModel {
      return new FalTranscriptionModel(modelId);
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

export const fal_provider = createFal();
export { fal_provider as fal };
