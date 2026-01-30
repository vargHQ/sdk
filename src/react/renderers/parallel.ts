/**
 * Resilient parallel execution utilities.
 *
 * Unlike Promise.all which fails fast on first rejection,
 * these utilities ensure all successful results are preserved
 * even when some promises fail (e.g., timeout errors).
 */

export interface ParallelResult<T> {
  /** Successfully resolved values (in original order, undefined for failed) */
  results: (T | undefined)[];
  /** All successfully resolved values */
  successes: T[];
  /** Errors from failed promises with their indices */
  failures: Array<{ index: number; error: Error }>;
  /** Whether all promises succeeded */
  allSucceeded: boolean;
}

/**
 * Execute promises in parallel, preserving successful results even if some fail.
 *
 * @example
 * ```ts
 * const { results, failures, allSucceeded } = await allSettledWithResults(
 *   items.map(item => generateImage(item))
 * );
 *
 * // Use successful results
 * const images = results.filter(Boolean);
 *
 * // Report failures
 * if (failures.length > 0) {
 *   console.error(`${failures.length} generations failed`);
 * }
 * ```
 */
export async function allSettledWithResults<T>(
  promises: Promise<T>[],
): Promise<ParallelResult<T>> {
  const settled = await Promise.allSettled(promises);

  const results: (T | undefined)[] = [];
  const successes: T[] = [];
  const failures: Array<{ index: number; error: Error }> = [];

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    if (result.status === "fulfilled") {
      results.push(result.value);
      successes.push(result.value);
    } else {
      results.push(undefined);
      failures.push({
        index: i,
        error:
          result.reason instanceof Error
            ? result.reason
            : new Error(String(result.reason)),
      });
    }
  }

  return {
    results,
    successes,
    failures,
    allSucceeded: failures.length === 0,
  };
}

/**
 * Execute promises in parallel with automatic retry for failures.
 *
 * @param promises - Array of promise factories (functions that return promises)
 * @param options - Retry options
 */
export async function allSettledWithRetry<T>(
  promiseFactories: (() => Promise<T>)[],
  options: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (index: number, attempt: number, error: Error) => void;
  } = {},
): Promise<ParallelResult<T>> {
  const { maxRetries = 2, retryDelay = 1000, onRetry } = options;

  const firstAttempt = await allSettledWithResults(
    promiseFactories.map((factory) => factory()),
  );

  if (firstAttempt.allSucceeded || maxRetries === 0) {
    return firstAttempt;
  }

  const results = [...firstAttempt.results];
  const successes = [...firstAttempt.successes];
  let failures = [...firstAttempt.failures];

  for (
    let attempt = 1;
    attempt <= maxRetries && failures.length > 0;
    attempt++
  ) {
    await sleep(retryDelay);

    const retryIndices = failures.map((f) => f.index);
    const retryPromises = retryIndices.map((i) => promiseFactories[i]!());

    for (const { index } of failures) {
      onRetry?.(index, attempt, failures.find((f) => f.index === index)!.error);
    }

    const retryResults = await allSettledWithResults(retryPromises);

    const newFailures: Array<{ index: number; error: Error }> = [];

    for (let i = 0; i < retryIndices.length; i++) {
      const originalIndex = retryIndices[i]!;
      const retryResult = retryResults.results[i];

      if (retryResult !== undefined) {
        results[originalIndex] = retryResult;
        successes.push(retryResult);
      } else {
        newFailures.push({
          index: originalIndex,
          error: retryResults.failures.find((f) => f.index === i)!.error,
        });
      }
    }

    failures = newFailures;
  }

  return {
    results,
    successes,
    failures,
    allSucceeded: failures.length === 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Error thrown when some parallel operations fail but others succeed.
 * Contains the successful results so they can be used/cached.
 */
export class PartialFailureError<T> extends Error {
  constructor(
    message: string,
    public readonly successes: T[],
    public readonly failures: Array<{ index: number; error: Error }>,
    public readonly results: (T | undefined)[],
  ) {
    super(message);
    this.name = "PartialFailureError";
  }
}
