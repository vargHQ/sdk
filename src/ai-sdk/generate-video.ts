import type {
  ImageModelV3File,
  SharedV3ProviderOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { DataContent } from "ai";
import type { VideoModelV3 } from "./video-model";

export type GenerateVideoPrompt =
  | string
  | {
      text?: string;
      images?: Array<DataContent>;
      audio?: DataContent;
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
}

function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.byteLength; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary);
}

function createGeneratedVideo(data: Uint8Array | string): GeneratedVideo {
  const uint8Array =
    typeof data === "string"
      ? Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
      : data;

  return {
    uint8Array,
    base64: toBase64(uint8Array),
    mimeType: "video/mp4",
  };
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

  const videos = result.videos.map((v) => createGeneratedVideo(v));
  const warnings = result.warnings;

  if (videos.length === 0) {
    throw new Error("No videos generated");
  }

  return {
    video: videos[0]!,
    videos,
    warnings,
  };
}
