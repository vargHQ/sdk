import type {
  ImageModelV3File,
  SharedV3ProviderOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { DataContent } from "ai";
import type { GenerationMetrics, UsageProvider } from "./usage/types";
import type { VideoModelV3, VideoModelV3Usage } from "./video-model";

export type GenerateVideoPrompt =
  | string
  | {
      text?: string;
      images?: Array<DataContent>;
      audio?: DataContent;
      video?: DataContent;
    };

export interface GenerateVideoOptions {
  model: VideoModelV3;
  prompt: GenerateVideoPrompt;
  n?: number;
  resolution?: `${number}x${number}`;
  aspectRatio?: `${number}:${number}`;
  duration?: number;
  fps?: number;
  seed?: number;
  providerOptions?: SharedV3ProviderOptions;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface GeneratedVideo {
  readonly base64: string;
  readonly uint8Array: Uint8Array;
  readonly mimeType: string;
}

export interface GenerateVideoResult {
  readonly video: GeneratedVideo;
  readonly videos: GeneratedVideo[];
  readonly warnings: SharedV3Warning[];
  /** Usage metrics from the generation (if provided by the model) */
  readonly usage?: GenerationMetrics;
}

class DefaultGeneratedVideo implements GeneratedVideo {
  private _data: Uint8Array;
  readonly mimeType = "video/mp4";

  constructor(data: Uint8Array | string) {
    if (typeof data === "string") {
      this._data = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    } else {
      this._data = data;
    }
  }

  get uint8Array(): Uint8Array {
    return this._data;
  }

  get base64(): string {
    let binary = "";
    for (const byte of this._data) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}

function toUint8Array(data: DataContent): Uint8Array {
  if (typeof data === "string") {
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return data;
}

function normalizePrompt(prompt: GenerateVideoPrompt): {
  prompt: string | undefined;
  files: ImageModelV3File[] | undefined;
} {
  if (typeof prompt === "string") {
    return { prompt, files: undefined };
  }

  const files: ImageModelV3File[] = [];

  for (const img of prompt.images ?? []) {
    files.push({
      type: "file",
      mediaType: "image/png",
      data: toUint8Array(img),
    });
  }

  if (prompt.audio) {
    files.push({
      type: "file",
      mediaType: "audio/mpeg",
      data: toUint8Array(prompt.audio),
    });
  }

  if (prompt.video) {
    files.push({
      type: "file",
      mediaType: "video/mp4",
      data: toUint8Array(prompt.video),
    });
  }

  return {
    prompt: prompt.text,
    files: files.length > 0 ? files : undefined,
  };
}

export async function generateVideo(
  options: GenerateVideoOptions,
): Promise<GenerateVideoResult> {
  const {
    model,
    prompt: promptArg,
    n = 1,
    resolution,
    aspectRatio,
    duration,
    fps,
    seed,
    providerOptions = {},
    abortSignal,
    headers,
  } = options;

  const { prompt, files } = normalizePrompt(promptArg);

  const result = await model.doGenerate({
    prompt: prompt ?? "",
    n,
    resolution,
    aspectRatio,
    duration,
    fps,
    seed,
    files,
    providerOptions,
    abortSignal,
    headers,
  });

  const videos = result.videos.map((v) => new DefaultGeneratedVideo(v));
  const warnings = result.warnings;

  if (videos.length === 0) {
    throw new Error("No videos generated");
  }

  // Extract usage metrics if provided by the model
  const usage = normalizeUsage(result.usage, model);

  return {
    video: videos[0] as GeneratedVideo,
    videos,
    warnings,
    usage,
  };
}

function isGenerationMetrics(
  usage: VideoModelV3Usage | GenerationMetrics | undefined,
): usage is GenerationMetrics {
  return Boolean(
    usage &&
      typeof usage === "object" &&
      "provider" in usage &&
      "modelId" in usage &&
      "resourceType" in usage,
  );
}

function coerceProvider(provider: string): UsageProvider {
  switch (provider) {
    case "fal":
    case "elevenlabs":
    case "openai":
    case "replicate":
    case "google":
      return provider;
    default:
      return "unknown";
  }
}

function normalizeUsage(
  usage: VideoModelV3Usage | GenerationMetrics | undefined,
  model: GenerateVideoOptions["model"],
): GenerationMetrics | undefined {
  if (!usage) return undefined;
  if (isGenerationMetrics(usage)) return usage;

  const totalTokens =
    usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

  return {
    provider: coerceProvider(model.provider),
    modelId: model.modelId,
    resourceType: "video",
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens,
  };
}
