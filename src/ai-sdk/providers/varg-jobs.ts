/**
 * Blocking wait for a varg API job (`GET /v2/jobs/:id`).
 *
 * Uses the API's long-poll: `GET /v2/jobs/:id?wait=<1..60>` blocks until the
 * job is terminal or the wait elapses, then returns the normal job JSON
 * (headers `X-Varg-Wait: <elapsed_ms>`, `X-Varg-Wait-Timeout: 1` on timeout).
 *
 * A server that ignores `wait` answers immediately. When a non-terminal answer
 * comes back well under the requested wait, the loop falls back to client-side
 * polling with backoff (2s, growing to a 10s cap), so it never hot-loops.
 * Transient failures (network, 408, 429, 5xx) are retried with backoff;
 * 401/403/404 and other 4xx fail fast.
 */

/** Public /v2 job shape (api: routes/varg_jobs/common.ts serializeVargJob).
 *  Only the fields the SDK reads are typed; the rest pass through. */
export interface VargJob {
  id: string;
  /** queued | running | awaiting_confirmation | completed | failed | cancelled */
  status: string;
  /** What a live job is doing (queued, submitting, rendering, …); null once terminal. */
  stage?: string | null;
  output?: {
    version: "v1";
    outputs: Array<{
      url?: string;
      media_type?: string;
      size_bytes?: number;
      data?: unknown;
      [key: string]: unknown;
    }>;
  } | null;
  error?: string | null;
  progress_message?: string | null;
  progress?: number | null;
  [key: string]: unknown;
}

/** Statuses that never change (api: src/states.ts TERMINAL_JOB_STATUSES). */
export const TERMINAL_JOB_STATUSES = ["completed", "failed", "cancelled"];

/** A multi-step job paused for `POST /v2/jobs/:id/confirm`. Not terminal, but
 *  it will not move on its own, so waiting on it is pointless. */
export const AWAITING_CONFIRMATION_STATUS = "awaiting_confirmation";

export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export type VargJobWaitErrorReason =
  | "timeout" // overall timeout elapsed before the job finished
  | "auth" // 401 / 403
  | "not_found" // 404
  | "http" // other 4xx, or 5xx after retries were exhausted
  | "network"; // network errors after retries were exhausted

export class VargJobWaitError extends Error {
  constructor(
    message: string,
    public readonly reason: VargJobWaitErrorReason,
    public readonly statusCode?: number,
    /** Last job state seen before the error, if any. */
    public readonly job?: VargJob,
  ) {
    super(message);
    this.name = "VargJobWaitError";
  }
}

export interface WaitForJobOptions {
  /** API base URL including the version, e.g. `https://api.varg.ai/v2`. */
  baseUrl: string;
  apiKey: string;
  /** Overall timeout. Default 30 minutes. */
  timeoutMs?: number;
  /** Aborts the wait; the promise rejects with the signal's reason. */
  signal?: AbortSignal;
  /** Called with the first job state and whenever status, stage or progress changes. */
  onStatus?: (job: VargJob) => void;
  /** Return (instead of waiting) when the job pauses in `awaiting_confirmation`. Default true. */
  returnOnAwaitingConfirmation?: boolean;
  /** Long-poll window per request, seconds (1..60). Default 55. */
  waitSeconds?: number;
  /** Consecutive transient failures tolerated before giving up. Default 8. */
  maxConsecutiveErrors?: number;
  /** Test hooks. */
  fetch?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_WAIT_SECONDS = 55;
/** Fallback (server ignores `wait`) poll interval: start, growth, cap. */
const POLL_BACKOFF_START_MS = 2_000;
const POLL_BACKOFF_FACTOR = 1.5;
const POLL_BACKOFF_CAP_MS = 10_000;
/** Transient-error retry delay: start, cap (doubles each failure). */
const ERROR_BACKOFF_START_MS = 1_000;
const ERROR_BACKOFF_CAP_MS = 30_000;
/** Client-side request timeout on top of the long-poll window. */
const REQUEST_GRACE_MS = 20_000;

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function errorMessageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const err = (body as { error?: unknown; message?: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const m = (err as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function progressKey(job: VargJob): string {
  return JSON.stringify([
    job.status,
    job.stage ?? null,
    job.progress_message ?? null,
    job.progress ?? null,
  ]);
}

/**
 * Block until the job reaches a terminal status (completed / failed /
 * cancelled) — or `awaiting_confirmation`, unless disabled — and return it.
 * A failed or cancelled job is returned, not thrown: inspect `job.status`.
 *
 * Throws `VargJobWaitError` on overall timeout (`reason: "timeout"`, with the
 * last seen `job`), on 401/403/404/4xx, and when transient errors persist.
 */
export async function waitForJob(
  jobId: string,
  options: WaitForJobOptions,
): Promise<VargJob> {
  const {
    apiKey,
    signal,
    onStatus,
    returnOnAwaitingConfirmation = true,
    maxConsecutiveErrors = 8,
  } = options;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxWaitSeconds = Math.min(
    60,
    Math.max(1, Math.floor(options.waitSeconds ?? DEFAULT_WAIT_SECONDS)),
  );
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;

  const deadline = now() + timeoutMs;
  const url = `${baseUrl}/jobs/${encodeURIComponent(jobId)}`;

  let lastJob: VargJob | undefined;
  let lastKey: string | undefined;
  let pollDelayMs = POLL_BACKOFF_START_MS;
  let errorDelayMs = ERROR_BACKOFF_START_MS;
  let consecutiveErrors = 0;

  const timeoutError = () =>
    new VargJobWaitError(
      `job ${jobId} did not finish within ${Math.round(timeoutMs / 1000)}s` +
        (lastJob ? ` (last status: ${lastJob.status})` : ""),
      "timeout",
      undefined,
      lastJob,
    );

  /** Sleep up to `ms`, never past the deadline. */
  const pause = async (ms: number) => {
    const remaining = deadline - now();
    if (remaining <= 0) throw timeoutError();
    await sleep(Math.min(ms, remaining), signal);
  };

  /** Count a transient failure; throw once they persist, else back off. */
  const transient = async (err: VargJobWaitError) => {
    consecutiveErrors++;
    if (consecutiveErrors >= maxConsecutiveErrors) throw err;
    await pause(errorDelayMs);
    errorDelayMs = Math.min(ERROR_BACKOFF_CAP_MS, errorDelayMs * 2);
  };

  for (;;) {
    signal?.throwIfAborted();
    const remaining = deadline - now();
    if (remaining <= 0) throw timeoutError();

    const waitSeconds = Math.max(
      1,
      Math.min(maxWaitSeconds, Math.ceil(remaining / 1000)),
    );
    const requestTimeout = AbortSignal.timeout(
      waitSeconds * 1000 + REQUEST_GRACE_MS,
    );
    const requestSignal = signal
      ? AbortSignal.any([signal, requestTimeout])
      : requestTimeout;

    const startedAt = now();
    let res: Response;
    try {
      res = await fetchImpl(`${url}?wait=${waitSeconds}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: requestSignal,
      });
    } catch (err) {
      if (signal?.aborted) throw signal.reason;
      const msg = err instanceof Error ? err.message : String(err);
      await transient(
        new VargJobWaitError(
          `network error polling job ${jobId}: ${msg}`,
          "network",
          undefined,
          lastJob,
        ),
      );
      continue;
    }
    const elapsedMs = now() - startedAt;

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const msg = errorMessageFrom(
        body,
        `varg api returned ${res.status} for job ${jobId}`,
      );
      if (isTransientStatus(res.status)) {
        const err = new VargJobWaitError(msg, "http", res.status, lastJob);
        const retryAfter = Number(res.headers.get("retry-after"));
        if (
          res.status === 429 &&
          Number.isFinite(retryAfter) &&
          retryAfter > 0
        ) {
          errorDelayMs = Math.max(
            errorDelayMs,
            Math.min(ERROR_BACKOFF_CAP_MS, retryAfter * 1000),
          );
        }
        await transient(err);
        continue;
      }
      const reason: VargJobWaitErrorReason =
        res.status === 401 || res.status === 403
          ? "auth"
          : res.status === 404
            ? "not_found"
            : "http";
      throw new VargJobWaitError(msg, reason, res.status, lastJob);
    }

    let job: VargJob;
    try {
      job = (await res.json()) as VargJob;
      if (!job || typeof job.status !== "string") {
        throw new Error("response has no status");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await transient(
        new VargJobWaitError(
          `unreadable job response for ${jobId}: ${msg}`,
          "http",
          res.status,
          lastJob,
        ),
      );
      continue;
    }

    consecutiveErrors = 0;
    errorDelayMs = ERROR_BACKOFF_START_MS;

    const prevJob = lastJob;
    lastJob = job;
    const key = progressKey(job);
    if (key !== lastKey) {
      lastKey = key;
      onStatus?.(job);
    }

    if (isTerminalJobStatus(job.status)) return job;
    if (
      returnOnAwaitingConfirmation &&
      job.status === AWAITING_CONFIRMATION_STATUS
    ) {
      return job;
    }

    // Did the server actually hold the request? An old server ignores `wait`
    // and answers at once — then poll client-side with backoff. A long-poll
    // server may also return early on a status/stage change; re-poll at once.
    const heldRequest = elapsedMs >= (waitSeconds * 1000) / 2;
    const supportsWait = res.headers.has("x-varg-wait");
    const stateChanged =
      !prevJob ||
      prevJob.status !== job.status ||
      (prevJob.stage ?? null) !== (job.stage ?? null);
    if (heldRequest || (supportsWait && stateChanged)) {
      pollDelayMs = POLL_BACKOFF_START_MS;
      continue;
    }
    await pause(pollDelayMs);
    pollDelayMs = Math.min(
      POLL_BACKOFF_CAP_MS,
      Math.round(pollDelayMs * POLL_BACKOFF_FACTOR),
    );
  }
}
