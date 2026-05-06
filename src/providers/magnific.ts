/**
 * Magnific provider (CLI / declarative side).
 *
 * Talks directly to api.magnific.com using the user's `MAGNIFIC_API_KEY`. Used
 * by `src/definitions/actions/{upscale,relight,restyle,remove-bg,expand,sfx,
 * isolate-audio,vfx}.ts` and the Magnific entries on `image`/`video`/`music`/
 * `sync` actions.
 *
 * The AI-SDK side at `src/ai-sdk/providers/magnific.ts` shares the same
 * concepts (HTTP shape, capability paths, polling) but has its own runtime to
 * stay independent of `BaseProvider` and the global registry.
 */

import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

const MAGNIFIC_BASE_URL = "https://api.magnific.com/v1";

interface MagnificTaskResponse {
  task_id?: string;
  status?: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  generated?: string[];
  has_nsfw?: boolean[];
  error?: string | { message?: string };
  message?: string;
  data?: MagnificTaskResponse;
}

const SYNCHRONOUS_PATHS = new Set<string>(["ai/beta/remove-background"]);

const FORM_ENCODED_PATHS = new Set<string>(["ai/beta/remove-background"]);

const POLL_PATH_OVERRIDES: Record<string, string> = {
  "ai/image-to-video/kling-v2-1-pro": "ai/image-to-video/kling-v2-1",
  "ai/image-to-video/kling-v2-6-pro": "ai/image-to-video/kling-v2-6",
  "ai/image-to-video/kling-o1-pro": "ai/image-to-video/kling-o1",
  "ai/video/kling-v3-pro": "ai/video/kling-v3",
};

function unwrap(payload: unknown): MagnificTaskResponse {
  if (payload && typeof payload === "object") {
    const obj = payload as MagnificTaskResponse;
    if (obj.data && typeof obj.data === "object") return obj.data;
    return obj;
  }
  return {};
}

export class MagnificProvider extends BaseProvider {
  readonly name = "magnific";
  private apiKey: string;
  private baseUrl: string;
  /**
   * Map of task_id → capability path. Polling needs the path to construct
   * the GET URL (mirrors fal.ts's `jobModels` trick).
   */
  private taskCapabilities = new Map<string, string>();
  /** task_id → generated[] when an endpoint completed synchronously on submit. */
  private syncResults = new Map<string, string[]>();

  constructor(config?: ProviderConfig) {
    super({
      timeout: 30 * 60 * 1000, // 30 min — video can be slow
      ...config,
    });
    this.apiKey = config?.apiKey || process.env.MAGNIFIC_API_KEY || "";
    this.baseUrl = config?.baseUrl || MAGNIFIC_BASE_URL;
  }

  private headers(): Record<string, string> {
    return {
      "x-magnific-api-key": this.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /**
   * Submit a task. `model` is the capability path (e.g. "ai/image-upscaler").
   * For synchronous endpoints (remove-bg) the result is captured immediately
   * and `getStatus`/`getResult` return it without another network round-trip.
   */
  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "magnific: missing MAGNIFIC_API_KEY (set the env var or pass it to the provider config)",
      );
    }
    const path = model.startsWith("ai/") ? model : `ai/${model}`;
    const url = `${this.baseUrl}/${path}`;
    const isForm = FORM_ENCODED_PATHS.has(path);
    const headers: Record<string, string> = {
      "x-magnific-api-key": this.apiKey,
      Accept: "application/json",
      "Content-Type": isForm
        ? "application/x-www-form-urlencoded"
        : "application/json",
    };
    const body = isForm
      ? new URLSearchParams(
          Object.fromEntries(
            Object.entries(inputs).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()
      : JSON.stringify(inputs);
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `magnific submit ${path} failed (${response.status}): ${text}`,
      );
    }
    const data = unwrap(await response.json());

    // Synchronous endpoint or cache hit
    if (
      SYNCHRONOUS_PATHS.has(path) ||
      (data.status === "COMPLETED" && data.generated?.length)
    ) {
      const taskId = data.task_id ?? crypto.randomUUID();
      this.taskCapabilities.set(taskId, path);
      this.syncResults.set(taskId, data.generated ?? []);
      return taskId;
    }

    if (!data.task_id) {
      throw new Error(`magnific ${path} response missing task_id`);
    }
    this.taskCapabilities.set(data.task_id, path);
    return data.task_id;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    if (this.syncResults.has(jobId)) {
      return {
        status: "completed",
        output: { generated: this.syncResults.get(jobId) },
      };
    }
    const path = this.taskCapabilities.get(jobId);
    if (!path) {
      throw new Error(`magnific: unknown task id ${jobId}`);
    }
    const pollPath = POLL_PATH_OVERRIDES[path] ?? path;
    const url = `${this.baseUrl}/${pollPath}/${jobId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`magnific poll ${jobId} failed (${response.status})`);
    }
    const data = unwrap(await response.json());
    const statusMap: Record<string, JobStatusUpdate["status"]> = {
      CREATED: "queued",
      IN_PROGRESS: "processing",
      COMPLETED: "completed",
      FAILED: "failed",
    };
    const rawErr =
      typeof data.error === "string" ? data.error : data.error?.message;
    // See src/ai-sdk/providers/magnific.ts — Magnific often returns FAILED
    // with no detail; make that actionable for the user.
    const friendlyErr =
      data.status === "FAILED" && (!rawErr || rawErr === "unknown")
        ? `magnific ${path} failed with no error detail. This commonly indicates an input incompatibility (unsupported video codec/resolution, image too small for the endpoint, or unsupported format). Try a different input.`
        : rawErr;
    return {
      status: statusMap[data.status ?? ""] ?? "processing",
      output: { generated: data.generated, has_nsfw: data.has_nsfw },
      error: friendlyErr,
    };
  }

  async getResult(jobId: string): Promise<unknown> {
    if (this.syncResults.has(jobId)) {
      const generated = this.syncResults.get(jobId);
      this.taskCapabilities.delete(jobId);
      this.syncResults.delete(jobId);
      return { generated };
    }
    const status = await this.getStatus(jobId);
    this.taskCapabilities.delete(jobId);
    this.syncResults.delete(jobId);
    return status.output;
  }

  /**
   * Submit + wait for completion. Returns the raw `generated[]` URL list.
   */
  async runAndWait(
    capabilityPath: string,
    inputs: Record<string, unknown>,
    options: { maxWait?: number; pollInterval?: number } = {},
  ): Promise<string[]> {
    const jobId = await this.submit(capabilityPath, inputs);
    const result = (await this.waitForCompletion(jobId, {
      maxWait: options.maxWait ?? this.config.timeout ?? 30 * 60 * 1000,
      pollInterval: options.pollInterval ?? 5000,
    })) as { generated?: string[] } | undefined;
    return result?.generated ?? [];
  }

  // -------------------------------------------------------------------------
  // High-level convenience methods (one per unique-to-magnific capability)
  // -------------------------------------------------------------------------

  upscaleCreative(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/image-upscaler", args);
  }
  upscalePrecision(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/image-upscaler-precision", args);
  }
  relight(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/image-relight", args);
  }
  styleTransfer(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/image-style-transfer", args);
  }
  removeBackground(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/beta/remove-background", args);
  }
  expand(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/image-expand/flux-pro", args);
  }
  mystic(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/mystic", args);
  }
  music(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/music-generation", args);
  }
  soundEffects(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/sound-effects", args);
  }
  audioIsolation(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/audio-isolation", args);
  }
  vfx(args: Record<string, unknown>): Promise<{ url: string }> {
    return this.runAndFirst("ai/video/vfx", args);
  }

  /** Generic helper for any image model. */
  async runImage(
    capabilityPath: string,
    args: Record<string, unknown>,
  ): Promise<{ url: string }> {
    return this.runAndFirst(capabilityPath, args);
  }

  private async runAndFirst(
    capabilityPath: string,
    inputs: Record<string, unknown>,
  ): Promise<{ url: string }> {
    const urls = await this.runAndWait(capabilityPath, inputs);
    const url = urls[0];
    if (!url) {
      throw new Error(`magnific ${capabilityPath} completed but no output URL`);
    }
    return { url };
  }
}

export const magnificProvider = new MagnificProvider();

// Convenience re-exports (mirror fal.ts:832-861 style)
export const magnificUpscaleCreative = (args: Record<string, unknown>) =>
  magnificProvider.upscaleCreative(args);
export const magnificUpscalePrecision = (args: Record<string, unknown>) =>
  magnificProvider.upscalePrecision(args);
export const magnificRelight = (args: Record<string, unknown>) =>
  magnificProvider.relight(args);
export const magnificStyleTransfer = (args: Record<string, unknown>) =>
  magnificProvider.styleTransfer(args);
export const magnificRemoveBackground = (args: Record<string, unknown>) =>
  magnificProvider.removeBackground(args);
export const magnificExpand = (args: Record<string, unknown>) =>
  magnificProvider.expand(args);
export const magnificMystic = (args: Record<string, unknown>) =>
  magnificProvider.mystic(args);
export const magnificMusic = (args: Record<string, unknown>) =>
  magnificProvider.music(args);
export const magnificSoundEffects = (args: Record<string, unknown>) =>
  magnificProvider.soundEffects(args);
export const magnificAudioIsolation = (args: Record<string, unknown>) =>
  magnificProvider.audioIsolation(args);
export const magnificVfx = (args: Record<string, unknown>) =>
  magnificProvider.vfx(args);
