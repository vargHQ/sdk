import type {
  SharedV3ProviderOptions,
  SharedV3Warning,
} from "@ai-sdk/provider";
import type { VideoModelV3, VideoModelV3File } from "./video-model";

export interface GenerateVideoOptions {
  model: VideoModelV3;
  prompt: string;
  n?: number;
  resolution?: `${number}x${number}`;
  aspectRatio?: `${number}:${number}`;
  duration?: number;
  fps?: number;
  seed?: number;
  files?: VideoModelV3File[];
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
    const bytes = this._data;
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }
}

export async function generateVideo(
  options: GenerateVideoOptions,
): Promise<GenerateVideoResult> {
  const {
    model,
    prompt,
    n = 1,
    resolution,
    aspectRatio,
    duration,
    fps,
    seed,
    files,
    providerOptions = {},
    abortSignal,
    headers,
  } = options;

  const result = await model.doGenerate({
    prompt,
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

  return {
    video: videos[0]!,
    videos,
    warnings,
  };
}
