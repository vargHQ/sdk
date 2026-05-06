import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type ImageModelV3CallOptions,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
  type SpeechModelV3,
  type SpeechModelV3CallOptions,
} from "@ai-sdk/provider";
import type { MusicModelV3, MusicModelV3CallOptions } from "../music-model";
import type { VideoModelV3, VideoModelV3CallOptions } from "../video-model";
import {
  magnificDirectImage,
  magnificDirectMusic,
  magnificDirectSpeech,
  magnificDirectVideo,
  parseMagnificModelId,
  resolveMagnificKey,
} from "./magnific";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface VargProviderSettings {
  apiKey?: string;
  baseUrl?: string;
  /**
   * BYOK Magnific API key. When set, calls to `varg.imageModel("magnific/...")`,
   * `videoModel`, `musicModel`, and `speechModel` go directly to api.magnific.com
   * with this key instead of being forwarded to the Varg gateway.
   *
   * Precedence (highest first):
   *   1. `options.providerOptions.magnific.apiKey` on the call
   *   2. this `magnificApiKey`
   *   3. `process.env.MAGNIFIC_API_KEY`
   *   4. (none) → call goes to Varg gateway
   */
  magnificApiKey?: string;
  /** Optional override for the Magnific API base URL (testing). */
  magnificBaseUrl?: string;
}

export interface VargProvider extends ProviderV3 {
  videoModel(modelId: string): VideoModelV3;
  imageModel(modelId: string): ImageModelV3;
  speechModel(modelId: string): SpeechModelV3;
  musicModel(modelId: string): MusicModelV3;
}

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

class VargAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = "VargAPIError";
  }
}

function resolveConfig(settings: VargProviderSettings = {}) {
  let apiKey = settings.apiKey ?? process.env.VARG_API_KEY ?? "";

  // Fallback to global credentials (~/.varg/credentials) if no key from settings or env
  if (!apiKey) {
    try {
      const { getGlobalApiKey } = require("../../cli/credentials") as {
        getGlobalApiKey: () => string | null;
      };
      apiKey = getGlobalApiKey() ?? "";
    } catch {
      // credentials module may not be available in all contexts (e.g., browser)
    }
  }

  const baseUrl = settings.baseUrl ?? "https://api.varg.ai/v1";
  return { apiKey, baseUrl };
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function submitJob(
  baseUrl: string,
  apiKey: string,
  capability: "video" | "image" | "speech" | "music",
  params: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/${capability}`, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const raw = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const errorData = ((raw?.error ?? raw) || {}) as { message?: string };
    const msg = errorData?.message ?? `gateway returned ${response.status}`;
    throw new VargAPIError(msg, response.status);
  }

  return (await response.json()) as {
    job_id: string;
    status: string;
    output?: { url: string; media_type: string };
  };
}

async function pollJob(
  baseUrl: string,
  apiKey: string,
  jobId: string,
  maxAttempts = 900,
  intervalMs = 2000,
) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${baseUrl}/jobs/${jobId}`, {
      headers: getHeaders(apiKey),
    });
    if (!res.ok) {
      throw new VargAPIError(
        `failed to poll job ${jobId}: ${res.status}`,
        res.status,
      );
    }
    const job = (await res.json()) as {
      job_id: string;
      status: string;
      output?: { url: string; media_type: string };
      error?: string;
    };
    if (
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    ) {
      return job;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new VargAPIError(`job ${jobId} did not complete within timeout`);
}

async function executeJob(
  baseUrl: string,
  apiKey: string,
  capability: "video" | "image" | "speech" | "music",
  params: Record<string, unknown>,
): Promise<{ data: Uint8Array; mediaType: string; jobId: string }> {
  const job = await submitJob(baseUrl, apiKey, capability, params);

  // Completed synchronously (cache hit)
  if (job.status === "completed" && job.output?.url) {
    const res = await fetch(job.output.url);
    if (!res.ok)
      throw new VargAPIError(
        `failed to download from ${job.output.url}: ${res.status}`,
      );
    return {
      data: new Uint8Array(await res.arrayBuffer()),
      mediaType: job.output.media_type,
      jobId: job.job_id,
    };
  }

  // Poll until done
  const completed = await pollJob(baseUrl, apiKey, job.job_id);
  if (completed.status === "failed") {
    throw new VargAPIError(
      `job ${completed.job_id} failed: ${completed.error || "unknown"}`,
    );
  }
  if (!completed.output) {
    throw new VargAPIError(`${capability} completed but no output`);
  }

  const res = await fetch(completed.output.url);
  if (!res.ok) {
    throw new VargAPIError(
      `failed to download from ${completed.output.url}: ${res.status}`,
    );
  }
  return {
    data: new Uint8Array(await res.arrayBuffer()),
    mediaType: completed.output.media_type,
    jobId: job.job_id,
  };
}

async function uploadFile(
  baseUrl: string,
  apiKey: string,
  blob: Blob,
  mediaType: string,
): Promise<{ url: string; media_type?: string }> {
  const res = await fetch(`${baseUrl}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": mediaType,
    },
    body: blob,
  });
  if (!res.ok) {
    throw new VargAPIError(`file upload failed: ${res.status}`, res.status);
  }
  return (await res.json()) as { url: string; media_type?: string };
}

// ---------------------------------------------------------------------------
// Model implementations
// ---------------------------------------------------------------------------

class VargVideoModel implements VideoModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "varg";
  readonly modelId: string;
  readonly maxVideosPerCall = 1;
  private baseUrl: string;
  private apiKey: string;
  private settings: VargProviderSettings;

  constructor(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    settings: VargProviderSettings,
  ) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.settings = settings;
  }

  async doGenerate(options: VideoModelV3CallOptions) {
    // Magnific BYOK fast path — bypass the Varg gateway when a Magnific key is
    // resolvable. When no key is available, fall through to the gateway and let
    // it forward "magnific/<leaf>" upstream.
    const magnificLeaf = parseMagnificModelId(this.modelId);
    if (magnificLeaf !== null) {
      const byok = resolveMagnificKey({
        settings: this.settings,
        perCall: options.providerOptions?.magnific as
          | Record<string, unknown>
          | undefined,
      });
      if (byok) {
        const result = await magnificDirectVideo(magnificLeaf, byok, options, {
          baseUrl: this.settings.magnificBaseUrl,
          signal: options.abortSignal,
        });
        return {
          videos: [result.data],
          warnings: [] as SharedV3Warning[],
          response: {
            timestamp: new Date(),
            modelId: this.modelId,
            headers: undefined,
          },
        };
      }
    }

    const warnings: SharedV3Warning[] = [];
    const params: Record<string, unknown> = {
      model: this.modelId,
      prompt: options.prompt,
    };
    if (options.duration) params.duration = options.duration;
    if (options.aspectRatio) params.aspect_ratio = options.aspectRatio;

    if (options.files?.length) {
      const fileUrls: { url: string; media_type?: string }[] = [];
      for (const f of options.files) {
        if (f.type === "url") {
          fileUrls.push({ url: (f as { type: "url"; url: string }).url });
        } else if (f.type === "file") {
          const fd = f as { type: "file"; data: Uint8Array; mediaType: string };
          const uploaded = await uploadFile(
            this.baseUrl,
            this.apiKey,
            new Blob([fd.data], { type: fd.mediaType }),
            fd.mediaType,
          );
          fileUrls.push({
            url: uploaded.url,
            media_type: uploaded.media_type ?? fd.mediaType,
          });
        }
      }
      if (fileUrls.length) params.files = fileUrls;
    }

    if (options.providerOptions?.varg) {
      params.provider_options = options.providerOptions.varg;
    }

    const result = await executeJob(this.baseUrl, this.apiKey, "video", params);
    return {
      videos: [result.data],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

class VargImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "varg";
  readonly modelId: string;
  readonly maxImagesPerCall = 1;
  private baseUrl: string;
  private apiKey: string;
  private settings: VargProviderSettings;

  constructor(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    settings: VargProviderSettings,
  ) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.settings = settings;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    // Magnific BYOK fast path — see VargVideoModel for the contract.
    const magnificLeaf = parseMagnificModelId(this.modelId);
    if (magnificLeaf !== null) {
      const byok = resolveMagnificKey({
        settings: this.settings,
        perCall: options.providerOptions?.magnific as
          | Record<string, unknown>
          | undefined,
      });
      if (byok) {
        const result = await magnificDirectImage(magnificLeaf, byok, options, {
          baseUrl: this.settings.magnificBaseUrl,
          signal: options.abortSignal,
        });
        return {
          images: [result.data],
          warnings: [] as SharedV3Warning[],
          response: {
            timestamp: new Date(),
            modelId: this.modelId,
            headers: undefined,
          },
        };
      }
    }

    const warnings: SharedV3Warning[] = [];
    const params: Record<string, unknown> = {
      model: this.modelId,
      prompt: options.prompt,
    };
    if (options.aspectRatio) params.aspect_ratio = options.aspectRatio;

    if (options.files?.length) {
      const fileUrls: { url: string }[] = [];
      for (const f of options.files) {
        if (f.type === "url") {
          fileUrls.push({ url: (f as { type: "url"; url: string }).url });
        } else if (f.type === "file") {
          const fd = f as { type: "file"; data: Uint8Array; mediaType: string };
          const uploaded = await uploadFile(
            this.baseUrl,
            this.apiKey,
            new Blob([fd.data], { type: fd.mediaType }),
            fd.mediaType,
          );
          fileUrls.push({ url: uploaded.url });
        }
      }
      if (fileUrls.length) params.files = fileUrls;
    }

    if (options.providerOptions?.varg) {
      params.provider_options = options.providerOptions.varg;
    }

    const result = await executeJob(this.baseUrl, this.apiKey, "image", params);
    return {
      images: [result.data],
      warnings,
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

class VargSpeechModel implements SpeechModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "varg";
  readonly modelId: string;
  private baseUrl: string;
  private apiKey: string;
  private settings: VargProviderSettings;

  constructor(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    settings: VargProviderSettings,
  ) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.settings = settings;
  }

  async doGenerate(options: SpeechModelV3CallOptions) {
    // Magnific BYOK fast path
    const magnificLeaf = parseMagnificModelId(this.modelId);
    if (magnificLeaf !== null) {
      const byok = resolveMagnificKey({
        settings: this.settings,
        perCall: options.providerOptions?.magnific as
          | Record<string, unknown>
          | undefined,
      });
      if (byok) {
        const result = await magnificDirectSpeech(magnificLeaf, byok, options, {
          baseUrl: this.settings.magnificBaseUrl,
          signal: options.abortSignal,
        });
        return {
          audio: result.data,
          warnings: [] as SharedV3Warning[],
          response: { timestamp: new Date(), modelId: this.modelId },
        };
      }
    }

    const warnings: SharedV3Warning[] = [];
    const params: Record<string, unknown> = {
      model: this.modelId,
      text: options.text,
    };
    if (options.voice) params.voice = options.voice;

    const result = await executeJob(
      this.baseUrl,
      this.apiKey,
      "speech",
      params,
    );
    return {
      audio: result.data,
      warnings,
      response: { timestamp: new Date(), modelId: this.modelId },
    };
  }
}

class VargMusicModel implements MusicModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "varg";
  readonly modelId: string;
  private baseUrl: string;
  private apiKey: string;
  private settings: VargProviderSettings;

  constructor(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    settings: VargProviderSettings,
  ) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.settings = settings;
  }

  async doGenerate(options: MusicModelV3CallOptions) {
    // Magnific BYOK fast path
    const magnificLeaf = parseMagnificModelId(this.modelId);
    if (magnificLeaf !== null) {
      const byok = resolveMagnificKey({
        settings: this.settings,
        perCall: options.providerOptions?.magnific as
          | Record<string, unknown>
          | undefined,
      });
      if (byok) {
        const result = await magnificDirectMusic(magnificLeaf, byok, options, {
          baseUrl: this.settings.magnificBaseUrl,
          signal: options.abortSignal,
        });
        return {
          audio: result.data,
          warnings: [] as SharedV3Warning[],
          response: {
            timestamp: new Date(),
            modelId: this.modelId,
            headers: undefined,
          },
        };
      }
    }

    const warnings: SharedV3Warning[] = [];
    const params: Record<string, unknown> = {
      model: this.modelId,
      prompt: options.prompt,
    };
    if (options.duration) params.duration = options.duration;
    if (options.providerOptions?.varg) {
      params.provider_options = options.providerOptions.varg;
    }

    const result = await executeJob(this.baseUrl, this.apiKey, "music", params);
    return {
      audio: result.data,
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

export function createVarg(settings: VargProviderSettings = {}): VargProvider {
  const { apiKey, baseUrl } = resolveConfig(settings);

  return {
    specificationVersion: "v3",
    videoModel: (modelId) =>
      new VargVideoModel(modelId, baseUrl, apiKey, settings),
    imageModel: (modelId) =>
      new VargImageModel(modelId, baseUrl, apiKey, settings),
    speechModel: (modelId) =>
      new VargSpeechModel(modelId, baseUrl, apiKey, settings),
    musicModel: (modelId) =>
      new VargMusicModel(modelId, baseUrl, apiKey, settings),
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
  };
}

const varg_provider = createVarg();
export { varg_provider as varg };
