import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type ImageModelV3CallOptions,
  type ImageModelV3File,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3ProviderOptions,
  type SharedV3Warning,
} from "@ai-sdk/provider";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";

export const ATLASCLOUD_BASE_URL = "https://api.atlascloud.ai/api/v1";

const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_DURATION_MS = 30 * 60 * 1_000;

export interface AtlasCloudProviderSettings {
  apiKey?: string;
  baseUrl?: string;
  pollIntervalMs?: number;
  maxPollDurationMs?: number;
}

export interface AtlasCloudProvider extends ProviderV3 {
  imageModel(modelId: string): ImageModelV3;
  videoModel(modelId: string): VideoModelV3;
}

interface AtlasCloudPrediction {
  id?: string;
  status?: string;
  outputs?: string[] | null;
  error?: unknown;
}

interface AtlasCloudResponse<T> {
  code?: number | string;
  data?: T;
  message?: string;
}

interface AtlasCloudConfig {
  apiKey?: string;
  baseUrl: string;
  pollIntervalMs: number;
  maxPollDurationMs: number;
}

/**
 * Error thrown for any failed Atlas Cloud exchange: a non-2xx response, a
 * non-200 code in the response envelope, an unparseable body, a prediction
 * that finished in a failure state, or a poll that exceeded its deadline.
 *
 * `statusCode` carries the HTTP status when the failure came from a response;
 * it is undefined for failures detected after a successful HTTP exchange.
 */
export class AtlasCloudAPIError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "AtlasCloudAPIError";
  }
}

function getProviderOptions(providerOptions: SharedV3ProviderOptions): {
  apiKey?: string;
  body: Record<string, unknown>;
} {
  const options = providerOptions?.atlascloud;
  if (
    options == null ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    return { body: {} };
  }

  const { apiKey, ...body } = options as Record<string, unknown>;
  return {
    apiKey: typeof apiKey === "string" ? apiKey : undefined,
    body,
  };
}

function resolveApiKey(perCall: string | undefined, configured?: string) {
  const apiKey = perCall || configured || process.env.ATLASCLOUD_API_KEY;
  if (!apiKey) {
    throw new AtlasCloudAPIError(
      "Atlas Cloud API key is required. Set ATLASCLOUD_API_KEY or pass apiKey to createAtlasCloud().",
    );
  }
  return apiKey.replace(/^Bearer\s+/i, "");
}

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error != null && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "unknown error";
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<T> {
  const response = await fetch(url, init);
  const raw = await response.text();
  if (!response.ok) {
    throw new AtlasCloudAPIError(
      `Atlas Cloud ${operation} failed (${response.status}): ${raw}`,
      response.status,
    );
  }

  let parsed: AtlasCloudResponse<T> | T;
  try {
    parsed = JSON.parse(raw) as AtlasCloudResponse<T> | T;
  } catch {
    throw new AtlasCloudAPIError(
      `Atlas Cloud ${operation} returned invalid JSON`,
      response.status,
    );
  }

  if (parsed != null && typeof parsed === "object" && "code" in parsed) {
    const wrapped = parsed as AtlasCloudResponse<T>;
    if (wrapped.code != null && String(wrapped.code) !== "200") {
      throw new AtlasCloudAPIError(
        `Atlas Cloud ${operation} failed: ${wrapped.message ?? `code ${wrapped.code}`}`,
        response.status,
      );
    }
    if (wrapped.data == null) {
      throw new AtlasCloudAPIError(
        `Atlas Cloud ${operation} returned no data`,
        response.status,
      );
    }
    return wrapped.data;
  }

  return parsed as T;
}

function statusOf(prediction: AtlasCloudPrediction) {
  return prediction.status?.toLowerCase() ?? "";
}

function completedOutputs(prediction: AtlasCloudPrediction): string[] | null {
  const status = statusOf(prediction);
  if (
    ["failed", "error", "cancelled", "canceled", "expired"].includes(status)
  ) {
    throw new AtlasCloudAPIError(
      `Atlas Cloud generation failed: ${errorMessage(prediction.error)}`,
    );
  }
  if (!["completed", "succeeded", "success", "done"].includes(status)) {
    return null;
  }
  if (!prediction.outputs?.length) {
    throw new AtlasCloudAPIError(
      "Atlas Cloud generation completed without output URLs",
    );
  }
  return prediction.outputs;
}

function requestHeaders(
  apiKey: string,
  additional?: Record<string, string | undefined>,
) {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(additional ?? {})) {
    if (value !== undefined) headers[key] = value;
  }
  headers.Authorization = `Bearer ${apiKey}`;
  headers.Accept = "application/json";
  headers["Content-Type"] = "application/json";
  return headers;
}

async function sleep(ms: number, signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("The operation was aborted", "AbortError");
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("The operation was aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function submitAndPoll(
  endpoint: "generateImage" | "generateVideo",
  body: Record<string, unknown>,
  apiKey: string,
  config: AtlasCloudConfig,
  abortSignal?: AbortSignal,
  additionalHeaders?: Record<string, string | undefined>,
) {
  const headers = requestHeaders(apiKey, additionalHeaders);
  let prediction = await requestJson<AtlasCloudPrediction>(
    `${config.baseUrl}/model/${endpoint}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    },
    "submission",
  );

  const immediate = completedOutputs(prediction);
  if (immediate != null) return immediate;
  if (!prediction.id) {
    throw new AtlasCloudAPIError(
      "Atlas Cloud submission returned neither outputs nor a prediction id",
    );
  }

  const predictionId = prediction.id;
  const startedAt = Date.now();
  while (Date.now() - startedAt <= config.maxPollDurationMs) {
    prediction = await requestJson<AtlasCloudPrediction>(
      `${config.baseUrl}/model/prediction/${encodeURIComponent(predictionId)}`,
      { headers, signal: abortSignal },
      "polling",
    );
    const outputs = completedOutputs(prediction);
    if (outputs != null) return outputs;
    await sleep(config.pollIntervalMs, abortSignal);
  }

  throw new AtlasCloudAPIError(
    `Atlas Cloud generation timed out after ${config.maxPollDurationMs}ms`,
  );
}

function fileToInput(file: ImageModelV3File) {
  if (file.type === "url") return file.url;
  if (typeof file.data === "string" && file.data.startsWith("data:")) {
    return file.data;
  }
  const base64 =
    typeof file.data === "string"
      ? file.data
      : Buffer.from(file.data).toString("base64");
  return `data:${file.mediaType};base64,${base64}`;
}

/**
 * Attach reference images to an Atlas Cloud request body.
 *
 * Sent as an array rather than a newline-joined string: the array form is
 * unambiguous for multi-image models such as `google/nano-banana/edit`, where
 * a joined string leaves it to the service to re-split the value. A caller can
 * still override the shape entirely via `providerOptions.atlascloud.images`.
 */
function addFiles(
  body: Record<string, unknown>,
  files: ImageModelV3File[] | undefined,
) {
  if (files?.length && body.images == null) {
    body.images = files.map(fileToInput);
  }
}

function setDefault(
  body: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value !== undefined && body[key] === undefined) body[key] = value;
}

async function downloadOutputs(urls: string[], abortSignal?: AbortSignal) {
  return Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { signal: abortSignal });
      if (!response.ok) {
        throw new AtlasCloudAPIError(
          `Atlas Cloud output download failed (${response.status}): ${url}`,
          response.status,
        );
      }
      return new Uint8Array(await response.arrayBuffer());
    }),
  );
}

class AtlasCloudImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "atlascloud";
  readonly maxImagesPerCall = 1;

  constructor(
    readonly modelId: string,
    private readonly config: AtlasCloudConfig,
  ) {}

  async doGenerate(options: ImageModelV3CallOptions) {
    const { apiKey: perCallKey, body } = getProviderOptions(
      options.providerOptions,
    );
    body.model = this.modelId;
    setDefault(body, "prompt", options.prompt);
    setDefault(body, "n", options.n);
    setDefault(body, "size", options.size?.replace("x", "*"));
    setDefault(body, "aspect_ratio", options.aspectRatio);
    setDefault(body, "seed", options.seed);
    addFiles(body, options.files);
    if (options.mask != null && body.mask == null) {
      body.mask = fileToInput(options.mask);
    }

    const outputUrls = await submitAndPoll(
      "generateImage",
      body,
      resolveApiKey(perCallKey, this.config.apiKey),
      this.config,
      options.abortSignal,
      options.headers,
    );

    return {
      images: await downloadOutputs(outputUrls, options.abortSignal),
      warnings: [] as SharedV3Warning[],
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

class AtlasCloudVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "atlascloud";
  readonly maxVideosPerCall = 1;

  constructor(
    readonly modelId: string,
    private readonly config: AtlasCloudConfig,
  ) {}

  async doGenerate(options: VideoModelV3CallOptions) {
    const { apiKey: perCallKey, body } = getProviderOptions(
      options.providerOptions,
    );
    body.model = this.modelId;
    setDefault(body, "prompt", options.prompt);
    setDefault(body, "size", options.resolution?.replace("x", "*"));
    setDefault(body, "aspect_ratio", options.aspectRatio);
    setDefault(body, "duration", options.duration);
    setDefault(body, "fps", options.fps);
    setDefault(body, "seed", options.seed);
    addFiles(body, options.files);

    const outputUrls = await submitAndPoll(
      "generateVideo",
      body,
      resolveApiKey(perCallKey, this.config.apiKey),
      this.config,
      options.abortSignal,
      options.headers,
    );

    return {
      videos: await downloadOutputs(outputUrls, options.abortSignal),
      warnings: [] as SharedV3Warning[],
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

/**
 * Create an Atlas Cloud provider for the AI SDK.
 *
 * Exposes image and video models only. Atlas Cloud's generation endpoints are
 * asynchronous, so each call submits once and then polls the returned
 * prediction id until it completes, fails, or passes `maxPollDurationMs`.
 * `languageModel` and `embeddingModel` throw `NoSuchModelError`.
 *
 * @param settings - API key, base URL, and polling bounds. The key falls back
 * to `ATLASCLOUD_API_KEY`; polling defaults are applied when unset.
 * @returns A provider whose `imageModel` / `videoModel` accept any model id
 * Atlas Cloud serves.
 */
export function createAtlasCloud(
  settings: AtlasCloudProviderSettings = {},
): AtlasCloudProvider {
  const config: AtlasCloudConfig = {
    apiKey: settings.apiKey,
    baseUrl: (settings.baseUrl ?? ATLASCLOUD_BASE_URL).replace(/\/+$/, ""),
    pollIntervalMs: settings.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    maxPollDurationMs:
      settings.maxPollDurationMs ?? DEFAULT_MAX_POLL_DURATION_MS,
  };

  return {
    specificationVersion: "v3",
    imageModel: (modelId) => new AtlasCloudImageModel(modelId, config),
    videoModel: (modelId) => new AtlasCloudVideoModel(modelId, config),
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
  };
}

let defaultProvider: AtlasCloudProvider | undefined;

export const atlascloud = new Proxy({} as AtlasCloudProvider, {
  get(_, property) {
    defaultProvider ??= createAtlasCloud();
    return defaultProvider[property as keyof AtlasCloudProvider];
  },
});
