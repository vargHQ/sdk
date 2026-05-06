/**
 * Magnific provider — internal module powering `varg.imageModel("magnific/...")`,
 * `varg.videoModel("magnific/...")`, `varg.musicModel("magnific/default")`, and
 * `varg.speechModel("magnific/<sound-effects|audio-isolation>")`.
 *
 * Two execution paths share the same model maps and payload builders:
 *
 *   1. BYOK direct path  — when a Magnific key is resolvable, the call goes
 *                          straight to api.magnific.com.
 *   2. Varg gateway path — otherwise the model id is forwarded as-is to the
 *                          Varg gateway, which holds Magnific credentials.
 *
 * This file exposes the BYOK direct entry points and the routing helpers used
 * by `src/ai-sdk/providers/varg.ts`. It is intentionally NOT re-exported from
 * `src/ai-sdk/index.ts` — Magnific is reached only through the `varg` provider.
 *
 * ─── Known live-tested gotchas (per 2026-05-06 verification run) ──────────
 *
 *   • POST /ai/beta/remove-background uses `application/x-www-form-urlencoded`
 *     and returns a flat `{ url, high_resolution, preview, original }` shape
 *     instead of `{ generated: [...] }`. Both handled below
 *     (FORM_ENCODED_PATHS, extractGenerated).
 *
 *   • Several Kling endpoints POST to `…-pro` but POLL under the non-`-pro`
 *     slug. Captured in POLL_PATH_OVERRIDES.
 *
 *   • Magnific can return `status: "FAILED"` with NO error detail. Empirically
 *     this means input-compatibility rejection (e.g. unsupported video codec
 *     for VFX, oversized image, format Magnific can't decode). The thrown
 *     MagnificAPIError surfaces the capability path + task_id so users can
 *     retry with a different input. Specific case verified live: VFX rejects
 *     `commondatastorage.googleapis.com/.../ForBiggerJoyrides.mp4` regardless
 *     of `filter_type` (1 or 2 both fail) — but `download.samplelib.com/.../
 *     sample-5s.mp4` succeeds with both filters. Not an SDK bug; document the
 *     class of failure and suggest a different input.
 *
 *   • `magnific/expand` (Flux Pro outpaint) requires ≥512px source images;
 *     smaller inputs reach FAILED with no detail. Not enforced client-side
 *     because the docs don't list a hard minimum.
 *
 *   • Endpoints with un-published schemas (Z-Image, Seedream-edit) had the
 *     wrong path in our llms.txt-derived map; verified live and corrected.
 *     `seedream-v4.5/edit` actually requires `reference_images: string[]`,
 *     not a singular `image` field — the builder enforces this.
 */

import {
  type ImageModelV3CallOptions,
  type ImageModelV3File,
  NoSuchModelError,
  type SpeechModelV3CallOptions,
} from "@ai-sdk/provider";
import type { MusicModelV3CallOptions } from "../music-model";
import type { VideoModelV3CallOptions } from "../video-model";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAGNIFIC_BASE_URL = "https://api.magnific.com/v1";
export const MAGNIFIC_PREFIX = "magnific/";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const MAGNIFIC_TIMEOUT_MS = (() => {
  const raw = process.env.MAGNIFIC_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
})();

const POLL_INTERVAL_MS = 2000;
const POLL_BACKOFF = 1.5;
const POLL_INTERVAL_CAP_MS = 10_000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MagnificAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public taskId?: string,
  ) {
    super(message);
    this.name = "MagnificAPIError";
  }
}

// ---------------------------------------------------------------------------
// Static model maps — keys are user-facing leaves under `magnific/<leaf>`,
// values are the capability path appended to MAGNIFIC_BASE_URL.
// ---------------------------------------------------------------------------

export const IMAGE_MODELS: Record<string, string> = {
  // Unique to Magnific
  "upscale-creative": "ai/image-upscaler",
  "upscale-precision": "ai/image-upscaler-precision",
  relight: "ai/image-relight",
  "style-transfer": "ai/image-style-transfer",
  "remove-bg": "ai/beta/remove-background", // synchronous endpoint
  expand: "ai/image-expand/flux-pro",
  // Magnific image-gen (Mystic flagship + others)
  mystic: "ai/mystic",
  "flux-2-pro": "ai/text-to-image/flux-2-pro",
  "flux-2-turbo": "ai/text-to-image/flux-2-turbo",
  "flux-2-klein": "ai/text-to-image/flux-2-klein",
  "flux-pro-v1.1": "ai/text-to-image/flux-pro-v1-1",
  "flux-dev": "ai/text-to-image/flux-dev",
  hyperflux: "ai/text-to-image/hyperflux",
  "seedream-4": "ai/text-to-image/seedream-v4",
  "seedream-v4.5": "ai/text-to-image/seedream-v4-5",
  "seedream-v4.5/edit": "ai/text-to-image/seedream-v4-5-edit",
  "z-image-turbo": "ai/text-to-image/z-image",
  "runway-image": "ai/text-to-image/runway",
};

export const VIDEO_MODELS: Record<string, string> = {
  "kling-v2.1-pro": "ai/image-to-video/kling-v2-1-pro",
  "kling-v2.5-pro": "ai/image-to-video/kling-v2-5-pro",
  "kling-v2.6-pro": "ai/image-to-video/kling-v2-6-pro",
  "kling-motion-control": "ai/video/kling-v3-motion-control-pro",
  "kling-o1-pro": "ai/image-to-video/kling-o1-pro",
  "kling-v3-pro": "ai/video/kling-v3-pro",
  "minimax-hailuo-02": "ai/image-to-video/minimax-hailuo-02-1080p",
  "minimax-hailuo-2.3": "ai/image-to-video/minimax-hailuo-2-3-1080p",
  "minimax-video-01-live": "ai/image-to-video/minimax-live",
  "wan-2.5-t2v": "ai/text-to-video/wan-2-5-t2v-1080p",
  "wan-2.5-i2v": "ai/image-to-video/wan-2-5-i2v-1080p",
  "wan-2.6": "ai/image-to-video/wan-v2-6-1080p",
  "runway-gen4-turbo": "ai/image-to-video/runway-gen4-turbo",
  "runway-act-two": "ai/video/runway-act-two",
  "ltx-2-pro": "ai/text-to-video/ltx-2-pro",
  "seedance-pro": "ai/image-to-video/seedance-pro-1080p",
  pixverse: "ai/image-to-video/pixverse-v5",
  "omnihuman-v1.5": "ai/video/omni-human-1-5",
  vfx: "ai/video/vfx",
};

export const MUSIC_MODELS: Record<string, string> = {
  default: "ai/music-generation",
};

export const SPEECH_MODELS: Record<string, string> = {
  "sound-effects": "ai/sound-effects",
  "audio-isolation": "ai/audio-isolation",
};

const SYNCHRONOUS_PATHS = new Set<string>(["ai/beta/remove-background"]);

/**
 * Endpoints that require `application/x-www-form-urlencoded` instead of JSON.
 * `remove-background/beta` is the only one we've found.
 */
const FORM_ENCODED_PATHS = new Set<string>(["ai/beta/remove-background"]);

/**
 * Endpoints whose polling URL differs from the POST URL. For these, polling
 * uses `<override>/{task_id}` instead of `<post_path>/{task_id}`. Several Kling
 * variants polled under the non-`-pro` slug; verified live 2026-05-06.
 */
const POLL_PATH_OVERRIDES: Record<string, string> = {
  "ai/image-to-video/kling-v2-1-pro": "ai/image-to-video/kling-v2-1",
  "ai/image-to-video/kling-v2-6-pro": "ai/image-to-video/kling-v2-6",
  "ai/image-to-video/kling-o1-pro": "ai/image-to-video/kling-o1",
  "ai/video/kling-v3-pro": "ai/video/kling-v3",
};

// ---------------------------------------------------------------------------
// Namespace + key resolution
// ---------------------------------------------------------------------------

/** Strip the "magnific/" prefix and return the leaf, or null if not in namespace. */
export function parseMagnificModelId(modelId: string): string | null {
  return modelId.startsWith(MAGNIFIC_PREFIX)
    ? modelId.slice(MAGNIFIC_PREFIX.length)
    : null;
}

export interface MagnificKeyResolutionInput {
  /** VargProviderSettings — `magnificApiKey` set at `createVarg({...})` time. */
  settings?: { magnificApiKey?: string };
  /** Per-call `options.providerOptions.magnific` — may carry an `apiKey`. */
  perCall?: Record<string, unknown>;
}

/**
 * Resolve a Magnific BYOK key. Precedence (highest first):
 *   1. perCall.apiKey               (per-`doGenerate` override)
 *   2. settings.magnificApiKey      (per-VargProvider override)
 *   3. process.env.MAGNIFIC_API_KEY (default)
 *
 * Returns null when no key is available (caller falls back to gateway).
 */
export function resolveMagnificKey(
  args: MagnificKeyResolutionInput = {},
): string | null {
  const fromCall =
    typeof args.perCall?.apiKey === "string" && args.perCall.apiKey.length > 0
      ? (args.perCall.apiKey as string)
      : null;
  if (fromCall) return fromCall;

  const fromSettings = args.settings?.magnificApiKey;
  if (fromSettings) return fromSettings;

  const fromEnv = process.env.MAGNIFIC_API_KEY;
  if (fromEnv) return fromEnv;

  return null;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

interface MagnificTaskShape {
  task_id?: string;
  status?: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  generated?: string[];
  has_nsfw?: boolean[];
  error?: string | { message?: string };
  message?: string;
  data?: MagnificTaskShape;
  // Shape variant returned by some synchronous endpoints (e.g. remove-bg).
  url?: string;
  high_resolution?: string;
  preview?: string;
  original?: string;
}

/** Pull output URLs from any of the shapes Magnific returns. */
function extractGenerated(shape: MagnificTaskShape): string[] | null {
  if (shape.generated?.length) return shape.generated;
  // remove-bg shape: { url, high_resolution, preview, original }
  const urls = [shape.high_resolution, shape.url, shape.preview].filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  return urls.length ? urls : null;
}

function getHeaders(apiKey: string): Record<string, string> {
  return {
    "x-magnific-api-key": apiKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function unwrap(payload: unknown): MagnificTaskShape {
  // Magnific wraps responses in { data: { ... } } per the polling docs;
  // some endpoints return the object directly. Handle both.
  if (payload && typeof payload === "object") {
    const obj = payload as MagnificTaskShape;
    if (obj.data && typeof obj.data === "object") return obj.data;
    return obj;
  }
  return {};
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string };
    } | null;
    return (
      body?.error?.message ??
      body?.message ??
      `magnific returned ${response.status}`
    );
  } catch {
    return `magnific returned ${response.status}`;
  }
}

interface SubmitResult {
  taskId: string | null; // null when endpoint is synchronous
  finalUrls: string[] | null; // populated when synchronous or COMPLETED on submit
}

async function submitTask(
  apiKey: string,
  capabilityPath: string,
  body: Record<string, unknown>,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<SubmitResult> {
  const url = `${baseUrl}/${capabilityPath}`;
  const isForm = FORM_ENCODED_PATHS.has(capabilityPath);
  const headers: Record<string, string> = {
    "x-magnific-api-key": apiKey,
    Accept: "application/json",
    "Content-Type": isForm
      ? "application/x-www-form-urlencoded"
      : "application/json",
  };
  const reqBody = isForm
    ? new URLSearchParams(
        Object.fromEntries(
          Object.entries(body).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : JSON.stringify(body);
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: reqBody,
    signal,
  });

  if (!response.ok) {
    throw new MagnificAPIError(
      `magnific submit ${capabilityPath} failed: ${await readError(response)}`,
      response.status,
    );
  }

  const data = unwrap(await response.json());
  const generated = extractGenerated(data);

  // Synchronous endpoint or cache hit
  if (
    SYNCHRONOUS_PATHS.has(capabilityPath) ||
    (data.status === "COMPLETED" && generated?.length)
  ) {
    if (!generated?.length) {
      throw new MagnificAPIError(
        `magnific ${capabilityPath} returned no output URLs`,
      );
    }
    return { taskId: data.task_id ?? null, finalUrls: generated };
  }

  if (!data.task_id) {
    throw new MagnificAPIError(
      `magnific ${capabilityPath} response missing task_id`,
    );
  }
  return { taskId: data.task_id, finalUrls: null };
}

async function pollTask(
  apiKey: string,
  capabilityPath: string,
  taskId: string,
  baseUrl: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const pollPath = POLL_PATH_OVERRIDES[capabilityPath] ?? capabilityPath;
  const url = `${baseUrl}/${pollPath}/${taskId}`;
  const startedAt = Date.now();
  let interval = POLL_INTERVAL_MS;

  while (Date.now() - startedAt < MAGNIFIC_TIMEOUT_MS) {
    if (signal?.aborted) {
      throw new MagnificAPIError(
        `magnific task ${taskId} aborted`,
        undefined,
        taskId,
      );
    }

    const response = await fetch(url, {
      method: "GET",
      headers: getHeaders(apiKey),
      signal,
    });
    if (!response.ok) {
      throw new MagnificAPIError(
        `magnific poll ${taskId} failed: ${await readError(response)}`,
        response.status,
        taskId,
      );
    }

    const data = unwrap(await response.json());
    if (data.status === "COMPLETED") {
      const generated = extractGenerated(data);
      if (!generated?.length) {
        throw new MagnificAPIError(
          `magnific task ${taskId} completed but no output URLs`,
          undefined,
          taskId,
        );
      }
      return generated;
    }
    if (data.status === "FAILED") {
      const rawMsg =
        typeof data.error === "string"
          ? data.error
          : (data.error?.message ?? "unknown");
      // Magnific often returns FAILED with no detail when an input is
      // incompatible (unsupported video codec, image too small for Flux Pro
      // outpaint, etc.). Make that actionable for the caller.
      const friendly =
        rawMsg === "unknown"
          ? "no error detail. Magnific commonly returns this when the input is incompatible (e.g. unsupported video codec or resolution, image too small for the endpoint, or unsupported format). Try a different input."
          : rawMsg;
      throw new MagnificAPIError(
        `magnific ${capabilityPath} task ${taskId} failed: ${friendly}`,
        undefined,
        taskId,
      );
    }

    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * POLL_BACKOFF, POLL_INTERVAL_CAP_MS);
  }

  throw new MagnificAPIError(
    `magnific task ${taskId} timed out after ${MAGNIFIC_TIMEOUT_MS}ms`,
    undefined,
    taskId,
  );
}

async function executeTask(
  apiKey: string,
  capabilityPath: string,
  body: Record<string, unknown>,
  options: { baseUrl?: string; signal?: AbortSignal } = {},
): Promise<{ urls: string[] }> {
  const baseUrl = options.baseUrl ?? MAGNIFIC_BASE_URL;
  const submitted = await submitTask(
    apiKey,
    capabilityPath,
    body,
    baseUrl,
    options.signal,
  );
  if (submitted.finalUrls) return { urls: submitted.finalUrls };
  if (!submitted.taskId) {
    throw new MagnificAPIError(
      `magnific ${capabilityPath}: no task_id and no output`,
    );
  }
  const urls = await pollTask(
    apiKey,
    capabilityPath,
    submitted.taskId,
    baseUrl,
    options.signal,
  );
  return { urls };
}

async function downloadToBytes(
  url: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new MagnificAPIError(
      `failed to download magnific output ${url}: ${response.status}`,
      response.status,
    );
  }
  return new Uint8Array(await response.arrayBuffer());
}

function inferMime(url: string): string {
  try {
    const ext = new URL(url).pathname.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "png":
        return "image/png";
      case "jpg":
      case "jpeg":
        return "image/jpeg";
      case "webp":
        return "image/webp";
      case "gif":
        return "image/gif";
      case "mp4":
        return "video/mp4";
      case "webm":
        return "video/webm";
      case "mov":
        return "video/quicktime";
      case "mp3":
        return "audio/mpeg";
      case "wav":
        return "audio/wav";
      case "ogg":
        return "audio/ogg";
      case "m4a":
        return "audio/mp4";
      default:
        return "application/octet-stream";
    }
  } catch {
    return "application/octet-stream";
  }
}

// ---------------------------------------------------------------------------
// File handling
// ---------------------------------------------------------------------------

interface InlineFile {
  /** Raw base64 (no `data:` prefix). */
  base64: string;
  /** URL form when the input was already a URL; null when only base64 is available. */
  url: string | null;
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Bun + Node both support Buffer; fall back to a manual loop for completeness.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // biome-ignore lint/suspicious/noExplicitAny: btoa available in Bun runtime
  return (globalThis as any).btoa(binary);
}

async function fetchToBase64(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new MagnificAPIError(
      `failed to fetch input ${url}: ${response.status}`,
      response.status,
    );
  }
  return uint8ToBase64(new Uint8Array(await response.arrayBuffer()));
}

/**
 * Convert a V3 file part (URL or binary) into both forms for endpoints that
 * accept either. Endpoints that strictly require a URL should read `url` and
 * throw if null; endpoints that strictly require base64 read `base64`.
 *
 * For URL inputs we DO NOT pre-fetch the bytes — only resolve to base64 when
 * the caller explicitly asks via {@link toBase64}.
 */
function fileToInline(
  file: ImageModelV3File | undefined | null,
): InlineFile | null {
  if (!file) return null;
  if (file.type === "url") {
    return { base64: "", url: file.url };
  }
  // type === "file"
  const data = file.data;
  if (typeof data === "string") {
    return { base64: data, url: null };
  }
  return { base64: uint8ToBase64(data), url: null };
}

/** Resolve to a base64 string regardless of input form (fetches URLs). */
async function toBase64(
  file: ImageModelV3File,
  signal?: AbortSignal,
): Promise<string> {
  const inline = fileToInline(file);
  if (!inline) {
    throw new MagnificAPIError("missing input file");
  }
  if (inline.base64) return inline.base64;
  if (inline.url) return fetchToBase64(inline.url, signal);
  throw new MagnificAPIError("input file resolved to neither base64 nor URL");
}

/** Resolve to a URL regardless of input form (errors on binary inputs). */
function toUrl(file: ImageModelV3File): string {
  const inline = fileToInline(file);
  if (!inline?.url) {
    throw new MagnificAPIError(
      "this magnific endpoint requires a URL input (publicly accessible). Pass `{ type: 'url', url: '...' }`.",
    );
  }
  return inline.url;
}

/**
 * Drop undefined entries from a body. Magnific accepts missing keys as
 * "use default"; sending null/undefined explicitly causes some endpoints to
 * reject the request.
 */
function prune(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builder context
// ---------------------------------------------------------------------------

interface BuilderCtx {
  /** Full `options.providerOptions.magnific` (apiKey already stripped). */
  providerOpts: Record<string, unknown>;
  signal?: AbortSignal;
}

type ImageBuilder = (
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
) => Promise<Record<string, unknown>>;
type VideoBuilder = (
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
) => Promise<Record<string, unknown>>;
type MusicBuilder = (
  opts: MusicModelV3CallOptions,
  ctx: BuilderCtx,
) => Promise<Record<string, unknown>>;
type SpeechBuilder = (
  opts: SpeechModelV3CallOptions,
  ctx: BuilderCtx,
) => Promise<Record<string, unknown>>;

function po<T>(ctx: BuilderCtx, key: string, fallback: T): T {
  const v = ctx.providerOpts[key];
  return v === undefined ? fallback : (v as T);
}

function poOpt<T>(ctx: BuilderCtx, key: string): T | undefined {
  return ctx.providerOpts[key] as T | undefined;
}

// ---------------------------------------------------------------------------
// Image builders — every property from the docs covered
// ---------------------------------------------------------------------------

async function buildUpscaleCreative(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  if (!opts.files?.[0]) {
    throw new MagnificAPIError(
      "magnific/upscale-creative requires an input image",
    );
  }
  return prune({
    image: await toBase64(opts.files[0], ctx.signal),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    scale_factor: po(ctx, "scale_factor", "2x"),
    optimized_for: po(ctx, "optimized_for", "standard"),
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    creativity: po(ctx, "creativity", 0),
    hdr: po(ctx, "hdr", 0),
    resemblance: po(ctx, "resemblance", 0),
    fractality: po(ctx, "fractality", 0),
    engine: po(ctx, "engine", "automatic"),
    filter_nsfw: po(ctx, "filter_nsfw", false),
  });
}

async function buildUpscalePrecision(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  if (!opts.files?.[0]) {
    throw new MagnificAPIError(
      "magnific/upscale-precision requires an input image",
    );
  }
  return prune({
    image: await toBase64(opts.files[0], ctx.signal),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    sharpen: po(ctx, "sharpen", 50),
    smart_grain: po(ctx, "smart_grain", 7),
    ultra_detail: po(ctx, "ultra_detail", 30),
    filter_nsfw: po(ctx, "filter_nsfw", false),
  });
}

async function buildRelight(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  if (!opts.files?.[0]) {
    throw new MagnificAPIError("magnific/relight requires an input image");
  }
  const advUser = (ctx.providerOpts.advanced_settings ?? {}) as Record<
    string,
    unknown
  >;
  const advanced_settings = prune({
    whites: advUser.whites ?? 50,
    blacks: advUser.blacks ?? 50,
    brightness: advUser.brightness ?? 50,
    contrast: advUser.contrast ?? 50,
    saturation: advUser.saturation ?? 50,
    engine: advUser.engine ?? "automatic",
    transfer_light_a: advUser.transfer_light_a ?? "automatic",
    transfer_light_b: advUser.transfer_light_b ?? "automatic",
    fixed_generation: advUser.fixed_generation ?? false,
  });
  return prune({
    image: await toBase64(opts.files[0], ctx.signal),
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    transfer_light_from_reference_image: poOpt<string>(
      ctx,
      "transfer_light_from_reference_image",
    ),
    transfer_light_from_lightmap: poOpt<string>(
      ctx,
      "transfer_light_from_lightmap",
    ),
    light_transfer_strength: po(ctx, "light_transfer_strength", 100),
    interpolate_from_original: po(ctx, "interpolate_from_original", false),
    change_background: po(ctx, "change_background", true),
    style: po(ctx, "style", "standard"),
    preserve_details: po(ctx, "preserve_details", true),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    advanced_settings,
  });
}

async function buildStyleTransfer(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  if (!opts.files?.[0]) {
    throw new MagnificAPIError(
      "magnific/style-transfer requires an input image",
    );
  }
  const referenceFromOpts = opts.files?.[1];
  const referenceFromCtx = poOpt<string>(ctx, "reference_image");
  const reference =
    referenceFromCtx ??
    (referenceFromOpts
      ? await toBase64(referenceFromOpts, ctx.signal)
      : undefined);
  if (!reference) {
    throw new MagnificAPIError(
      "magnific/style-transfer requires a reference image (pass as second file or providerOptions.magnific.reference_image)",
    );
  }
  return prune({
    image: await toBase64(opts.files[0], ctx.signal),
    reference_image: reference,
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    style_strength: po(ctx, "style_strength", 100),
    structure_strength: po(ctx, "structure_strength", 50),
    is_portrait: po(ctx, "is_portrait", false),
    portrait_style: po(ctx, "portrait_style", "standard"),
    portrait_beautifier: poOpt<string>(ctx, "portrait_beautifier"),
    flavor: po(ctx, "flavor", "faithful"),
    engine: po(ctx, "engine", "balanced"),
    fixed_generation: po(ctx, "fixed_generation", false),
  });
}

async function buildRemoveBg(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  if (!opts.files?.[0]) {
    throw new MagnificAPIError("magnific/remove-bg requires an input image");
  }
  // The remove-bg endpoint strictly requires a URL — Magnific does not accept
  // base64 here. If the user passes a binary file, fall back to providerOpts
  // override or throw.
  const overrideUrl = poOpt<string>(ctx, "image_url");
  const url = overrideUrl ?? toUrl(opts.files[0]);
  return prune({ image_url: url });
}

async function buildExpand(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  if (!opts.files?.[0]) {
    throw new MagnificAPIError("magnific/expand requires an input image");
  }
  return prune({
    image: await toBase64(opts.files[0], ctx.signal),
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    left: poOpt<number>(ctx, "left"),
    right: poOpt<number>(ctx, "right"),
    top: poOpt<number>(ctx, "top"),
    bottom: poOpt<number>(ctx, "bottom"),
  });
}

async function buildMystic(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    structure_reference: poOpt<string>(ctx, "structure_reference"),
    structure_strength: po(ctx, "structure_strength", 50),
    style_reference: poOpt<string>(ctx, "style_reference"),
    adherence: po(ctx, "adherence", 50),
    hdr: po(ctx, "hdr", 50),
    resolution: po(ctx, "resolution", "2k"),
    aspect_ratio: po(ctx, "aspect_ratio", "square_1_1"),
    model: po(ctx, "model", "realism"),
    creative_detailing: po(ctx, "creative_detailing", 33),
    engine: po(ctx, "engine", "automatic"),
    fixed_generation: po(ctx, "fixed_generation", false),
    filter_nsfw: po(ctx, "filter_nsfw", true),
    styling: poOpt<unknown>(ctx, "styling"),
  });
}

async function buildFlux2Pro(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const inputs = opts.files ?? [];
  const collectInput = async (i: number): Promise<string | undefined> =>
    inputs[i] ? await toBase64(inputs[i]!, ctx.signal) : undefined;

  const sizeFromV3 = parseSize(opts.size);
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/flux-2-pro"),
    width: po(ctx, "width", sizeFromV3?.width ?? 1024),
    height: po(ctx, "height", sizeFromV3?.height ?? 768),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    prompt_upsampling: po(ctx, "prompt_upsampling", false),
    input_image: poOpt<string>(ctx, "input_image") ?? (await collectInput(0)),
    input_image_2:
      poOpt<string>(ctx, "input_image_2") ?? (await collectInput(1)),
    input_image_3:
      poOpt<string>(ctx, "input_image_3") ?? (await collectInput(2)),
    input_image_4:
      poOpt<string>(ctx, "input_image_4") ?? (await collectInput(3)),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildFlux2Turbo(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const sizeFromV3 = parseSize(opts.size);
  const userImageSize = poOpt<{ width?: number; height?: number }>(
    ctx,
    "image_size",
  );
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/flux-2-turbo"),
    guidance_scale: po(ctx, "guidance_scale", 2.5),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    image_size: prune({
      width: userImageSize?.width ?? sizeFromV3?.width ?? 1024,
      height: userImageSize?.height ?? sizeFromV3?.height ?? 1024,
    }),
    enable_safety_checker: po(ctx, "enable_safety_checker", true),
    output_format: po(ctx, "output_format", "png"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildFlux2Klein(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const inputs = opts.files ?? [];
  const collectInput = async (i: number): Promise<string | undefined> =>
    inputs[i] ? await toBase64(inputs[i]!, ctx.signal) : undefined;
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/flux-2-klein"),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToMagnific(opts.aspectRatio) ?? "square_1_1",
    ),
    resolution: po(ctx, "resolution", "1k"),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    input_image: poOpt<string>(ctx, "input_image") ?? (await collectInput(0)),
    input_image_2:
      poOpt<string>(ctx, "input_image_2") ?? (await collectInput(1)),
    input_image_3:
      poOpt<string>(ctx, "input_image_3") ?? (await collectInput(2)),
    input_image_4:
      poOpt<string>(ctx, "input_image_4") ?? (await collectInput(3)),
    safety_tolerance: po(ctx, "safety_tolerance", 2),
    output_format: poOpt<string>(ctx, "output_format"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildFluxProV11(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/flux-pro-v1.1"),
    prompt_upsampling: po(ctx, "prompt_upsampling", false),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToMagnific(opts.aspectRatio) ?? "square_1_1",
    ),
    safety_tolerance: po(ctx, "safety_tolerance", 2),
    output_format: poOpt<string>(ctx, "output_format"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildFluxDev(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToMagnific(opts.aspectRatio) ?? "square_1_1",
    ),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    styling: poOpt<unknown>(ctx, "styling"),
  });
}

async function buildHyperflux(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  // Same shape as flux-dev.
  return buildFluxDev(opts, ctx);
}

async function buildSeedream4(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/seedream-4"),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToMagnific(opts.aspectRatio) ?? "square_1_1",
    ),
    guidance_scale: po(ctx, "guidance_scale", 2.5),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildSeedreamV45(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/seedream-v4.5"),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToMagnific(opts.aspectRatio) ?? "square_1_1",
    ),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    enable_safety_checker: po(ctx, "enable_safety_checker", true),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildSeedreamV45Edit(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  // Schema confirmed via live probe (2026-05-06):
  //   POST /v1/ai/text-to-image/seedream-v4-5-edit
  //   required: prompt, reference_images (array of base64, 1–5 items)
  //   optional: aspect_ratio, seed, enable_safety_checker, webhook_url
  const refsFromOpts = opts.files ?? [];
  const refsFromCtx = poOpt<string[]>(ctx, "reference_images");
  if (!refsFromCtx && refsFromOpts.length > 5) {
    throw new MagnificAPIError(
      "magnific/seedream-v4.5/edit accepts at most 5 reference images",
    );
  }
  const reference_images =
    refsFromCtx ??
    (await Promise.all(refsFromOpts.map((f) => toBase64(f, ctx.signal))));
  if (!reference_images.length) {
    throw new MagnificAPIError(
      "magnific/seedream-v4.5/edit requires at least one reference image (pass via files[] or providerOptions.magnific.reference_images)",
    );
  }
  if (reference_images.length > 5) {
    throw new MagnificAPIError(
      "magnific/seedream-v4.5/edit accepts at most 5 reference images",
    );
  }
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/seedream-v4.5/edit"),
    reference_images,
    aspect_ratio:
      poOpt<string>(ctx, "aspect_ratio") ??
      v3AspectRatioToMagnific(opts.aspectRatio),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    enable_safety_checker: poOpt<boolean>(ctx, "enable_safety_checker"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildZImageTurbo(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  // Schema not currently published; same passthrough policy as seedream edit.
  return prune({
    prompt: opts.prompt ?? poOpt<string>(ctx, "prompt"),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    aspect_ratio:
      poOpt<string>(ctx, "aspect_ratio") ??
      v3AspectRatioToMagnific(opts.aspectRatio),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildRunwayImage(
  opts: ImageModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/runway-image"),
    ratio: po(
      ctx,
      "ratio",
      v3AspectRatioToRunway(opts.aspectRatio) ?? "1024:1024",
    ),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

const IMAGE_BUILDERS: Record<string, ImageBuilder> = {
  "upscale-creative": buildUpscaleCreative,
  "upscale-precision": buildUpscalePrecision,
  relight: buildRelight,
  "style-transfer": buildStyleTransfer,
  "remove-bg": buildRemoveBg,
  expand: buildExpand,
  mystic: buildMystic,
  "flux-2-pro": buildFlux2Pro,
  "flux-2-turbo": buildFlux2Turbo,
  "flux-2-klein": buildFlux2Klein,
  "flux-pro-v1.1": buildFluxProV11,
  "flux-dev": buildFluxDev,
  hyperflux: buildHyperflux,
  "seedream-4": buildSeedream4,
  "seedream-v4.5": buildSeedreamV45,
  "seedream-v4.5/edit": buildSeedreamV45Edit,
  "z-image-turbo": buildZImageTurbo,
  "runway-image": buildRunwayImage,
};

// ---------------------------------------------------------------------------
// Video builders
// ---------------------------------------------------------------------------

async function buildKlingV21Pro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const image = opts.files?.[0]
    ? (poOpt<string>(ctx, "image") ??
      (await toBase64Or(opts.files[0], ctx.signal)))
    : poOpt<string>(ctx, "image");
  return prune({
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10"]),
    ),
    image,
    image_tail: poOpt<string>(ctx, "image_tail"),
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    negative_prompt: poOpt<string>(ctx, "negative_prompt"),
    cfg_scale: po(ctx, "cfg_scale", 0.5),
    static_mask: poOpt<string>(ctx, "static_mask"),
    dynamic_masks: poOpt<unknown[]>(ctx, "dynamic_masks"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildKlingV25Pro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const image = opts.files?.[0]
    ? (poOpt<string>(ctx, "image") ??
      (await toBase64Or(opts.files[0], ctx.signal)))
    : poOpt<string>(ctx, "image");
  return prune({
    image,
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    negative_prompt: poOpt<string>(ctx, "negative_prompt"),
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10"]),
    ),
    cfg_scale: po(ctx, "cfg_scale", 0.5),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildKlingV26Pro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const image = opts.files?.[0]
    ? (poOpt<string>(ctx, "image") ??
      (await toBase64Or(opts.files[0], ctx.signal)))
    : poOpt<string>(ctx, "image");
  return prune({
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    image,
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10"]),
    ),
    negative_prompt: poOpt<string>(ctx, "negative_prompt"),
    cfg_scale: po(ctx, "cfg_scale", 0.5),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToKlingV26(opts.aspectRatio) ?? "widescreen_16_9",
    ),
    generate_audio: poOpt<boolean>(ctx, "generate_audio"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildKlingMotionControl(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const imageFile = opts.files?.find((f) => isImageFile(f));
  const videoFile = opts.files?.find((f) => isVideoFile(f));
  const image_url =
    poOpt<string>(ctx, "image_url") ??
    (imageFile ? toUrl(imageFile) : undefined);
  const video_url =
    poOpt<string>(ctx, "video_url") ??
    (videoFile ? toUrl(videoFile) : undefined);
  if (!image_url || !video_url) {
    throw new MagnificAPIError(
      "magnific/kling-motion-control requires both an image (image_url) and a reference video (video_url)",
    );
  }
  return prune({
    image_url,
    video_url,
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    character_orientation: po(ctx, "character_orientation", "video"),
    cfg_scale: po(ctx, "cfg_scale", 0.5),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildKlingO1Pro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const inputs = opts.files ?? [];
  const first = inputs[0]
    ? (poOpt<string>(ctx, "first_frame") ??
      (await toBase64Or(inputs[0], ctx.signal)))
    : poOpt<string>(ctx, "first_frame");
  const last = inputs[1]
    ? (poOpt<string>(ctx, "last_frame") ??
      (await toBase64Or(inputs[1], ctx.signal)))
    : poOpt<string>(ctx, "last_frame");
  return prune({
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    first_frame: first,
    last_frame: last,
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToColon(opts.aspectRatio) ?? "16:9",
    ),
    duration: po(ctx, "duration", durationToInt(opts.duration, 5, [5, 10])),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildKlingV3Pro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const startInput = opts.files?.[0];
  const start_image_url = startInput
    ? (poOpt<string>(ctx, "start_image_url") ?? toUrl(startInput))
    : poOpt<string>(ctx, "start_image_url");
  return prune({
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    multi_prompt: poOpt<unknown[]>(ctx, "multi_prompt"),
    start_image_url,
    end_image_url: poOpt<string>(ctx, "end_image_url"),
    elements: poOpt<unknown[]>(ctx, "elements"),
    generate_audio: po(ctx, "generate_audio", true),
    multi_shot: po(ctx, "multi_shot", false),
    shot_type: po(ctx, "shot_type", "customize"),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToColon(opts.aspectRatio) ?? "16:9",
    ),
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, [
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
      ]),
    ),
    negative_prompt: po(
      ctx,
      "negative_prompt",
      "blur, distort, and low quality",
    ),
    cfg_scale: po(ctx, "cfg_scale", 0.5),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildMinimaxHailuo02(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const first = opts.files?.[0]
    ? (poOpt<string>(ctx, "first_frame_image") ??
      (await toBase64Or(opts.files[0], ctx.signal)))
    : poOpt<string>(ctx, "first_frame_image");
  const last = opts.files?.[1]
    ? (poOpt<string>(ctx, "last_frame_image") ??
      (await toBase64Or(opts.files[1], ctx.signal)))
    : poOpt<string>(ctx, "last_frame_image");
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/minimax-hailuo-02"),
    prompt_optimizer: po(ctx, "prompt_optimizer", true),
    first_frame_image: first,
    last_frame_image: last,
    duration: po(ctx, "duration", 6),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildMinimaxHailuo23(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  // Same shape as hailuo-02.
  return buildMinimaxHailuo02(opts, ctx);
}

async function buildMinimaxLive(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const image_url =
    poOpt<string>(ctx, "image_url") ?? (file ? toUrl(file) : undefined);
  if (!image_url) {
    throw new MagnificAPIError(
      "magnific/minimax-video-01-live requires a source image URL",
    );
  }
  return prune({
    image_url,
    prompt: requirePrompt(opts.prompt, "magnific/minimax-video-01-live"),
    prompt_optimizer: po(ctx, "prompt_optimizer", true),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildWan25T2V(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/wan-2.5-t2v"),
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10"]),
    ),
    negative_prompt: poOpt<string>(ctx, "negative_prompt"),
    enable_prompt_expansion: po(ctx, "enable_prompt_expansion", true),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildWan25I2V(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const image = poOpt<string>(ctx, "image") ?? (file ? toUrl(file) : undefined);
  if (!image) {
    throw new MagnificAPIError(
      "magnific/wan-2.5-i2v requires a keyframe image URL",
    );
  }
  return prune({
    image,
    prompt: requirePrompt(opts.prompt, "magnific/wan-2.5-i2v"),
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10"]),
    ),
    negative_prompt: poOpt<string>(ctx, "negative_prompt"),
    enable_prompt_expansion: po(ctx, "enable_prompt_expansion", true),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildWan26(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const image = poOpt<string>(ctx, "image") ?? (file ? toUrl(file) : undefined);
  if (!image) {
    throw new MagnificAPIError(
      "magnific/wan-2.6 requires a keyframe image URL",
    );
  }
  return prune({
    image,
    prompt: requirePrompt(opts.prompt, "magnific/wan-2.6"),
    size: po(ctx, "size", "1920*1080"),
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10", "15"]),
    ),
    negative_prompt: poOpt<string>(ctx, "negative_prompt"),
    enable_prompt_expansion: po(ctx, "enable_prompt_expansion", false),
    shot_type: po(ctx, "shot_type", "single"),
    seed: opts.seed ?? po(ctx, "seed", -1),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildRunwayGen4Turbo(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const image = file
    ? (poOpt<string>(ctx, "image") ?? (await toBase64Or(file, ctx.signal)))
    : poOpt<string>(ctx, "image");
  if (!image) {
    throw new MagnificAPIError(
      "magnific/runway-gen4-turbo requires a reference image",
    );
  }
  return prune({
    image,
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    duration: po(ctx, "duration", durationToInt(opts.duration, 10, [5, 10])),
    ratio: po(
      ctx,
      "ratio",
      v3AspectRatioToRunway(opts.aspectRatio) ?? "1280:720",
    ),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildRunwayActTwo(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const character = poOpt<{ type: string; uri: string }>(ctx, "character");
  const reference = poOpt<{ type: "video"; uri: string }>(ctx, "reference");
  // Fallback: derive from files when the user passes them positionally.
  const charFile = opts.files?.[0];
  const refFile = opts.files?.[1];
  const characterFinal =
    character ??
    (charFile
      ? {
          type: isVideoFile(charFile) ? "video" : "image",
          uri: toUrl(charFile),
        }
      : undefined);
  const referenceFinal =
    reference ?? (refFile ? { type: "video", uri: toUrl(refFile) } : undefined);
  if (!characterFinal || !referenceFinal) {
    throw new MagnificAPIError(
      "magnific/runway-act-two requires both `character` and `reference` (pass via providerOptions or as files[0]=character, files[1]=reference video)",
    );
  }
  return prune({
    character: characterFinal,
    reference: referenceFinal,
    body_control: po(ctx, "body_control", true),
    expression_intensity: po(ctx, "expression_intensity", 3),
    ratio: po(
      ctx,
      "ratio",
      v3AspectRatioToRunway(opts.aspectRatio) ?? "1280:720",
    ),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildLtx2Pro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/ltx-2-pro"),
    resolution: po(ctx, "resolution", "1080p"),
    duration: po(ctx, "duration", durationToInt(opts.duration, 6, [6, 8, 10])),
    fps: po(ctx, "fps", opts.fps ?? 25),
    generate_audio: po(ctx, "generate_audio", false),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildSeedancePro(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const image = file
    ? (poOpt<string>(ctx, "image") ?? (await toBase64Or(file, ctx.signal)))
    : poOpt<string>(ctx, "image");
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/seedance-pro"),
    image,
    duration: po(
      ctx,
      "duration",
      durationToString(opts.duration, 5, ["5", "10"]),
    ),
    camera_fixed: po(ctx, "camera_fixed", false),
    aspect_ratio: po(
      ctx,
      "aspect_ratio",
      v3AspectRatioToMagnificVideo(opts.aspectRatio) ?? "widescreen_16_9",
    ),
    frames_per_second: po(ctx, "frames_per_second", opts.fps ?? 24),
    seed: opts.seed ?? po(ctx, "seed", -1),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildPixverse(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const image_url =
    poOpt<string>(ctx, "image_url") ?? (file ? toUrl(file) : undefined);
  if (!image_url) {
    throw new MagnificAPIError("magnific/pixverse requires a source image URL");
  }
  return prune({
    image_url,
    prompt: requirePrompt(opts.prompt, "magnific/pixverse"),
    resolution: poOpt<string>(ctx, "resolution"),
    duration: po(ctx, "duration", durationToInt(opts.duration, 5, [5, 8])),
    negative_prompt: po(ctx, "negative_prompt", ""),
    style: poOpt<string>(ctx, "style"),
    seed: opts.seed ?? poOpt<number>(ctx, "seed"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildOmnihuman15(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const imageFile = opts.files?.find(isImageFile);
  const audioFile = opts.files?.find(isAudioFile);
  const image_url =
    poOpt<string>(ctx, "image_url") ??
    (imageFile ? toUrl(imageFile) : undefined);
  const audio_url =
    poOpt<string>(ctx, "audio_url") ??
    (audioFile ? toUrl(audioFile) : undefined);
  if (!image_url || !audio_url) {
    throw new MagnificAPIError(
      "magnific/omnihuman-v1.5 requires both an image URL and an audio URL",
    );
  }
  return prune({
    image_url,
    audio_url,
    prompt: opts.prompt || poOpt<string>(ctx, "prompt"),
    turbo_mode: po(ctx, "turbo_mode", false),
    resolution: po(ctx, "resolution", "1080p"),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

/**
 * VFX — apply 1 of 8 video filters.
 *
 * Heads-up: Magnific's VFX pipeline silently rejects some valid-looking MP4s
 * with `status: FAILED` and no error detail (verified live with Google's
 * `commondatastorage.googleapis.com/.../ForBiggerJoyrides.mp4` — fails with
 * both filter_type=1 and 2). Other public MP4s (e.g.
 * `download.samplelib.com/mp4/sample-5s.mp4`) work fine. If a VFX task fails
 * with no detail, it is almost always the source video, not the filter — try
 * a different MP4 / re-encode.
 */
async function buildVfx(
  opts: VideoModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const file = opts.files?.[0];
  const video = poOpt<string>(ctx, "video") ?? (file ? toUrl(file) : undefined);
  if (!video) {
    throw new MagnificAPIError("magnific/vfx requires a source video URL");
  }
  return prune({
    video,
    filter_type: po(ctx, "filter_type", 1),
    fps: po(ctx, "fps", opts.fps ?? 24),
    bloom_filter_contrast: poOpt<number>(ctx, "bloom_filter_contrast"),
    motion_filter_kernel_size: poOpt<number>(ctx, "motion_filter_kernel_size"),
    motion_filter_decay_factor: poOpt<number>(
      ctx,
      "motion_filter_decay_factor",
    ),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

const VIDEO_BUILDERS: Record<string, VideoBuilder> = {
  "kling-v2.1-pro": buildKlingV21Pro,
  "kling-v2.5-pro": buildKlingV25Pro,
  "kling-v2.6-pro": buildKlingV26Pro,
  "kling-motion-control": buildKlingMotionControl,
  "kling-o1-pro": buildKlingO1Pro,
  "kling-v3-pro": buildKlingV3Pro,
  "minimax-hailuo-02": buildMinimaxHailuo02,
  "minimax-hailuo-2.3": buildMinimaxHailuo23,
  "minimax-video-01-live": buildMinimaxLive,
  "wan-2.5-t2v": buildWan25T2V,
  "wan-2.5-i2v": buildWan25I2V,
  "wan-2.6": buildWan26,
  "runway-gen4-turbo": buildRunwayGen4Turbo,
  "runway-act-two": buildRunwayActTwo,
  "ltx-2-pro": buildLtx2Pro,
  "seedance-pro": buildSeedancePro,
  pixverse: buildPixverse,
  "omnihuman-v1.5": buildOmnihuman15,
  vfx: buildVfx,
};

// ---------------------------------------------------------------------------
// Music + Speech builders
// ---------------------------------------------------------------------------

async function buildMusic(
  opts: MusicModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const length =
    poOpt<number>(ctx, "music_length_seconds") ?? opts.duration ?? 30;
  return prune({
    prompt: requirePrompt(opts.prompt, "magnific/music"),
    music_length_seconds: length,
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

const MUSIC_BUILDERS: Record<string, MusicBuilder> = {
  default: buildMusic,
};

async function buildSoundEffects(
  opts: SpeechModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const text = opts.text ?? poOpt<string>(ctx, "text");
  if (!text) {
    throw new MagnificAPIError(
      "magnific/sound-effects requires `text` (the effect description)",
    );
  }
  const duration = poOpt<number>(ctx, "duration_seconds");
  if (duration === undefined) {
    throw new MagnificAPIError(
      "magnific/sound-effects requires `providerOptions.magnific.duration_seconds` (0.5–22)",
    );
  }
  return prune({
    text,
    duration_seconds: duration,
    loop: po(ctx, "loop", false),
    prompt_influence: po(ctx, "prompt_influence", 0.3),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

async function buildAudioIsolation(
  opts: SpeechModelV3CallOptions,
  ctx: BuilderCtx,
): Promise<Record<string, unknown>> {
  const description = poOpt<string>(ctx, "description") ?? opts.text;
  if (!description) {
    throw new MagnificAPIError(
      "magnific/audio-isolation requires a `description` (in providerOptions.magnific or as the speech model `text`)",
    );
  }
  const audio = poOpt<string>(ctx, "audio");
  const video = poOpt<string>(ctx, "video");
  if (!audio && !video) {
    throw new MagnificAPIError(
      "magnific/audio-isolation requires either `audio` or `video` (URL or base64)",
    );
  }
  if (audio && video) {
    throw new MagnificAPIError(
      "magnific/audio-isolation rejects both `audio` and `video` — provide exactly one",
    );
  }
  return prune({
    description,
    audio,
    video,
    x1: po(ctx, "x1", 0),
    y1: po(ctx, "y1", 0),
    x2: po(ctx, "x2", 0),
    y2: po(ctx, "y2", 0),
    sample_fps: po(ctx, "sample_fps", 2),
    reranking_candidates: po(ctx, "reranking_candidates", 1),
    predict_spans: po(ctx, "predict_spans", false),
    webhook_url: poOpt<string>(ctx, "webhook_url"),
  });
}

const SPEECH_BUILDERS: Record<string, SpeechBuilder> = {
  "sound-effects": buildSoundEffects,
  "audio-isolation": buildAudioIsolation,
};

// ---------------------------------------------------------------------------
// Per-modality direct entry points (called from VargXxxModel under BYOK)
// ---------------------------------------------------------------------------

interface DirectCallOptions {
  baseUrl?: string;
  signal?: AbortSignal;
}

interface DirectResult {
  data: Uint8Array;
  mediaType: string;
  url: string;
}

function extractMagnificProviderOpts(
  providerOptions:
    | Record<string, Record<string, unknown> | undefined>
    | undefined,
): Record<string, unknown> {
  // providerOptions is keyed by provider name; pull the magnific bucket if present.
  const bucket = (providerOptions?.magnific ?? {}) as Record<string, unknown>;
  // Strip apiKey before sending — never forward credentials in the body.
  const { apiKey: _apiKey, ...rest } = bucket;
  void _apiKey;
  return rest;
}

function assembleBody(
  explicit: Record<string, unknown>,
  providerOpts: Record<string, unknown>,
): Record<string, unknown> {
  // Passthrough first, explicit second — the builder's keys win for fields it
  // produced; unknown-to-builder keys flow through unchanged.
  return prune({ ...providerOpts, ...explicit });
}

export async function magnificDirectImage(
  leaf: string,
  apiKey: string,
  opts: ImageModelV3CallOptions,
  options: DirectCallOptions = {},
): Promise<DirectResult> {
  const path = IMAGE_MODELS[leaf];
  const builder = IMAGE_BUILDERS[leaf];
  if (!path || !builder) {
    throw new NoSuchModelError({
      modelId: `${MAGNIFIC_PREFIX}${leaf}`,
      modelType: "imageModel",
    });
  }
  const providerOpts = extractMagnificProviderOpts(opts.providerOptions);
  const explicit = await builder(opts, {
    providerOpts,
    signal: options.signal,
  });
  const body = assembleBody(explicit, providerOpts);
  const { urls } = await executeTask(apiKey, path, body, options);
  const url = urls[0]!;
  return {
    data: await downloadToBytes(url, options.signal),
    mediaType: inferMime(url),
    url,
  };
}

export async function magnificDirectVideo(
  leaf: string,
  apiKey: string,
  opts: VideoModelV3CallOptions,
  options: DirectCallOptions = {},
): Promise<DirectResult> {
  const path = VIDEO_MODELS[leaf];
  const builder = VIDEO_BUILDERS[leaf];
  if (!path || !builder) {
    throw new NoSuchModelError({
      modelId: `${MAGNIFIC_PREFIX}${leaf}`,
      modelType: "videoModel" as never,
    });
  }
  const providerOpts = extractMagnificProviderOpts(opts.providerOptions);
  const explicit = await builder(opts, {
    providerOpts,
    signal: options.signal,
  });
  const body = assembleBody(explicit, providerOpts);
  const { urls } = await executeTask(apiKey, path, body, options);
  const url = urls[0]!;
  return {
    data: await downloadToBytes(url, options.signal),
    mediaType: inferMime(url),
    url,
  };
}

export async function magnificDirectMusic(
  leaf: string,
  apiKey: string,
  opts: MusicModelV3CallOptions,
  options: DirectCallOptions = {},
): Promise<DirectResult> {
  const path = MUSIC_MODELS[leaf];
  const builder = MUSIC_BUILDERS[leaf];
  if (!path || !builder) {
    throw new NoSuchModelError({
      modelId: `${MAGNIFIC_PREFIX}${leaf}`,
      modelType: "musicModel" as never,
    });
  }
  const providerOpts = extractMagnificProviderOpts(opts.providerOptions);
  const explicit = await builder(opts, {
    providerOpts,
    signal: options.signal,
  });
  const body = assembleBody(explicit, providerOpts);
  const { urls } = await executeTask(apiKey, path, body, options);
  const url = urls[0]!;
  return {
    data: await downloadToBytes(url, options.signal),
    mediaType: inferMime(url),
    url,
  };
}

export async function magnificDirectSpeech(
  leaf: string,
  apiKey: string,
  opts: SpeechModelV3CallOptions,
  options: DirectCallOptions = {},
): Promise<DirectResult> {
  const path = SPEECH_MODELS[leaf];
  const builder = SPEECH_BUILDERS[leaf];
  if (!path || !builder) {
    throw new NoSuchModelError({
      modelId: `${MAGNIFIC_PREFIX}${leaf}`,
      modelType: "speechModel",
    });
  }
  const providerOpts = extractMagnificProviderOpts(opts.providerOptions);
  const explicit = await builder(opts, {
    providerOpts,
    signal: options.signal,
  });
  const body = assembleBody(explicit, providerOpts);
  const { urls } = await executeTask(apiKey, path, body, options);
  const url = urls[0]!;
  return {
    data: await downloadToBytes(url, options.signal),
    mediaType: inferMime(url),
    url,
  };
}

// ---------------------------------------------------------------------------
// Build helpers (size, aspect ratio, mime detection, duration)
// ---------------------------------------------------------------------------

function parseSize(
  size: ImageModelV3CallOptions["size"],
): { width: number; height: number } | null {
  if (!size) return null;
  const [w, h] = size.split("x");
  const width = Number.parseInt(w ?? "", 10);
  const height = Number.parseInt(h ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

function v3AspectRatioToMagnific(
  ratio: ImageModelV3CallOptions["aspectRatio"],
): string | null {
  if (!ratio) return null;
  const map: Record<string, string> = {
    "1:1": "square_1_1",
    "16:9": "widescreen_16_9",
    "9:16": "social_story_9_16",
    "2:3": "portrait_2_3",
    "3:4": "traditional_3_4",
    "1:2": "vertical_1_2",
    "2:1": "horizontal_2_1",
    "4:5": "social_post_4_5",
    "3:2": "standard_3_2",
    "4:3": "classic_4_3",
    "21:9": "cinematic_21_9",
  };
  return map[ratio] ?? null;
}

function v3AspectRatioToMagnificVideo(
  ratio: VideoModelV3CallOptions["aspectRatio"],
): string | null {
  if (!ratio) return null;
  const map: Record<string, string> = {
    "21:9": "film_horizontal_21_9",
    "16:9": "widescreen_16_9",
    "4:3": "classic_4_3",
    "1:1": "square_1_1",
    "3:4": "traditional_3_4",
    "9:16": "social_story_9_16",
    "9:21": "film_vertical_9_21",
  };
  return map[ratio] ?? null;
}

function v3AspectRatioToColon(
  ratio: VideoModelV3CallOptions["aspectRatio"],
): string | null {
  if (!ratio) return null;
  if (["16:9", "9:16", "1:1"].includes(ratio)) return ratio;
  return null;
}

function v3AspectRatioToKlingV26(
  ratio: VideoModelV3CallOptions["aspectRatio"],
): string | null {
  if (!ratio) return null;
  const map: Record<string, string> = {
    "16:9": "widescreen_16_9",
    "9:16": "social_story_9_16",
    "1:1": "square_1_1",
  };
  return map[ratio] ?? null;
}

function v3AspectRatioToRunway(
  ratio: VideoModelV3CallOptions["aspectRatio"],
): string | null {
  if (!ratio) return null;
  const map: Record<string, string> = {
    "16:9": "1280:720",
    "9:16": "720:1280",
    "1:1": "960:960",
    "4:3": "1440:1080",
    "3:4": "1080:1440",
  };
  return map[ratio] ?? null;
}

function durationToString(
  v: number | undefined,
  fallback: number,
  allowed: string[],
): string {
  const target = v ?? fallback;
  const targetStr = String(Math.round(target));
  return allowed.includes(targetStr)
    ? targetStr
    : (allowed[0] ?? String(fallback));
}

function durationToInt(
  v: number | undefined,
  fallback: number,
  allowed: number[],
): number {
  const target = v ?? fallback;
  return allowed.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev,
  );
}

function requirePrompt(prompt: string | undefined, modelId: string): string {
  if (!prompt) {
    throw new MagnificAPIError(`${modelId} requires a non-empty prompt`);
  }
  return prompt;
}

function isImageFile(file: ImageModelV3File): boolean {
  if (file.type === "url") {
    const url = file.url.toLowerCase();
    return /\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(url);
  }
  return file.mediaType.startsWith("image/");
}

function isVideoFile(file: ImageModelV3File): boolean {
  if (file.type === "url") {
    const url = file.url.toLowerCase();
    return /\.(mp4|mov|webm|m4v|avi)(\?|$)/.test(url);
  }
  return file.mediaType.startsWith("video/");
}

function isAudioFile(file: ImageModelV3File): boolean {
  if (file.type === "url") {
    const url = file.url.toLowerCase();
    return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/.test(url);
  }
  return file.mediaType.startsWith("audio/");
}

/**
 * Resolve a file to base64, or return its URL when the endpoint accepts both.
 * Used by builders whose docs say "URL or base64".
 */
async function toBase64Or(
  file: ImageModelV3File,
  signal?: AbortSignal,
): Promise<string> {
  if (file.type === "url") return file.url;
  return toBase64(file, signal);
}

// ---------------------------------------------------------------------------
// Public introspection helpers
// ---------------------------------------------------------------------------

export function listMagnificModels(): {
  image: string[];
  video: string[];
  music: string[];
  speech: string[];
} {
  const wrap = (m: Record<string, string>) =>
    Object.keys(m).map((k) => `${MAGNIFIC_PREFIX}${k}`);
  return {
    image: wrap(IMAGE_MODELS),
    video: wrap(VIDEO_MODELS),
    music: wrap(MUSIC_MODELS),
    speech: wrap(SPEECH_MODELS),
  };
}

/** Test-only: introspect the builder for a given namespaced id. */
export function _internal_buildBody(
  modelId: string,
  modality: "image" | "video" | "music" | "speech",
  // biome-ignore lint/suspicious/noExplicitAny: test introspection
  opts: any,
): Promise<Record<string, unknown>> {
  const leaf = parseMagnificModelId(modelId);
  if (!leaf) throw new Error(`not a magnific model: ${modelId}`);
  const providerOpts = extractMagnificProviderOpts(opts.providerOptions);
  const ctx: BuilderCtx = { providerOpts };
  switch (modality) {
    case "image": {
      const b = IMAGE_BUILDERS[leaf];
      if (!b) throw new Error(`unknown magnific image leaf: ${leaf}`);
      return b(opts, ctx).then((x) => assembleBody(x, providerOpts));
    }
    case "video": {
      const b = VIDEO_BUILDERS[leaf];
      if (!b) throw new Error(`unknown magnific video leaf: ${leaf}`);
      return b(opts, ctx).then((x) => assembleBody(x, providerOpts));
    }
    case "music": {
      const b = MUSIC_BUILDERS[leaf];
      if (!b) throw new Error(`unknown magnific music leaf: ${leaf}`);
      return b(opts, ctx).then((x) => assembleBody(x, providerOpts));
    }
    case "speech": {
      const b = SPEECH_BUILDERS[leaf];
      if (!b) throw new Error(`unknown magnific speech leaf: ${leaf}`);
      return b(opts, ctx).then((x) => assembleBody(x, providerOpts));
    }
  }
}
