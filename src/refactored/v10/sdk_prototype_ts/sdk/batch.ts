/**
 * Batch processing utilities
 */

// Semaphore for concurrency control
class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }

  release(): void {
    const next = this.queue.shift()
    if (next) next()
    else this.permits++
  }
}

// Batch result type
export interface BatchResult<T> {
  results: T[]
  errors: Array<{ index: number; error: string }>
}

/**
 * Process items in batches with rate limiting.
 *
 * @example
 * ```ts
 * const results = await batch(
 *   characters,
 *   async (char) => generateImage({ model, prompt: char.prompt }),
 *   { batchSize: 3, delayBetweenBatches: 5000 }
 * )
 * ```
 */
export async function batch<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: {
    batchSize?: number
    delayBetweenBatches?: number
    onProgress?: (done: number, total: number) => void
  } = {}
): Promise<BatchResult<R>> {
  const { batchSize = 5, delayBetweenBatches = 2000, onProgress } = options
  const results: R[] = []
  const errors: Array<{ index: number; error: string }> = []

  for (let i = 0; i < items.length; i += batchSize) {
    const batchItems = items.slice(i, i + batchSize)

    const batchResults = await Promise.allSettled(
      batchItems.map((item, j) => fn(item, i + j))
    )

    batchResults.forEach((result, j) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        errors.push({ index: i + j, error: result.reason?.message ?? 'Unknown error' })
      }
      onProgress?.(results.length + errors.length, items.length)
    })

    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await delay(delayBetweenBatches)
    }
  }

  return { results, errors }
}

/**
 * Process items in parallel with concurrency limit.
 *
 * @example
 * ```ts
 * const results = await parallel(
 *   urls,
 *   async (url) => fetch(url).then(r => r.json()),
 *   { maxConcurrent: 5 }
 * )
 * ```
 */
export async function parallel<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: {
    maxConcurrent?: number
    onProgress?: (done: number, total: number) => void
  } = {}
): Promise<BatchResult<R>> {
  const { maxConcurrent = 8, onProgress } = options
  const semaphore = new Semaphore(maxConcurrent)
  const indexed: Array<{ index: number; result?: R; error?: string }> = []
  let done = 0

  await Promise.all(
    items.map(async (item, index) => {
      await semaphore.acquire()
      try {
        const result = await fn(item, index)
        indexed.push({ index, result })
      } catch (e) {
        indexed.push({ index, error: (e as Error).message })
      } finally {
        semaphore.release()
        done++
        onProgress?.(done, items.length)
      }
    })
  )

  indexed.sort((a, b) => a.index - b.index)

  return {
    results: indexed.filter((r) => r.result !== undefined).map((r) => r.result!),
    errors: indexed
      .filter((r) => r.error !== undefined)
      .map((r) => ({ index: r.index, error: r.error! })),
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
