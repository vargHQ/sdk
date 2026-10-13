/**
 * Krea provider (CLI / declarative side).
 *
 * Talks directly to api.krea.ai using the user's `KREA_API_KEY`. Plain fetch,
 * no vendor SDK. `model` is the path under `/generate/` (e.g.
 * "image/krea/krea-3") or a short alias ("krea", "krea-3").
 *
 * The AI-SDK side at `src/ai-sdk/providers/krea.ts` shares the HTTP shape but
 * has its own runtime to stay independent of `BaseProvider` and the global
 * registry.
 */

import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

const KREA_BASE_URL = "https://api.krea.ai";

/** Short ids → `/generate/` path. `krea` always tracks the latest Krea model. */
const KREA_ALIASES: Record<string, string> = {
  krea: "image/krea/krea-3",
  "krea-3": "image/krea/krea-3",
};

interface KreaJob {
  job_id?: string;
  status?: string;
  result?: {
    urls?: string[] | { type: string; url: string }[] | Record<string, string>;
  } | null;
  error?: { code?: string; message?: string } | null;
}

const STATUS_MAP: Record<string, JobStatusUpdate["status"]> = {
  backlogged: "queued",
  queued: "queued",
  scheduled: "queued",
  processing: "processing",
  sampling: "processing",
  "intermediate-complete": "processing",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
};

function urlsOf(job: KreaJob): string[] {
  const urls = job.result?.urls;
  if (!urls) return [];
  if (Array.isArray(urls)) {
    return urls.map((u) => (typeof u === "string" ? u : u.url));
  }
  return Object.values(urls);
}

export class KreaProvider extends BaseProvider {
  readonly name = "krea";
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: ProviderConfig) {
    super({
      timeout: 10 * 60 * 1000,
      ...config,
    });
    this.apiKey = config?.apiKey || process.env.KREA_API_KEY || "";
    this.baseUrl = (
      config?.baseUrl ||
      process.env.KREA_BASE_URL ||
      KREA_BASE_URL
    ).replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
  }

  /** Resolve an alias or raw path to the path under `/generate/`. */
  static resolvePath(model: string): string {
    const id = model.replace(/^krea\//, "");
    return (
      KREA_ALIASES[id] ?? id.replace(/^\/+/, "").replace(/^generate\//, "")
    );
  }

  async submit(
    model: string,
    inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error(
        "krea: missing KREA_API_KEY (set the env var or pass it to the provider config)",
      );
    }
    const path = KreaProvider.resolvePath(model);
    const body = { ...inputs };
    // Krea 3 needs resolution OR width+height (neither → the job fails).
    if (
      path === "image/krea/krea-3" &&
      body.resolution == null &&
      body.width == null &&
      body.height == null
    ) {
      body.resolution = "1k";
    }
    const response = await fetch(`${this.baseUrl}/generate/${path}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `krea submit ${path} failed (${response.status}): ${await response.text()}`,
      );
    }
    const job = (await response.json()) as KreaJob;
    if (!job.job_id) throw new Error(`krea ${path} response missing job_id`);
    console.log(`[krea] job submitted: ${job.job_id} (${path})`);
    return job.job_id;
  }

  private async fetchJob(jobId: string): Promise<KreaJob> {
    const response = await fetch(
      `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`,
      { headers: this.headers() },
    );
    if (!response.ok) {
      throw new Error(`krea poll ${jobId} failed (${response.status})`);
    }
    return (await response.json()) as KreaJob;
  }

  async getStatus(jobId: string): Promise<JobStatusUpdate> {
    const job = await this.fetchJob(jobId);
    const status = STATUS_MAP[job.status ?? ""] ?? "processing";
    return {
      status,
      output: status === "completed" ? { urls: urlsOf(job) } : undefined,
      error:
        status === "failed" || status === "cancelled"
          ? job.error?.message || job.error?.code || `krea job ${job.status}`
          : undefined,
    };
  }

  async getResult(jobId: string): Promise<unknown> {
    return { urls: urlsOf(await this.fetchJob(jobId)) };
  }

  override async cancel(jobId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/jobs/${encodeURIComponent(jobId)}`,
      { method: "DELETE", headers: this.headers() },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`krea cancel ${jobId} failed (${response.status})`);
    }
  }

  /** Submit + wait. Returns the output URL list. */
  async runAndWait(
    model: string,
    inputs: Record<string, unknown>,
  ): Promise<string[]> {
    const jobId = await this.submit(model, inputs);
    const result = (await this.waitForCompletion(jobId, {
      pollInterval: 2000,
    })) as { urls?: string[] } | undefined;
    return result?.urls ?? [];
  }

  /** Generate an image with Krea (default: latest Krea model). */
  async generateImage(args: {
    prompt: string;
    model?: string;
    imageUrls?: string[];
    aspectRatio?: string;
    resolution?: "1k" | "2k";
    thinkingMode?: "fast" | "high" | "ultra";
    seed?: number;
    negativePrompt?: string;
  }): Promise<{ url: string }> {
    const urls = await this.runAndWait(args.model ?? "krea", {
      prompt: args.prompt,
      ...(args.imageUrls?.length ? { image_urls: args.imageUrls } : {}),
      ...(args.aspectRatio ? { aspect_ratio: args.aspectRatio } : {}),
      ...(args.resolution ? { resolution: args.resolution } : {}),
      ...(args.thinkingMode ? { thinking_mode: args.thinkingMode } : {}),
      ...(args.seed != null ? { seed: args.seed } : {}),
      ...(args.negativePrompt ? { negative_prompt: args.negativePrompt } : {}),
    });
    const url = urls[0];
    if (!url) throw new Error("krea completed but returned no output URL");
    return { url };
  }
}

export const kreaProvider = new KreaProvider();

export const kreaGenerateImage = (
  args: Parameters<KreaProvider["generateImage"]>[0],
) => kreaProvider.generateImage(args);
