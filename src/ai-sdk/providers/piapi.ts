/**
 * PiAPI AI SDK Provider (Vercel AI SDK v3 compatible)
 *
 * Provides Seedance 2 video generation via PiAPI's async task API.
 * Supports text-to-video, image-to-video, and video editing.
 *
 * Models:
 * - seedance-2-preview: High quality, $0.25/s, auto watermark removal
 * - seedance-2-fast-preview: Fast, $0.15/s, no watermark removal
 */

import type {
  EmbeddingModelV3,
  ImageModelV3,
  ImageModelV3File,
  LanguageModelV3,
  NoSuchModelError as NoSuchModelErrorType,
  ProviderV3,
  SharedV3Warning,
} from "@ai-sdk/provider";
import { NoSuchModelError } from "@ai-sdk/provider";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PIAPI_BASE_URL = "https://api.piapi.ai";
const POLL_INTERVAL_MS = 10_000; // 10s between polls
const POLL_MAX_ATTEMPTS = 360; // 1 hour max

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PiAPIProviderSettings {
  apiKey?: string;
  baseUrl?: string;
}

export interface PiAPIProvider extends ProviderV3 {
  videoModel(modelId: string): VideoModelV3;
}

/** PiAPI task response shape. */
interface PiAPITaskData {
  task_id: string;
  model: string;
  task_type: string;
  status: string;
  input: Record<string, unknown>;
  output: { video?: string } | null;
  error: { code: number; message: string; raw_message?: string };
}

interface PiAPIResponse {
  code: number;
  data: PiAPITaskData;
  message: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class PiAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "PiAPIError";
  }
}

function resolveConfig(settings: PiAPIProviderSettings = {}) {
  const apiKey = settings.apiKey ?? process.env.PIAPI_API_KEY ?? "";
  const baseUrl = settings.baseUrl ?? PIAPI_BASE_URL;
  return { apiKey, baseUrl };
}

async function submitTask(
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await fetch(`${baseUrl}/api/v1/task`, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new PiAPIError(
      `piapi submit failed (${response.status}): ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as PiAPIResponse;
  const taskId = data.data?.task_id;
  if (!taskId) {
    throw new PiAPIError("no task_id in piapi response");
  }
  return taskId;
}

async function pollTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  maxAttempts = POLL_MAX_ATTEMPTS,
  intervalMs = POLL_INTERVAL_MS,
  abortSignal?: AbortSignal,
): Promise<{ url: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    if (abortSignal?.aborted) {
      throw new PiAPIError("request aborted");
    }

    const res = await fetch(`${baseUrl}/api/v1/task/${taskId}`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
      signal: abortSignal,
    });

    if (!res.ok) {
      throw new PiAPIError(
        `piapi status check failed (${res.status})`,
        res.status,
      );
    }

    const body = (await res.json()) as PiAPIResponse;
    const status = body.data?.status?.toLowerCase();

    if (status === "completed") {
      const videoUrl = body.data?.output?.video;
      if (!videoUrl) {
        throw new PiAPIError("piapi task completed but no video URL");
      }
      return { url: videoUrl };
    }

    if (status === "failed") {
      const errMsg =
        body.data?.error?.message ||
        body.data?.error?.raw_message ||
        "piapi task failed";
      throw new PiAPIError(errMsg);
    }

    // Still in progress — wait
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new PiAPIError(
    `piapi polling timed out after ${(maxAttempts * intervalMs) / 1000}s`,
  );
}

async function removeWatermark(
  baseUrl: string,
  apiKey: string,
  videoUrl: string,
  abortSignal?: AbortSignal,
): Promise<{ url: string }> {
  const taskId = await submitTask(baseUrl, apiKey, {
    model: "seedance",
    task_type: "remove-watermark",
    input: { video_url: videoUrl },
  });

  // Watermark removal is faster — 5s interval, 10 min max
  return pollTask(baseUrl, apiKey, taskId, 120, 5_000, abortSignal);
}

// ---------------------------------------------------------------------------
// Video Model
// ---------------------------------------------------------------------------

class PiAPIVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "piapi";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;
  private baseUrl: string;
  private apiKey: string;

  constructor(modelId: string, baseUrl: string, apiKey: string) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];

    // Map files to image_urls / video_urls
    const imageUrls: string[] = [];
    const videoUrls: string[] = [];

    if (options.files?.length) {
      for (const f of options.files) {
        if (f.type === "url") {
          const url = (f as { type: "url"; url: string }).url;
          // Detect video files by extension
          const ext = url.split(".").pop()?.toLowerCase();
          if (ext && ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) {
            videoUrls.push(url);
          } else {
            imageUrls.push(url);
          }
        } else if (f.type === "file") {
          warnings.push({
            type: "other" as const,
            message:
              "PiAPI requires URLs for input files. Inline file data is not supported — upload to a CDN first.",
          });
        }
      }
    }

    const input: Record<string, unknown> = {
      prompt: options.prompt,
    };
    if (options.duration != null) input.duration = options.duration;
    if (options.aspectRatio) input.aspect_ratio = options.aspectRatio;
    if (imageUrls.length) input.image_urls = imageUrls;
    if (videoUrls.length) input.video_urls = videoUrls;

    // Provider-specific options
    const providerOpts = options.providerOptions?.piapi as
      | Record<string, unknown>
      | undefined;
    if (providerOpts?.parent_task_id) {
      input.parent_task_id = providerOpts.parent_task_id;
    }

    // Submit the generation task
    const taskId = await submitTask(this.baseUrl, this.apiKey, {
      model: "seedance",
      task_type: this.modelId,
      input,
    });

    // Poll for completion
    let result = await pollTask(
      this.baseUrl,
      this.apiKey,
      taskId,
      POLL_MAX_ATTEMPTS,
      POLL_INTERVAL_MS,
      options.abortSignal,
    );

    // Auto watermark removal for seedance-2-preview
    if (this.modelId === "seedance-2-preview") {
      result = await removeWatermark(
        this.baseUrl,
        this.apiKey,
        result.url,
        options.abortSignal,
      );
    }

    // Download the video
    const videoRes = await fetch(result.url, {
      signal: options.abortSignal,
    });
    if (!videoRes.ok) {
      throw new PiAPIError(
        `failed to download video from ${result.url}: ${videoRes.status}`,
      );
    }

    const videoData = new Uint8Array(await videoRes.arrayBuffer());

    return {
      videos: [videoData],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Factory + singleton
// ---------------------------------------------------------------------------

export function createPiAPI(
  settings: PiAPIProviderSettings = {},
): PiAPIProvider {
  const { apiKey, baseUrl } = resolveConfig(settings);

  return {
    specificationVersion: "v3",
    videoModel: (modelId) => new PiAPIVideoModel(modelId, baseUrl, apiKey),
    imageModel(modelId: string): ImageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "imageModel" });
    },
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
  };
}

const piapi_provider = createPiAPI();
export { piapi_provider as piapi };
