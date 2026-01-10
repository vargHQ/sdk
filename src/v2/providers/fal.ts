/**
 * Fal.ai provider for varg SDK v2
 * Supports video, image, sync, and transcription models
 */

import { fal } from "@fal-ai/client";
import type { ZodSchema } from "zod";
import {
  FAL_IMAGE_SCHEMAS,
  FAL_SYNC_SCHEMAS,
  FAL_TRANSCRIPTION_SCHEMAS,
  FAL_VIDEO_SCHEMAS,
} from "../schemas";
import {
  type ImageGenerateOptions,
  type ImageGenerateResult,
  type ImageModel,
  MediaResult,
  type ProviderSettings,
  type SyncModel,
  type SyncOptions,
  type SyncResult,
  type TranscribeOptions,
  type TranscribeResult,
  type TranscriptionModel,
  type VideoGenerateOptions,
  type VideoGenerateResult,
  type VideoModel,
} from "../types";

// ============================================================================
// Model ID mappings (friendly -> raw)
// ============================================================================

const VIDEO_MODELS: Record<string, { t2v: string; i2v: string }> = {
  "kling-v2.5": {
    t2v: "fal-ai/kling-video/v2.5/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.5/pro/image-to-video",
  },
  "kling-v2": {
    t2v: "fal-ai/kling-video/v2/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2/pro/image-to-video",
  },
  "kling-v1.5": {
    t2v: "fal-ai/kling-video/v1.5/pro/text-to-video",
    i2v: "fal-ai/kling-video/v1.5/pro/image-to-video",
  },
  "wan-2.5": {
    t2v: "fal-ai/wan-25/text-to-video",
    i2v: "fal-ai/wan-25/image-to-video",
  },
  minimax: {
    t2v: "fal-ai/minimax-video/text-to-video",
    i2v: "fal-ai/minimax-video/image-to-video",
  },
};

const IMAGE_MODELS: Record<string, string> = {
  "flux-pro": "fal-ai/flux-pro/v1.1",
  "flux-dev": "fal-ai/flux/dev",
  "flux-schnell": "fal-ai/flux/schnell",
  "recraft-v3": "fal-ai/recraft/v3/text-to-image",
};

const SYNC_MODELS: Record<string, string> = {
  lipsync: "fal-ai/lipsync",
  "lipsync-v2": "fal-ai/lipsync/v2",
  sadtalker: "fal-ai/sadtalker",
};

const TRANSCRIPTION_MODELS: Record<string, string> = {
  whisper: "fal-ai/whisper",
  "whisper-large-v3": "fal-ai/whisper",
};

// ============================================================================
// Helper functions
// ============================================================================

function resolveModelId(
  modelId: string,
  registry: Record<string, string>,
): string {
  // raw: prefix passes through
  if (modelId.startsWith("raw:")) {
    return modelId.slice(4);
  }
  // check friendly name
  if (registry[modelId]) {
    return registry[modelId];
  }
  // assume it's already a raw fal model id
  return modelId;
}

async function ensureUrl(
  input: string | ArrayBuffer,
  upload: (buffer: ArrayBuffer) => Promise<string>,
): Promise<string> {
  if (typeof input === "string") {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      return input;
    }
    // local file path
    const file = Bun.file(input);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${input}`);
    }
    const buffer = await file.arrayBuffer();
    return upload(buffer);
  }
  // ArrayBuffer
  return upload(input);
}

async function uploadToFal(buffer: ArrayBuffer): Promise<string> {
  return fal.storage.upload(new Blob([buffer]));
}

// ============================================================================
// Fal Video Model
// ============================================================================

class FalVideoModel implements VideoModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "fal";
  readonly type = "video" as const;
  readonly modelId: string;

  private settings: ProviderSettings;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.schema = FAL_VIDEO_SCHEMAS[modelId];
  }

  async doGenerate(
    options: VideoGenerateOptions,
  ): Promise<VideoGenerateResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as VideoGenerateOptions;
    const { prompt, image, duration, aspectRatio, providerOptions } = validated;

    // resolve endpoint based on whether image is provided
    const hasImage = !!image;
    const endpoint = this.resolveEndpoint(hasImage);

    // build input
    const input: Record<string, unknown> = {
      prompt,
      duration: duration ?? 5,
      ...(providerOptions?.fal ?? {}),
    };

    if (hasImage) {
      input.image_url = await ensureUrl(image!, uploadToFal);
    } else {
      input.aspect_ratio = aspectRatio ?? "16:9";
    }

    console.log(`[fal] generating video with ${endpoint}...`);

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          const logs = update.logs?.map((l) => l.message).join(" ");
          if (logs) console.log(`[fal] ${logs}`);
        }
      },
    });

    const data = result.data as { video?: { url?: string }; duration?: number };
    const videoUrl = data?.video?.url;

    if (!videoUrl) {
      throw new Error("No video URL in fal response");
    }

    console.log(`[fal] video generated: ${videoUrl}`);

    return {
      video: new MediaResult(videoUrl, "video/mp4"),
      duration: data?.duration,
    };
  }

  private resolveEndpoint(hasImage: boolean): string {
    const baseId = this.modelId.replace("/i2v", "");

    // check if it's a friendly name
    const mapping = VIDEO_MODELS[baseId];
    if (mapping) {
      return hasImage ? mapping.i2v : mapping.t2v;
    }

    // raw model id - append endpoint suffix if needed
    if (this.modelId.startsWith("raw:")) {
      return this.modelId.slice(4);
    }

    // assume full fal model path
    return this.modelId;
  }
}

// ============================================================================
// Fal Image Model
// ============================================================================

class FalImageModel implements ImageModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "fal";
  readonly type = "image" as const;
  readonly modelId: string;

  private settings: ProviderSettings;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.schema = FAL_IMAGE_SCHEMAS[modelId];
  }

  async doGenerate(
    options: ImageGenerateOptions,
  ): Promise<ImageGenerateResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as ImageGenerateOptions;
    const { prompt, size, n, providerOptions } = validated;

    const endpoint = resolveModelId(this.modelId, IMAGE_MODELS);

    // handle text prompt vs edit prompt
    const input: Record<string, unknown> = {
      ...(providerOptions?.fal ?? {}),
    };

    if (typeof prompt === "string") {
      input.prompt = prompt;
    } else {
      input.prompt = prompt.text;
      if (prompt.images && prompt.images.length > 0) {
        input.image_urls = await Promise.all(
          prompt.images.map((img) => ensureUrl(img, uploadToFal)),
        );
      }
    }

    if (size) {
      input.image_size = size;
    }

    if (n && n > 1) {
      input.num_images = n;
    }

    console.log(`[fal] generating image with ${endpoint}...`);

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          const logs = update.logs?.map((l) => l.message).join(" ");
          if (logs) console.log(`[fal] ${logs}`);
        }
      },
    });

    const data = result.data as {
      images?: Array<{ url?: string; content_type?: string }>;
    };
    const images = data?.images;

    if (!images || images.length === 0) {
      throw new Error("No images in fal response");
    }

    console.log(`[fal] generated ${images.length} image(s)`);

    return {
      images: images.map(
        (img) => new MediaResult(img.url!, img.content_type ?? "image/png"),
      ),
    };
  }
}

// ============================================================================
// Fal Sync Model (Lipsync)
// ============================================================================

class FalSyncModel implements SyncModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "fal";
  readonly type = "sync" as const;
  readonly modelId: string;

  private settings: ProviderSettings;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.schema = FAL_SYNC_SCHEMAS[modelId];
  }

  async doSync(options: SyncOptions): Promise<SyncResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as SyncOptions;
    const { video, audio, providerOptions } = validated;

    const endpoint = resolveModelId(this.modelId, SYNC_MODELS);

    const [videoUrl, audioUrl] = await Promise.all([
      ensureUrl(video, uploadToFal),
      ensureUrl(audio, uploadToFal),
    ]);

    const input: Record<string, unknown> = {
      video_url: videoUrl,
      audio_url: audioUrl,
      ...(providerOptions?.fal ?? {}),
    };

    console.log(`[fal] syncing with ${endpoint}...`);

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          const logs = update.logs?.map((l) => l.message).join(" ");
          if (logs) console.log(`[fal] ${logs}`);
        }
      },
    });

    const data = result.data as { video?: { url?: string } };
    const resultUrl = data?.video?.url;

    if (!resultUrl) {
      throw new Error("No video URL in fal sync response");
    }

    console.log(`[fal] sync completed: ${resultUrl}`);

    return {
      video: new MediaResult(resultUrl, "video/mp4"),
    };
  }
}

// ============================================================================
// Fal Transcription Model
// ============================================================================

class FalTranscriptionModel implements TranscriptionModel {
  readonly specificationVersion = "v1" as const;
  readonly provider = "fal";
  readonly type = "transcription" as const;
  readonly modelId: string;

  private settings: ProviderSettings;
  private schema: ZodSchema | undefined;

  constructor(modelId: string, settings: ProviderSettings) {
    this.modelId = modelId;
    this.settings = settings;
    this.schema = FAL_TRANSCRIPTION_SCHEMAS[modelId];
  }

  async doTranscribe(options: TranscribeOptions): Promise<TranscribeResult> {
    const validated = (
      this.schema ? this.schema.parse(options) : options
    ) as TranscribeOptions;
    const { audio, language, prompt, providerOptions } = validated;

    const endpoint = resolveModelId(this.modelId, TRANSCRIPTION_MODELS);
    const audioUrl = await ensureUrl(audio, uploadToFal);

    const input: Record<string, unknown> = {
      audio_url: audioUrl,
      task: "transcribe",
      ...(providerOptions?.fal ?? {}),
    };

    if (language) input.language = language;
    if (prompt) input.prompt = prompt;

    console.log(`[fal] transcribing with ${endpoint}...`);

    const result = await fal.subscribe(endpoint, {
      input,
      logs: true,
    });

    const data = result.data as {
      text?: string;
      chunks?: Array<{ timestamp: [number, number]; text: string }>;
      language?: string;
    };

    console.log(`[fal] transcription completed`);

    return {
      text: data?.text ?? "",
      segments: (data?.chunks ?? []).map((chunk) => ({
        start: chunk.timestamp[0],
        end: chunk.timestamp[1],
        text: chunk.text,
      })),
      language: data?.language,
    };
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

export interface FalProvider {
  video(modelId: string): VideoModel;
  image(modelId: string): ImageModel;
  sync(modelId: string): SyncModel;
  transcription(modelId: string): TranscriptionModel;
}

export function createFal(settings: ProviderSettings = {}): FalProvider {
  // configure fal client if api key provided
  if (settings.apiKey) {
    fal.config({ credentials: settings.apiKey });
  }

  return {
    video(modelId: string) {
      return new FalVideoModel(modelId, settings);
    },
    image(modelId: string) {
      return new FalImageModel(modelId, settings);
    },
    sync(modelId: string) {
      return new FalSyncModel(modelId, settings);
    },
    transcription(modelId: string) {
      return new FalTranscriptionModel(modelId, settings);
    },
  };
}

// default instance
export const fal_provider = createFal();

// convenience export matching ai-sdk style
export { fal_provider as fal };
