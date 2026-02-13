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
import pMap from "p-map";
import type { CacheStorage } from "../cache";
import { fileCache } from "../file-cache";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

interface PendingRequest {
  request_id: string;
  endpoint: string;
  submitted_at: number;
}

const memoryStorage = new Map<string, { value: unknown; expires: number }>();

function createMemoryCache(): CacheStorage {
  return {
    async get(key: string) {
      const entry = memoryStorage.get(key);
      if (!entry) return undefined;
      if (entry.expires && Date.now() > entry.expires) {
        memoryStorage.delete(key);
        return undefined;
      }
      return entry.value;
    },
    async set(key: string, value: unknown, ttl?: number) {
      memoryStorage.set(key, { value, expires: ttl ? Date.now() + ttl : 0 });
    },
    async delete(key: string) {
      memoryStorage.delete(key);
    },
  };
}

// TODO: allow passing CacheStorage via providerOptions.fal.cacheStorage for proper serverless support
function createFalCache(name: string): CacheStorage {
  let cache: CacheStorage | null = null;
  let useFallback = false;
  const fallback = createMemoryCache();

  const getCache = () => {
    if (useFallback) return fallback;
    if (!cache) cache = fileCache({ dir: `.cache/${name}` });
    return cache;
  };

  return {
    async get(key) {
      if (useFallback) return fallback.get(key);
      try {
        return await getCache().get(key);
      } catch {
        useFallback = true;
        return fallback.get(key);
      }
    },
    async set(key, value, ttl) {
      if (useFallback) return fallback.set(key, value, ttl);
      try {
        await getCache().set(key, value, ttl);
      } catch {
        useFallback = true;
        await fallback.set(key, value, ttl);
      }
    },
    async delete(key) {
      if (useFallback) return fallback.delete(key);
      try {
        await getCache().delete(key);
      } catch {
        useFallback = true;
        await fallback.delete(key);
      }
    },
  };
}

const pendingStorage = createFalCache("fal-pending");

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const FAL_TIMEOUT_MS = (() => {
  if (!process.env.FAL_TIMEOUT_MS) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(process.env.FAL_TIMEOUT_MS, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
})();

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
    t2v: "fal-ai/ltx-2-19b/distilled/text-to-video",
    i2v: "fal-ai/ltx-2-19b/distilled/image-to-video",
  },
  // Grok Imagine Video - xAI's video generation with audio
  "grok-imagine": {
    t2v: "xai/grok-imagine-video/text-to-video",
    i2v: "xai/grok-imagine-video/image-to-video",
  },
};

// Video edit models - video-to-video editing
const VIDEO_EDIT_MODELS: Record<string, string> = {
  "grok-imagine-edit": "xai/grok-imagine-video/edit-video",
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
  // Qwen Image Edit 2511 Multiple Angles - camera angle adjustment
  "qwen-angles": "fal-ai/qwen-image-edit-2511-multiple-angles",
};

// Models that use image_size instead of aspect_ratio
const IMAGE_SIZE_MODELS = new Set([
  "flux-schnell",
  "flux-dev",
  "flux-pro",
  "seedream-v4.5/edit",
]);

// Qwen Angles model - image-to-image with camera angle adjustment
const QWEN_ANGLES_MODEL = "qwen-angles";

// Map aspect ratio to image_size for Qwen Angles (base dimension 1024)
const ASPECT_RATIO_TO_QWEN_SIZE: Record<
  string,
  { width: number; height: number }
> = {
  "1:1": { width: 1024, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "3:4": { width: 768, height: 1024 },
  "16:9": { width: 1024, height: 576 },
  "9:16": { width: 576, height: 1024 },
  "3:2": { width: 1024, height: 683 },
  "2:3": { width: 683, height: 1024 },
};

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

const uploadCache = createFalCache("fal-uploads");

async function fileToUrl(file: ImageModelV3File): Promise<string> {
  if (file.type === "url") return file.url;
  const data = file.data;
  const bytes =
    typeof data === "string"
      ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      : data;

  const hash = Bun.hash(bytes).toString(16);
  const cached = (await uploadCache.get(hash)) as string | undefined;
  if (cached) return cached;

  const mediaType = file.mediaType ?? detectImageType(bytes) ?? "image/png";
  const url = await fal.storage.upload(new Blob([bytes], { type: mediaType }));
  await uploadCache.set(hash, url, 7 * 24 * 60 * 60 * 1000);
  return url;
}

async function uploadBuffer(buffer: ArrayBuffer): Promise<string> {
  return fal.storage.upload(new Blob([buffer]));
}

export function computePendingKey(
  endpoint: string,
  input: Record<string, unknown>,
  stableKey?: string,
): string {
  const keyData = stableKey ?? JSON.stringify({ endpoint, input });
  const hash = Bun.hash(keyData).toString(16);
  return `pending_${hash}`;
}

export async function computeFileHashes(
  files: ImageModelV3File[] | undefined,
): Promise<string[]> {
  if (!files || files.length === 0) return [];
  return Promise.all(
    files.map(async (f) => {
      if (f.type === "url") return f.url;
      const bytes =
        typeof f.data === "string"
          ? Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))
          : f.data;
      return Bun.hash(bytes).toString(16);
    }),
  );
}

async function executeWithQueueRecovery<T>(
  endpoint: string,
  input: Record<string, unknown>,
  options: {
    logs?: boolean;
    onQueueUpdate?: (status: { status: string }) => void;
    stableKey?: string;
  } = {},
): Promise<T> {
  const { logs = true, onQueueUpdate, stableKey } = options;
  const pendingKey = computePendingKey(endpoint, input, stableKey);

  const pending = (await pendingStorage.get(pendingKey)) as
    | PendingRequest
    | undefined;

  if (pending) {
    try {
      const status = await fal.queue.status(pending.endpoint, {
        requestId: pending.request_id,
        logs,
      });

      if (status.status === "COMPLETED") {
        console.log(
          `\x1b[32m⚡ recovered completed job from queue (${pending.request_id.slice(0, 8)}...)\x1b[0m`,
        );
        const result = await fal.queue.result(pending.endpoint, {
          requestId: pending.request_id,
        });
        await pendingStorage.delete(pendingKey);
        return result as T;
      }

      if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
        console.log(
          `\x1b[33m⏳ resuming pending job (${pending.request_id.slice(0, 8)}...) - status: ${status.status}\x1b[0m`,
        );
        await fal.queue.subscribeToStatus(pending.endpoint, {
          requestId: pending.request_id,
          logs,
          timeout: FAL_TIMEOUT_MS,
          onQueueUpdate,
        });
        const result = await fal.queue.result(pending.endpoint, {
          requestId: pending.request_id,
        });
        await pendingStorage.delete(pendingKey);
        return result as T;
      }

      await pendingStorage.delete(pendingKey);
    } catch (error) {
      const isNotFound =
        error instanceof Error &&
        (error.message.includes("not found") ||
          error.message.includes("404") ||
          error.message.includes("does not exist"));

      if (isNotFound) {
        console.log(
          `\x1b[33m⚠ pending job expired or not found, submitting new request\x1b[0m`,
        );
        await pendingStorage.delete(pendingKey);
      } else {
        console.log(
          `\x1b[33m⚠ pending job check failed (${error instanceof Error ? error.message : "unknown"}), keeping for retry\x1b[0m`,
        );
        throw error;
      }
    }
  }

  const { request_id } = await fal.queue.submit(endpoint, { input });

  await pendingStorage.set(
    pendingKey,
    {
      request_id,
      endpoint,
      submitted_at: Date.now(),
    } satisfies PendingRequest,
    24 * 60 * 60 * 1000,
  );

  console.log(
    `\x1b[36m📋 queued job ${request_id.slice(0, 8)}... (recoverable on timeout)\x1b[0m`,
  );

  try {
    await fal.queue.subscribeToStatus(endpoint, {
      requestId: request_id,
      logs,
      timeout: FAL_TIMEOUT_MS,
      onQueueUpdate,
    });

    const result = await fal.queue.result(endpoint, {
      requestId: request_id,
    });

    await pendingStorage.delete(pendingKey);
    return result as T;
  } catch (error) {
    console.log(
      `\x1b[33m⚠ job ${request_id.slice(0, 8)}... saved for recovery on next run\x1b[0m`,
    );
    throw error;
  }
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
    const isMotionControl = MOTION_CONTROL_MODELS[this.modelId] !== undefined;
    const isVideoEdit = VIDEO_EDIT_MODELS[this.modelId] !== undefined;
    const isKlingV26 = this.modelId === "kling-v2.6";
    const isLtx2 = this.modelId === "ltx-2-19b-distilled";
    const isGrokImagine = this.modelId === "grok-imagine";

    const fileHashes = await computeFileHashes(files as ImageModelV3File[]);

    const endpoint = isLipsync
      ? this.resolveLipsyncEndpoint()
      : isMotionControl
        ? this.resolveMotionControlEndpoint()
        : isVideoEdit
          ? this.resolveVideoEditEndpoint()
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
    } else if (isVideoEdit) {
      // Video edit: video input + prompt for editing instruction
      input.prompt = prompt;

      const videoFile = files?.find((f) =>
        getMediaType(f)?.startsWith("video/"),
      );

      if (videoFile) {
        input.video_url = await fileToUrl(videoFile);
      }

      // Grok Imagine Edit supports resolution: "auto", "480p", "720p"
      if (!input.resolution) {
        input.resolution = "auto";
      }
    } else {
      // Standard video generation
      input.prompt = prompt;

      // LTX-2 uses num_frames instead of duration, and has different defaults
      if (isLtx2) {
        // LTX-2: convert duration to num_frames (25fps default)
        // Always set num_frames from duration unless explicitly provided via providerOptions
        if (input.num_frames === undefined) {
          const fps = (input.fps as number) ?? 25;
          const durationSec = duration ?? 5; // default 5 seconds
          input.num_frames = Math.round(durationSec * fps);
        }
        // LTX-2 uses video_size instead of aspect_ratio
        if (input.video_size === undefined) {
          input.video_size = "auto";
        }
      } else if (isKlingV26) {
        // Duration must be string "5" or "10" for Kling v2.6
        input.duration = String(duration ?? 5);
      } else if (isGrokImagine) {
        // Grok Imagine: duration 1-15 seconds (default 6)
        input.duration = duration ?? 6;
        // Grok Imagine supports resolution: "480p", "720p" (default "720p")
        if (!input.resolution) {
          input.resolution = "720p";
        }
      } else {
        input.duration = duration ?? 5;
      }

      if (hasImageInput && files) {
        const imageFiles = files.filter((f) =>
          getMediaType(f)?.startsWith("image/"),
        );
        const firstImage = imageFiles[0];
        if (firstImage) {
          // First image is start image
          input.image_url = await fileToUrl(firstImage);
          // Second image (if provided) is end image for Kling v2.6 and LTX-2
          const secondImage = imageFiles[1];
          if ((isKlingV26 || isLtx2) && secondImage) {
            input.end_image_url = await fileToUrl(secondImage);
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

    const isWan = this.modelId.startsWith("wan-");
    const supportsSeed = isLtx2 || isWan;

    if (options.seed !== undefined) {
      if (supportsSeed) {
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

    const stableKey =
      fileHashes.length > 0
        ? JSON.stringify({
            endpoint,
            prompt,
            duration,
            aspectRatio,
            providerOptions,
            modelId: this.modelId,
            fileHashes,
          })
        : undefined;

    const result = await executeWithQueueRecovery<{ data: unknown }>(
      endpoint,
      input,
      { logs: true, stableKey },
    );

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

  private resolveVideoEditEndpoint(): string {
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    return VIDEO_EDIT_MODELS[this.modelId] ?? this.modelId;
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

    const isQwenAngles = this.modelId === QWEN_ANGLES_MODEL;

    const input: Record<string, unknown> = {
      num_images: n ?? 1,
      ...(providerOptions?.fal ?? {}),
    };

    // Qwen Angles uses additional_prompt instead of prompt
    if (isQwenAngles) {
      if (prompt) {
        input.additional_prompt = prompt;
      }
      // Qwen Angles supports "regular" or "none" acceleration, not "high"
      if (!input.acceleration) {
        input.acceleration = "regular";
      }
    } else {
      input.prompt = prompt;
      // Use high acceleration for faster queue processing on supported models (flux-schnell)
      input.acceleration = "high";
    }

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
      if (isQwenAngles) {
        // Convert aspect ratio to image_size dimensions for Qwen Angles
        if (!input.image_size) {
          const qwenSize = ASPECT_RATIO_TO_QWEN_SIZE[aspectRatio];
          if (qwenSize) {
            input.image_size = qwenSize;
          } else {
            warnings.push({
              type: "unsupported",
              feature: "aspectRatio",
              details: `Aspect ratio "${aspectRatio}" not supported for qwen-angles, use one of: ${Object.keys(ASPECT_RATIO_TO_QWEN_SIZE).join(", ")}`,
            });
          }
        }
      } else if (usesImageSize) {
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
    const finalEndpoint = this.resolveEndpoint();

    let stableKey: string | undefined;
    if (hasFiles && files) {
      const fileHashes = await computeFileHashes(files);
      stableKey = JSON.stringify({
        endpoint: finalEndpoint,
        prompt,
        n,
        size,
        aspectRatio,
        seed,
        providerOptions,
        modelId: this.modelId,
        fileHashes,
      });
      input.image_urls = await pMap(files, fileToUrl, { concurrency: 2 });
    }

    if (isQwenAngles && !input.image_urls) {
      throw new Error("qwen-angles requires at least one image file");
    }

    const hasImageUrls =
      hasFiles ||
      !!(providerOptions?.fal as Record<string, unknown>)?.image_urls;
    if (hasImageUrls) {
      if (!files && !isQwenAngles) {
        throw new Error("No files provided");
      }
    }

    const result = await executeWithQueueRecovery<{ data: unknown }>(
      finalEndpoint,
      input,
      { logs: true, stableKey },
    );

    const data = result.data as { images?: Array<{ url?: string }> };
    const images = data?.images ?? [];

    if (images.length === 0) {
      throw new Error("No images in fal response");
    }

    const imageBuffers = await Promise.all(
      images.map(async (img) => {
        if (!img.url) throw new Error("Image URL is missing");
        const response = await fetch(img.url, { signal: abortSignal });
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
