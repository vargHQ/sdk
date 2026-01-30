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
  // Kling v2.6 - latest with native audio generation
  "kling-v2.6": {
    t2v: "fal-ai/kling-video/v2.6/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.6/pro/image-to-video",
  },
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
  // LTX-2 19B Distilled - video with native audio generation
  "ltx-2-19b-distilled": {
    t2v: "fal-ai/ltx-2-19b/distilled/image-to-video", // i2v only, requires image input
    i2v: "fal-ai/ltx-2-19b/distilled/image-to-video",
  },
};

// Motion control models - video-to-video with motion transfer
const MOTION_CONTROL_MODELS: Record<string, string> = {
  "kling-v2.6-motion": "fal-ai/kling-video/v2.6/pro/motion-control",
  "kling-v2.6-motion-standard":
    "fal-ai/kling-video/v2.6/standard/motion-control",
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
const IMAGE_SIZE_MODELS = new Set([
  "flux-schnell",
  "flux-dev",
  "flux-pro",
  "seedream-v4.5/edit",
]);

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
  return fal.storage.upload(new Blob([bytes], { type: mediaType }));
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

    const hasVideoInput = files?.some((f) =>
      getMediaType(f)?.startsWith("video/"),
    );
    const hasImageInput = files?.some((f) =>
      getMediaType(f)?.startsWith("image/"),
    );
    const _hasAudioInput = files?.some((f) =>
      getMediaType(f)?.startsWith("audio/"),
    );

    const isLipsync = LIPSYNC_MODELS[this.modelId] !== undefined;
    const isMotionControl = MOTION_CONTROL_MODELS[this.modelId] !== undefined;
    const isKlingV26 = this.modelId === "kling-v2.6";
    const isLtx2 = this.modelId === "ltx-2-19b-distilled";

    const endpoint = isLipsync
      ? this.resolveLipsyncEndpoint()
      : isMotionControl
        ? this.resolveMotionControlEndpoint()
        : this.resolveEndpoint(hasImageInput ?? false);

    const input: Record<string, unknown> = {
      ...(providerOptions?.fal ?? {}),
    };

    if (isLipsync) {
      // Lipsync: video + audio input
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
    } else if (isMotionControl) {
      // Motion control: image + reference video input
      if (prompt) {
        input.prompt = prompt;
      }

      const imageFile = files?.find((f) =>
        getMediaType(f)?.startsWith("image/"),
      );
      const videoFile = files?.find((f) =>
        getMediaType(f)?.startsWith("video/"),
      );

      if (imageFile) {
        input.image_url = await fileToUrl(imageFile);
      }
      if (videoFile) {
        input.video_url = await fileToUrl(videoFile);
      }

      // Default character orientation to 'video' for better motion matching
      if (!input.character_orientation) {
        input.character_orientation = "video";
      }

      // Default to keeping original sound
      if (input.keep_original_sound === undefined) {
        input.keep_original_sound = true;
      }
    } else {
      // Standard video generation
      input.prompt = prompt;

      // LTX-2 uses num_frames instead of duration, and has different defaults
      if (isLtx2) {
        // LTX-2: num_frames controls length (default 121 = ~4.8s at 25fps)
        // Only set if not already provided via providerOptions
        if (input.num_frames === undefined && duration) {
          // Convert duration to approximate frame count (25fps default)
          const fps = (input.fps as number) ?? 25;
          input.num_frames = Math.round(duration * fps);
        }
        // LTX-2 uses video_size instead of aspect_ratio
        if (input.video_size === undefined) {
          input.video_size = "auto";
        }
      } else if (isKlingV26) {
        // Duration must be string "5" or "10" for Kling v2.6
        input.duration = String(duration ?? 5);
      } else {
        input.duration = duration ?? 5;
      }

      if (hasImageInput && files) {
        const imageFiles = files.filter((f) =>
          getMediaType(f)?.startsWith("image/"),
        );
        if (imageFiles.length > 0) {
          // First image is start image
          input.image_url = await fileToUrl(imageFiles[0]!);
          // Second image (if provided) is end image for Kling v2.6 and LTX-2
          if ((isKlingV26 || isLtx2) && imageFiles.length > 1) {
            input.end_image_url = await fileToUrl(imageFiles[1]!);
          }
        }
      } else if (!isLtx2) {
        // LTX-2 uses video_size, not aspect_ratio
        input.aspect_ratio = aspectRatio ?? "16:9";
      }

      // Kling v2.6 and LTX-2 support native audio generation
      if (isKlingV26 || isLtx2) {
        // Default to generating audio unless explicitly disabled
        if (input.generate_audio === undefined) {
          input.generate_audio = true;
        }
      }

      // LTX-2 specific defaults
      if (isLtx2) {
        // Enable multiscale for better coherence (default: true)
        if (input.use_multiscale === undefined) {
          input.use_multiscale = true;
        }
        // Enable prompt expansion for better results (default: true)
        if (input.enable_prompt_expansion === undefined) {
          input.enable_prompt_expansion = true;
        }
      }

      const audioFile = files?.find((f) =>
        getMediaType(f)?.startsWith("audio/"),
      );
      if (audioFile) {
        input.audio_url = await fileToUrl(audioFile);
      }
    }

    // LTX-2 supports seed, other models don't
    if (options.seed !== undefined) {
      if (isLtx2) {
        input.seed = options.seed;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "seed",
          details: "Seed is not supported by this model",
        });
      }
    }

    if (options.resolution !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "resolution",
        details: "Use aspectRatio instead",
      });
    }

    // LTX-2 supports fps configuration
    if (options.fps !== undefined) {
      if (isLtx2) {
        input.fps = options.fps;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "fps",
          details: "FPS is not configurable for this model",
        });
      }
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

  private resolveMotionControlEndpoint(): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    return MOTION_CONTROL_MODELS[this.modelId] ?? this.modelId;
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
      // Use high acceleration for faster queue processing on supported models (flux-schnell)
      acceleration: "high",
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

    // Timing diagnostics
    const t0 = Date.now();
    let lastStatus = "";
    const queueStartTime = t0;
    let processingStartTime = 0;

    const result = await fal.subscribe(finalEndpoint, {
      input,
      logs: true,
      onQueueUpdate: (status) => {
        const elapsed = Date.now() - t0;
        if (status.status !== lastStatus) {
          if (status.status === "IN_PROGRESS" && !processingStartTime) {
            processingStartTime = Date.now();
            console.log(
              `[fal-timing] ${this.modelId}: IN_QUEUE took ${processingStartTime - queueStartTime}ms`,
            );
          }
          console.log(
            `[fal-timing] ${this.modelId}: status=${status.status} at ${elapsed}ms`,
          );
          lastStatus = status.status;
        }
      },
    });

    const subscribeTime = Date.now() - t0;
    console.log(
      `[fal-timing] ${this.modelId}: total subscribe took ${subscribeTime}ms`,
    );

    const data = result.data as { images?: Array<{ url?: string }> };
    const images = data?.images ?? [];

    if (images.length === 0) {
      throw new Error("No images in fal response");
    }

    const t1 = Date.now();
    const imageBuffers = await Promise.all(
      images.map(async (img) => {
        const response = await fetch(img.url!, { signal: abortSignal });
        return new Uint8Array(await response.arrayBuffer());
      }),
    );
    const downloadTime = Date.now() - t1;
    console.log(
      `[fal-timing] ${this.modelId}: image download took ${downloadTime}ms`,
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
  const apiKey =
    settings.apiKey ?? process.env.FAL_API_KEY ?? process.env.FAL_KEY;
  if (apiKey) {
    fal.config({ credentials: apiKey });
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
