import pLimit from "p-limit";

/**
 * Global concurrency limiter for R2/S3 uploads.
 * Caps concurrent uploads to avoid Cloudflare R2 rate limits
 * ("Reduce your concurrent request rate for the same object").
 */
export const r2UploadLimiter = pLimit(10);

/** Errors that indicate R2/S3 rate limiting or transient failures worth retrying */
const RETRYABLE_PATTERNS = [
  "concurrent request rate",
  "SlowDown",
  "ServiceUnavailable",
  "TooManyRequests",
  "RequestTimeout",
  "InternalError",
  "ECONNRESET",
  "ETIMEDOUT",
  "socket hang up",
];

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Initial backoff delay in ms (default: 500) */
  baseDelay?: number;
}

/**
 * Retry an R2/S3 upload with exponential backoff + jitter.
 * Only retries on known transient/rate-limit errors.
 *
 * Backoff schedule (default): 500ms, 1s, 2s, 4s, 8s (+ random jitter up to 30%)
 */
export async function retryR2Upload<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? 5;
  const baseDelay = opts?.baseDelay ?? 500;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      const delay = baseDelay * 2 ** attempt;
      const jitter = delay * 0.3 * Math.random();
      const totalDelay = Math.round(delay + jitter);

      console.warn(
        `[r2-upload] attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${totalDelay}ms: ${error instanceof Error ? error.message : String(error)}`,
      );

      await new Promise((resolve) => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError;
}

/**
 * Convenience: run an R2 upload through both the concurrency limiter and retry logic.
 */
export function limitedRetryUpload<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions,
): Promise<T> {
  return r2UploadLimiter(() => retryR2Upload(fn, opts));
}
