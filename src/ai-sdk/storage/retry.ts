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

/** HTTP status codes that indicate a retryable error */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 503]);

function isRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const err = error as {
    message?: string;
    name?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };

  // Check AWS SDK v3 $metadata.httpStatusCode
  const statusCode = err.$metadata?.httpStatusCode;
  if (statusCode !== undefined && RETRYABLE_STATUS_CODES.has(statusCode)) {
    return true;
  }

  // Check error.name, error.code, and error.message against known patterns
  const haystack = [err.message, err.name, err.code].filter(Boolean).join(" ");
  return RETRYABLE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

export interface RetryOptions {
  /** Maximum number of retries after the initial attempt (default: 5) */
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

  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error("retry option `maxRetries` must be a non-negative integer");
  }
  if (!Number.isFinite(baseDelay) || baseDelay < 0) {
    throw new Error("retry option `baseDelay` must be a non-negative number");
  }

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
