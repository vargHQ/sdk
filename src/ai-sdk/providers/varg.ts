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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface VargProviderSettings {
  apiKey?: string;
  baseUrl?: string;
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

  const baseUrl = settings.baseUrl ?? "https://api.varg.ai/v2";
  return { apiKey, baseUrl };
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * The varg API expects `provider_options` to be namespaced by the underlying
 * provider: `{ fal: { generate_audio: true } }`. The API deep-merges only
 * `provider_options.<provider_options_key>` into the provider payload —
 * a flat bag like `{ generate_audio: true }` is silently dropped server-side.
 *
 * This validates the shape and warns once per process when a flat bag is
 * detected, so callers learn their options are a no-op instead of silently
 * getting default behavior.
 */
const KNOWN_UNDERLYING_PROVIDERS = new Set([
  "fal",
  "together",
  "rendi",
  "groq",
  "elevenlabs",
  "higgsfield",
  "piapi",
  "heygen",
  "replicate",
]);

let warnedFlatProviderOptions = false;

function checkVargProviderOptions(
  opts: Record<string, unknown>,
): Record<string, unknown> {
  const keys = Object.keys(opts);
  const hasProviderKey = keys.some(
    (k) =>
      KNOWN_UNDERLYING_PROVIDERS.has(k) &&
      typeof opts[k] === "object" &&
      opts[k] !== null,
  );
  if (keys.length > 0 && !hasProviderKey && !warnedFlatProviderOptions) {
    warnedFlatProviderOptions = true;
    console.warn(
      `[varg] providerOptions.varg contains no provider namespace (keys: ${keys.join(", ")}). ` +
        `The varg API only forwards options nested under a provider key, e.g. ` +
        `providerOptions: { varg: { fal: { generate_audio: true } } }. ` +
        `Flat options are dropped by the API.`,
    );
  }
  return opts;
}

// /v2 job shape (routes/varg_jobs/common.ts serializeVargJob). The create
// response wraps this with `urls: { self, refresh, status, cancel, retry }`.
// The poll response (GET /v2/jobs/:id) is the same shape, possibly with
// `output: { version: "v1", outputs: [{url, media_type, size_bytes, ...}] }`
// once terminal. `id` is the varg job id ("job_…"); the legacy /v1 gateway
// used `job_id` — this is the main breaking shape change.
interface VargJobResponse {
  id: string;
  status: string;
  output?: {
    version: "v1";
    outputs: Array<{
      url?: string;
      media_type?: string;
      size_bytes?: number;
      data?: unknown;
    }>;
  };
  error?: string | null;
  progress_message?: string | null;
  progress?: number | null;
}

async function submitJob(
  baseUrl: string,
  apiKey: string,
  capability: "video" | "image" | "speech" | "music",
  params: Record<string, unknown>,
): Promise<VargJobResponse> {
  console.info(`[GATEWAY] POST /v2/${capability} — submitting job`);
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
    const msg = errorData?.message ?? `varg api returned ${response.status}`;
    throw new VargAPIError(msg, response.status);
  }

  return (await response.json()) as VargJobResponse;
}

async function pollJob(
  baseUrl: string,
  apiKey: string,
  jobId: string,
  maxAttempts = 900,
  intervalMs = 2000,
): Promise<VargJobResponse> {
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
    const job = (await res.json()) as VargJobResponse;
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

/**
 * Submit + poll a /v2 job and download the first output artifact as bytes.
 * For multi-output jobs the caller gets outputs[0]; for inline-data outputs
 * (e.g. transcription JSON) the data is returned as a UTF-8 JSON byte payload.
 */
async function executeJob(
  baseUrl: string,
  apiKey: string,
  capability: "video" | "image" | "speech" | "music",
  params: Record<string, unknown>,
): Promise<{ data: Uint8Array; mediaType: string; jobId: string }> {
  const job = await submitJob(baseUrl, apiKey, capability, params);

  // Completed synchronously (cache hit) — /v2 returns the full output shape
  // on the create response when the job is already terminal.
  if (job.status === "completed" && job.output?.outputs?.length) {
    return downloadOutput(job);
  }

  // Poll until done
  const completed = await pollJob(baseUrl, apiKey, job.id);
  if (completed.status === "failed") {
    throw new VargAPIError(
      `job ${completed.id} failed: ${completed.error || "unknown"}`,
    );
  }
  if (completed.status === "cancelled") {
    throw new VargAPIError(`job ${completed.id} was cancelled`);
  }
  if (!completed.output?.outputs?.length) {
    throw new VargAPIError(`${capability} completed but no output`);
  }
  return downloadOutput(completed);
}

/** Download the first output artifact of a terminal /v2 job. Handles both
 *  URL-bearing outputs (download via fetch) and inline `data` outputs
 *  (serialize to JSON bytes). */
async function downloadOutput(
  job: VargJobResponse,
): Promise<{ data: Uint8Array; mediaType: string; jobId: string }> {
  const out = job.output!.outputs[0]!;
  if (out.url) {
    const res = await fetch(out.url);
    if (!res.ok) {
      throw new VargAPIError(
        `failed to download from ${out.url}: ${res.status}`,
        res.status,
      );
    }
    return {
      data: new Uint8Array(await res.arrayBuffer()),
      mediaType: out.media_type ?? "application/octet-stream",
      jobId: job.id,
    };
  }
  // Inline structured result (no file) — serialize to JSON bytes so the
  // caller's Uint8Array contract still holds.
  const json = new TextEncoder().encode(JSON.stringify(out.data ?? null));
  return {
    data: json,
    mediaType: out.media_type ?? "application/json",
    jobId: job.id,
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

  constructor(modelId: string, baseUrl: string, apiKey: string) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async doGenerate(options: VideoModelV3CallOptions) {
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
            new Blob([fd.data as BlobPart], { type: fd.mediaType }),
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
      params.provider_options = checkVargProviderOptions(
        options.providerOptions.varg as Record<string, unknown>,
      );
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

  constructor(modelId: string, baseUrl: string, apiKey: string) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
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
            new Blob([fd.data as BlobPart], { type: fd.mediaType }),
            fd.mediaType,
          );
          fileUrls.push({ url: uploaded.url });
        }
      }
      if (fileUrls.length) params.files = fileUrls;
    }

    if (options.providerOptions?.varg) {
      params.provider_options = checkVargProviderOptions(
        options.providerOptions.varg as Record<string, unknown>,
      );
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

  constructor(modelId: string, baseUrl: string, apiKey: string) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async doGenerate(options: SpeechModelV3CallOptions) {
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

  constructor(modelId: string, baseUrl: string, apiKey: string) {
    this.modelId = modelId;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async doGenerate(options: MusicModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];
    const params: Record<string, unknown> = {
      model: this.modelId,
      prompt: options.prompt,
    };
    if (options.duration) params.duration = options.duration;
    if (options.providerOptions?.varg) {
      params.provider_options = checkVargProviderOptions(
        options.providerOptions.varg as Record<string, unknown>,
      );
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
    videoModel: (modelId) => new VargVideoModel(modelId, baseUrl, apiKey),
    imageModel: (modelId) => new VargImageModel(modelId, baseUrl, apiKey),
    speechModel: (modelId) => new VargSpeechModel(modelId, baseUrl, apiKey),
    musicModel: (modelId) => new VargMusicModel(modelId, baseUrl, apiKey),
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
