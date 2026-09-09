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

/** Exported for CLI actions that need the same config resolution. */
export function resolveVargConfig(settings: VargProviderSettings = {}) {
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
  "openai",
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

/**
 * Stable idempotency key for a job submission.
 *
 * Hash of (capability, params) with deterministic key ordering — the same
 * logical request always produces the same key, so a retry after 429 or a
 * network error references the SAME job instead of creating a duplicate
 * (the ep5 incident: 123 jobs for ~8 unique requests, all idempotency-less).
 *
 * A per-process salt is NOT included: two identical submissions from the
 * same or different processes legitimately dedupe to one job — outputs are
 * deterministic-cached by the API anyway.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object" && value.constructor === Object) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** Exported for tests. */
export function computeIdempotencyKey(
  capability: string,
  params: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(canonicalize(params));
  return `varg-sdk-${capability}-${Bun.hash(canonical).toString(16)}`;
}

async function submitJob(
  baseUrl: string,
  apiKey: string,
  capability: "video" | "image" | "speech" | "music",
  params: Record<string, unknown>,
  maxRetries = 6,
): Promise<VargJobResponse> {
  const idempotencyKey = computeIdempotencyKey(capability, params);
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`${baseUrl}/${capability}`, {
      method: "POST",
      headers: {
        ...getHeaders(apiKey),
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      return (await response.json()) as VargJobResponse;
    }

    const raw = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    const errorData = ((raw?.error ?? raw) || {}) as { message?: string };
    const msg = errorData?.message ?? `varg api returned ${response.status}`;

    // Rate limited — back off and retry (60 jobs/min window resets quickly).
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(60_000, 5_000 * 2 ** attempt);
      console.warn(
        `[varg] rate limited on ${capability}, retrying in ${Math.round(delayMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    throw new VargAPIError(msg, response.status);
  }
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

/**
 * Submit + poll a /v2 job and return the first output URL (no download).
 * Used by CLI actions that need a URL (not bytes) — e.g. the `image` action's
 * openai provider path, which returns { imageUrl } to the caller.
 */
export async function executeJobUrl(
  baseUrl: string,
  apiKey: string,
  capability: "video" | "image" | "speech" | "music",
  params: Record<string, unknown>,
): Promise<{ url: string; mediaType: string; jobId: string }> {
  const job = await submitJob(baseUrl, apiKey, capability, params);

  let terminal = job;
  if (!(job.status === "completed" && job.output?.outputs?.length)) {
    terminal = await pollJob(baseUrl, apiKey, job.id);
  }

  if (terminal.status === "failed") {
    throw new VargAPIError(
      `job ${terminal.id} failed: ${terminal.error || "unknown"}`,
    );
  }
  if (terminal.status === "cancelled") {
    throw new VargAPIError(`job ${terminal.id} was cancelled`);
  }
  const out = terminal.output?.outputs?.[0];
  if (!out?.url) {
    throw new VargAPIError(`${capability} completed but no output URL`);
  }
  return {
    url: out.url,
    mediaType: out.media_type ?? "application/octet-stream",
    jobId: terminal.id,
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
      const vargOpts = {
        ...(options.providerOptions.varg as Record<string, unknown>),
      };
      // Unified varg-API fields riding the `varg` namespace are lifted to the
      // request body top level — they are NOT provider_options. `audio` is the
      // unified native-audio request (audio: "native" sugar): the API maps it
      // per model via mapping_rules (rename audio → generate_audio) and models
      // without the rule silently ignore it. Sending it inside
      // provider_options.fal instead used to rely on the API silently
      // stripping unknown keys, which now 422s.
      if (vargOpts.audio !== undefined) {
        params.audio = vargOpts.audio;
        delete vargOpts.audio;
      }
      if (Object.keys(vargOpts).length > 0) {
        params.provider_options = checkVargProviderOptions(vargOpts);
      }
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
    // Integer seconds: the API converts to ms by multiplying without
    // rounding, and ElevenLabs rejects fractional music_length_ms with a
    // 422 (int_from_float). Fractional seconds also survive float
    // multiplication badly (88.35 * 1000 = 88349.999...), so rounding to
    // whole seconds client-side is the only safe shape until the API
    // rounds server-side. BGM is auto-trimmed to the timeline anyway.
    if (options.duration) params.duration = Math.round(options.duration);
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
  const { apiKey, baseUrl } = resolveVargConfig(settings);

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
