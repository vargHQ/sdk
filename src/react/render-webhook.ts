import { createHmac } from "node:crypto";
import { isPrivateWebhookUrl } from "../studio/webhook-validate";
import type { File as VargFile } from "../ai-sdk/file";
import type {
  GenerationPricingEntry,
  RenderOptions,
  RenderResult,
} from "./types";

const WEBHOOK_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const HEADER_EVENT = "x-varg-event";
const HEADER_SIGNATURE = "x-varg-signature";
const HEADER_TIMESTAMP = "x-varg-timestamp";

export const WEBHOOK_EVENTS = {
  COMPLETED: "render.completed",
  FAILED: "render.failed",
} as const;

type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

interface CompletedPayload {
  event: typeof WEBHOOK_EVENTS.COMPLETED;
  timestamp: string;
  durationMs: number;
  output: {
    byteLength: number;
    outputPath?: string;
    videoUrl?: string;
  };
  files: ReturnType<VargFile["toJSON"]>[];
  generations: GenerationPricingEntry[];
  cost: { estimated: number; actual: number };
}

interface FailedPayload {
  event: typeof WEBHOOK_EVENTS.FAILED;
  timestamp: string;
  durationMs: number;
  error: { message: string; name?: string };
}

export type RenderWebhookPayload = CompletedPayload | FailedPayload;

interface RenderWebhookCoordinator {
  wrapOptions(opts: RenderOptions): RenderOptions;
  onComplete(result: RenderResult): Promise<void>;
  onError(err: unknown): Promise<void>;
}

const NOOP_COORDINATOR: RenderWebhookCoordinator = {
  wrapOptions: (o) => o,
  onComplete: async () => {},
  onError: async () => {},
};

/**
 * Returns a coordinator that wires webhook delivery into a render. When no
 * `webhookUrl` is set, returns a no-op so render.ts stays clean.
 */
export function createRenderWebhook(
  options: RenderOptions,
): RenderWebhookCoordinator {
  if (!options.webhookUrl) return NOOP_COORDINATOR;

  const startedAt = Date.now();
  const generations: GenerationPricingEntry[] = [];

  return {
    wrapOptions: (o) => ({
      ...o,
      onGeneration: (entry) => {
        generations.push(entry);
        o.onGeneration?.(entry);
      },
    }),
    async onComplete(result) {
      const videoUrl = await uploadVideo(result.video, options);
      await fireRenderWebhook(
        options,
        buildCompletedPayload({
          result,
          generations,
          startedAt,
          ...(videoUrl != null && { videoUrl }),
          ...(options.output != null && { outputPath: options.output }),
        }),
      );
    },
    async onError(err) {
      await fireRenderWebhook(options, buildFailedPayload({ err, startedAt }));
    },
  };
}

async function uploadVideo(
  video: Uint8Array,
  options: RenderOptions,
): Promise<string | undefined> {
  if (!options.storage) return undefined;
  try {
    return await options.storage.upload(
      video,
      `renders/${crypto.randomUUID()}.mp4`,
      "video/mp4",
    );
  } catch (err) {
    if (!options.quiet) {
      console.warn(`[webhook] storage upload failed: ${errorMessage(err)}`);
    }
    return undefined;
  }
}

export function buildCompletedPayload(input: {
  result: RenderResult;
  generations: GenerationPricingEntry[];
  startedAt: number;
  videoUrl?: string;
  outputPath?: string;
}): CompletedPayload {
  const { result, generations, startedAt, videoUrl, outputPath } = input;
  const cost = generations.reduce(
    (acc, g) => ({
      estimated: acc.estimated + (g.estimated ?? 0),
      actual: acc.actual + (g.actual ?? 0),
    }),
    { estimated: 0, actual: 0 },
  );

  return {
    event: WEBHOOK_EVENTS.COMPLETED,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    output: {
      byteLength: result.video.byteLength,
      ...(outputPath != null && { outputPath }),
      ...(videoUrl != null && { videoUrl }),
    },
    files: result.files.map((f) => f.toJSON()),
    generations,
    cost,
  };
}

export function buildFailedPayload(input: {
  err: unknown;
  startedAt: number;
}): FailedPayload {
  const { err, startedAt } = input;
  const name = err instanceof Error ? err.name : undefined;
  return {
    event: WEBHOOK_EVENTS.FAILED,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    error: { message: errorMessage(err), ...(name != null && { name }) },
  };
}

export async function fireRenderWebhook(
  opts: Pick<RenderOptions, "webhookUrl" | "webhookSecret" | "quiet">,
  payload: RenderWebhookPayload,
): Promise<void> {
  if (!opts.webhookUrl) return;
  if (isPrivateWebhookUrl(opts.webhookUrl)) {
    if (!opts.quiet) {
      console.warn(
        `[webhook] rejected private/non-HTTPS URL: ${opts.webhookUrl}`,
      );
    }
    return;
  }

  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [HEADER_EVENT]: payload.event satisfies WebhookEvent,
    [HEADER_TIMESTAMP]: timestamp,
  };
  if (opts.webhookSecret) {
    headers[HEADER_SIGNATURE] = createHmac("sha256", opts.webhookSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const res = await fetch(opts.webhookUrl, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (res.ok) return;
      lastError = new Error(`webhook responded ${res.status}`);
      if (!RETRYABLE_STATUS.has(res.status)) break;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < MAX_ATTEMPTS - 1) {
      const delay = BASE_DELAY_MS * 2 ** attempt;
      const jitter = delay * 0.3 * Math.random();
      await new Promise((r) => setTimeout(r, Math.round(delay + jitter)));
    }
  }

  if (!opts.quiet) {
    console.warn(
      `[webhook] delivery to ${opts.webhookUrl} failed: ${errorMessage(lastError)}`,
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
