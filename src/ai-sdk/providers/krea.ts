/**
 * Krea provider for the AI SDK — talks DIRECTLY to api.krea.ai with the user's
 * own `KREA_API_KEY` (bring-your-own-key). Plain `fetch`, no `@krea-ai/sdk`.
 *
 * Krea's API is one async job API for every model:
 *   POST   /generate/{path}   → { job_id, status }   (path e.g. "image/krea/krea-3")
 *   GET    /jobs/{id}         → { status, result: { urls[] }, error }
 *   DELETE /jobs/{id}         → cancel (sent when the caller aborts)
 *
 * ```ts
 * import { krea } from "vargai/ai";
 * <Image model={krea.imageModel("krea-3")} prompt="..." />
 * // provider-specific params:
 * providerOptions: { krea: { thinking_mode: "high", resolution: "2k" } }
 * ```
 *
 * Model ids: short aliases (see {@link KREA_IMAGE_MODELS}) or any raw
 * `/generate/` path (`"image/krea/krea-2/large"`, `"image/google/nano-banana-pro"`)
 * — raw paths get the generic body (prompt, aspect_ratio, seed,
 * files → image_urls) plus `providerOptions.krea` verbatim.
 *
 * To go through the varg API instead (varg's key, billing, R2 mirror), use
 * `varg.imageModel("krea")` / `"krea_3"`.
 */

import {
  type EmbeddingModelV3,
  type ImageModelV3,
  type ImageModelV3CallOptions,
  type ImageModelV3File,
  type LanguageModelV3,
  NoSuchModelError,
  type ProviderV3,
  type SharedV3Warning,
} from "@ai-sdk/provider";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KREA_BASE_URL = "https://api.krea.ai";
const KREA_TIMEOUT_MS = Number(process.env.KREA_TIMEOUT_MS ?? 10 * 60 * 1000);
const POLL_INTERVAL_MS = 2000;
const POLL_BACKOFF = 1.5;
const POLL_INTERVAL_CAP_MS = 10_000;

/** Short model ids → path under `/generate/`. `krea` always tracks the latest
 *  Krea model (today Krea 3). */
export const KREA_IMAGE_MODELS = {
  krea: "image/krea/krea-3",
  "krea-3": "image/krea/krea-3",
} as const;

const KREA_3_PATH = "image/krea/krea-3";

/** Krea 3 aspect ratios (live validator, 2026-10). */
const KREA_3_ASPECT_RATIOS = new Set([
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
  "5:4",
  "4:3",
  "3:2",
  "16:9",
  "21:9",
]);
const KREA_3_MAX_IMAGES = 8;

/** Job statuses — completed / failed / cancelled are terminal. */
type KreaStatus =
  | "backlogged"
  | "queued"
  | "scheduled"
  | "processing"
  | "sampling"
  | "intermediate-complete"
  | "completed"
  | "failed"
  | "cancelled";

interface KreaJob {
  job_id: string;
  status: KreaStatus | string;
  result?: {
    urls?: string[] | { type: string; url: string }[] | Record<string, string>;
  } | null;
  error?: { code?: string; message?: string } | null;
}

export class KreaAPIError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly jobId?: string,
  ) {
    super(message);
    this.name = "KreaAPIError";
  }
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

/** Resolve a short id or raw path to the path under `/generate/`. */
export function resolveKreaPath(modelId: string): string {
  const id = modelId.replace(/^krea\//, "");
  const alias = KREA_IMAGE_MODELS[id as keyof typeof KREA_IMAGE_MODELS];
  if (alias) return alias;
  if (id.includes("/"))
    return id.replace(/^\/+/, "").replace(/^generate\//, "");
  throw new NoSuchModelError({ modelId, modelType: "imageModel" });
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return `${response.status}${text ? `: ${text}` : ""}`;
}

async function submitJob(
  baseUrl: string,
  apiKey: string,
  path: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<KreaJob> {
  const response = await fetch(`${baseUrl}/generate/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    throw new KreaAPIError(
      `krea submit ${path} failed: ${await readError(response)}`,
      response.status,
    );
  }
  const job = (await response.json()) as KreaJob;
  if (!job?.job_id) {
    throw new KreaAPIError(`krea submit ${path}: response has no job_id`);
  }
  return job;
}

/** Best-effort cancel — never throws (the caller is already unwinding). */
async function cancelJob(
  baseUrl: string,
  apiKey: string,
  jobId: string,
): Promise<void> {
  await fetch(`${baseUrl}/jobs/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => undefined);
}

function firstUrl(job: KreaJob): string | undefined {
  const urls = job.result?.urls;
  if (!urls) return undefined;
  if (Array.isArray(urls)) {
    const first = urls[0];
    if (typeof first === "string") return first;
    const typed = urls as { type: string; url: string }[];
    return (typed.find((u) => u.type === "model") ?? typed[0])?.url;
  }
  return Object.values(urls).find((u) => typeof u === "string" && u);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

/** Poll GET /jobs/{id} until terminal; returns the output URL. On abort or
 *  timeout the job is cancelled upstream (DELETE) so it stops running. */
async function waitForJob(
  baseUrl: string,
  apiKey: string,
  jobId: string,
  signal?: AbortSignal,
): Promise<{ url: string; job: KreaJob }> {
  const startedAt = Date.now();
  let interval = POLL_INTERVAL_MS;

  while (Date.now() - startedAt < KREA_TIMEOUT_MS) {
    if (signal?.aborted) {
      await cancelJob(baseUrl, apiKey, jobId);
      throw new KreaAPIError(`krea job ${jobId} aborted`, undefined, jobId);
    }

    const response = await fetch(
      `${baseUrl}/jobs/${encodeURIComponent(jobId)}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal,
      },
    ).catch((e) => {
      if (signal?.aborted) return null;
      throw e;
    });
    if (response === null) continue; // aborted mid-request → top of loop cancels

    if (!response.ok) {
      throw new KreaAPIError(
        `krea poll ${jobId} failed: ${await readError(response)}`,
        response.status,
        jobId,
      );
    }
    const job = (await response.json()) as KreaJob;

    if (job.status === "completed") {
      const url = firstUrl(job);
      if (!url) {
        throw new KreaAPIError(
          `krea job ${jobId} completed but has no output URL`,
          undefined,
          jobId,
        );
      }
      return { url, job };
    }
    if (job.status === "failed" || job.status === "cancelled") {
      const detail =
        job.error?.message || job.error?.code || `job ${job.status}`;
      throw new KreaAPIError(
        `krea job ${jobId} ${job.status}: ${detail}`,
        undefined,
        jobId,
      );
    }

    await sleep(interval, signal);
    interval = Math.min(interval * POLL_BACKOFF, POLL_INTERVAL_CAP_MS);
  }

  await cancelJob(baseUrl, apiKey, jobId);
  throw new KreaAPIError(
    `krea job ${jobId} timed out after ${KREA_TIMEOUT_MS}ms`,
    undefined,
    jobId,
  );
}

async function downloadToBytes(
  url: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new KreaAPIError(
      `failed to download krea output ${url}: ${response.status}`,
      response.status,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Request bodies
// ---------------------------------------------------------------------------

function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** V3 file → something Krea accepts in `image_urls`: the URL as-is, or a
 *  base64 data URI for in-memory files (Krea takes data URIs directly). */
export function kreaFileToUrl(file: ImageModelV3File): string {
  if (file.type === "url") return file.url;
  if (typeof file.data === "string" && file.data.startsWith("data:")) {
    return file.data;
  }
  const b64 =
    typeof file.data === "string" ? file.data : uint8ToBase64(file.data);
  return `data:${file.mediaType || "image/png"};base64,${b64}`;
}

/** Strip client-only keys from `providerOptions.krea`. */
function extractKreaProviderOpts(
  providerOptions: ImageModelV3CallOptions["providerOptions"],
): Record<string, unknown> {
  const { apiKey: _apiKey, ...rest } = (providerOptions?.krea ?? {}) as Record<
    string,
    unknown
  >;
  return rest;
}

/**
 * Build the `/generate/` body. `providerOptions.krea` is spread LAST so it can
 * override anything derived from the standard call options.
 * Exported for tests.
 */
export function buildKreaBody(
  path: string,
  options: ImageModelV3CallOptions,
  warnings: SharedV3Warning[],
): Record<string, unknown> {
  const { prompt, aspectRatio, size, seed, files, mask } = options;
  const body: Record<string, unknown> = {};
  if (prompt !== undefined) body.prompt = prompt;
  if (seed !== undefined) body.seed = seed;
  if (files?.length) body.image_urls = files.map(kreaFileToUrl);
  if (mask) {
    warnings.push({
      type: "unsupported",
      feature: "mask",
      details: "krea: masks are not supported; ignored.",
    });
  }

  if (path === KREA_3_PATH) {
    if (aspectRatio) {
      if (KREA_3_ASPECT_RATIOS.has(aspectRatio)) {
        body.aspect_ratio = aspectRatio;
      } else {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `krea-3 does not support ${aspectRatio}; using the model default. Supported: ${[...KREA_3_ASPECT_RATIOS].join(", ")}.`,
        });
      }
    }
    if (size) {
      const [w, h] = size.split("x").map(Number);
      body.width = w;
      body.height = h;
    }
    const imageUrls = body.image_urls as string[] | undefined;
    if (imageUrls && imageUrls.length > KREA_3_MAX_IMAGES) {
      warnings.push({
        type: "other",
        message: `krea-3 accepts at most ${KREA_3_MAX_IMAGES} input images; sending the first ${KREA_3_MAX_IMAGES}.`,
      });
      body.image_urls = imageUrls.slice(0, KREA_3_MAX_IMAGES);
    }
  } else {
    if (aspectRatio) body.aspect_ratio = aspectRatio;
    if (size) {
      warnings.push({
        type: "unsupported",
        feature: "size",
        details: `krea ${path}: pass explicit dimensions via providerOptions.krea; size ignored.`,
      });
    }
  }

  Object.assign(body, extractKreaProviderOpts(options.providerOptions));

  // Krea 3 needs exactly one of resolution OR width+height: neither → the job
  // is accepted then fails ("job needs width/height or resolution"); both → 422.
  if (path === KREA_3_PATH) {
    const sized = body.width != null || body.height != null;
    if (sized) delete body.resolution;
    else if (body.resolution == null) body.resolution = "1k";
  }
  return body;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

function resolveApiKey(perCall: unknown, fromSettings: string | null): string {
  const key =
    (typeof perCall === "string" && perCall) ||
    fromSettings ||
    process.env.KREA_API_KEY;
  if (!key) {
    throw new KreaAPIError(
      "No Krea API key available. Pass `apiKey` to `createKrea({...})`, set " +
        "`process.env.KREA_API_KEY`, or supply `providerOptions.krea.apiKey` per call.",
    );
  }
  return key;
}

class KreaImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "krea";
  readonly modelId: string;
  /** Krea generates one image per job (batch_size was removed upstream). */
  readonly maxImagesPerCall = 1;

  private path: string;

  constructor(
    modelId: string,
    private apiKey: string | null,
    private baseUrl: string,
  ) {
    this.modelId = modelId;
    this.path = resolveKreaPath(modelId);
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const warnings: SharedV3Warning[] = [];
    const key = resolveApiKey(
      (options.providerOptions?.krea as Record<string, unknown> | undefined)
        ?.apiKey,
      this.apiKey,
    );
    const signal = options.abortSignal;
    const body = buildKreaBody(this.path, options, warnings);

    const submitted = await submitJob(
      this.baseUrl,
      key,
      this.path,
      body,
      signal,
    );
    const { url } = await waitForJob(
      this.baseUrl,
      key,
      submitted.job_id,
      signal,
    );
    const image = await downloadToBytes(url, signal);

    return {
      images: [image],
      warnings,
      providerMetadata: {
        krea: { images: [{ jobId: submitted.job_id, url }] },
      },
      response: {
        timestamp: new Date(),
        modelId: this.modelId,
        headers: undefined,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface KreaProviderSettings {
  /** Defaults to `process.env.KREA_API_KEY`. */
  apiKey?: string;
  /** Defaults to `process.env.KREA_BASE_URL` or https://api.krea.ai. */
  baseUrl?: string;
}

export interface KreaProvider extends ProviderV3 {
  imageModel(modelId: string): ImageModelV3;
}

export function createKrea(settings: KreaProviderSettings = {}): KreaProvider {
  const apiKey = settings.apiKey ?? process.env.KREA_API_KEY ?? null;
  const baseUrl = (
    settings.baseUrl ??
    process.env.KREA_BASE_URL ??
    KREA_BASE_URL
  ).replace(/\/+$/, "");

  return {
    specificationVersion: "v3",
    imageModel(modelId: string): ImageModelV3 {
      return new KreaImageModel(modelId, apiKey, baseUrl);
    },
    languageModel(modelId: string): LanguageModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel(modelId: string): EmbeddingModelV3 {
      throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
    },
  };
}

const krea_provider = createKrea();
export { krea_provider as krea };
