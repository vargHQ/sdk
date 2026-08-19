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
      images?: DataContent | Array<DataContent>;
      audio?: DataContent | Array<DataContent>;
      video?: DataContent | Array<DataContent>;
    };

/**
 * A video model can be passed as a string ID (resolved via the default
 * provider set on `globalThis.AI_SDK_DEFAULT_PROVIDER`) or as a full
 * `VideoModelV3` object. This mirrors how the Vercel AI SDK's
 * `generateImage` accepts string model IDs.
 */
export type VideoModel = VideoModelV3 | string;

export interface GenerateVideoOptions {
  model: VideoModel;
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

/** Normalize singular or array to array */
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePrompt(prompt: GenerateVideoPrompt): {
  prompt: string | undefined;
  files: ImageModelV3File[] | undefined;
} {
  if (typeof prompt === "string") {
    return { prompt, files: undefined };
  }

  const files: ImageModelV3File[] = [];

  for (const img of toArray(prompt.images)) {
    files.push({
      type: "file",
      mediaType: "image/png",
      data: toUint8Array(img),
    });
  }

  for (const aud of toArray(prompt.audio)) {
    files.push({
      type: "file",
      mediaType: "audio/mpeg",
      data: toUint8Array(aud),
    });
  }

  for (const vid of toArray(prompt.video)) {
    files.push({
      type: "file",
      mediaType: "video/mp4",
      data: toUint8Array(vid),
    });
  }

  return {
    prompt: prompt.text,
    files: files.length > 0 ? files : undefined,
  };
}

/**
 * Resolve a `VideoModel` (which may be a string ID) into a `VideoModelV3`
 * object. String IDs are resolved through `globalThis.AI_SDK_DEFAULT_PROVIDER`
 * (set by the render service before calling `render()`), mirroring how the
 * Vercel AI SDK's `generateImage` resolves string image model IDs.
 */
function resolveVideoModel(model: VideoModel): VideoModelV3 {
  if (typeof model !== "string") {
    return model;
  }

  const provider = globalThis.AI_SDK_DEFAULT_PROVIDER as
    | { videoModel?: (id: string) => VideoModelV3 }
    | undefined;

  if (!provider?.videoModel) {
    throw new Error(
      `Cannot resolve video model "${model}" — no default provider with videoModel() is set. ` +
        'Either pass a VideoModelV3 object (e.g. varg.videoModel("seedance_2_5")) ' +
        "or ensure globalThis.AI_SDK_DEFAULT_PROVIDER is configured.",
    );
  }

  return provider.videoModel(model);
}

export async function generateVideo(
  options: GenerateVideoOptions,
): Promise<GenerateVideoResult> {
  const {
    model: modelArg,
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

  const model = resolveVideoModel(modelArg);

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
    ...(abortSignal != null && { abortSignal }),
    ...(headers != null && { headers }),
  });

  const videos = result.videos.map((v) => new DefaultGeneratedVideo(v));
  const warnings = result.warnings;

  if (videos.length === 0) {
    throw new Error("No videos generated");
  }

  return {
    video: videos[0] as GeneratedVideo,
    videos,
    warnings,
  };
}
