import type { LimitFunction } from "p-limit";

export interface CacheStorage {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface WithCacheOptions {
  ttl?: number | string;
  storage?: CacheStorage;
  /**
   * Optional concurrency limiter applied to the *underlying* call.
   *
   * Only cache MISSES consume a slot — a cache hit returns without
   * queueing, so a fully cached run never serializes on the limiter.
   * Used by the standalone resolve path (async components running during
   * `resolveLazy`, before `executePlan` and its `concurrency` cap exist)
   * to bound real API traffic. See sdk#225.
   */
  limit?: LimitFunction;
}

type CacheKeyDeps = (string | number | boolean | null | undefined)[];

type WithCacheKey<T> = Omit<T, "cacheKey" | "skipCacheWrite"> & {
  cacheKey?: CacheKeyDeps;
  skipCacheWrite?: boolean;
};

type CachedFn<T, R> = (options: WithCacheKey<T>) => Promise<R>;

const memoryCache = new Map<string, { value: unknown; expires: number }>();

const defaultStorage: CacheStorage = {
  async get(key: string) {
    const entry = memoryCache.get(key);
    if (!entry) return undefined;
    if (entry.expires && Date.now() > entry.expires) {
      memoryCache.delete(key);
      return undefined;
    }
    return entry.value;
  },
  async set(key: string, value: unknown, ttl?: number) {
    const expires = ttl ? Date.now() + ttl : 0;
    memoryCache.set(key, { value, expires });
  },
  async delete(key: string) {
    memoryCache.delete(key);
  },
};

function parseTTL(ttl: number | string | undefined): number | undefined {
  if (ttl === undefined) return undefined;
  if (typeof ttl === "number") return ttl;

  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return undefined;

  const value = Number.parseInt(match[1] ?? "0", 10);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return undefined;
  }
}

/** Build a cache key string from a prefix and an array of dependencies. */
export function depsToKey(prefix: string, deps: CacheKeyDeps): string {
  const depsStr = deps.map((d) => String(d ?? "")).join(":");
  return prefix ? `${prefix}:${depsStr}` : depsStr;
}

function flatten(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return value.map(flatten);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[key] = flatten(obj[key]);
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto && proto !== Object.prototype) {
      const descriptors = Object.getOwnPropertyDescriptors(proto);
      for (const [key, desc] of Object.entries(descriptors)) {
        if (desc.get && key !== "constructor") {
          result[key] = flatten(desc.get.call(obj));
        }
      }
    }
    return result;
  }
  return value;
}

/**
 * Wrap an async function to add caching via `cacheKey` option.
 *
 * @example
 * ```ts
 * import { generateImage } from "ai";
 * import { withCache } from "./cache";
 *
 * const generateImage_ = withCache(generateImage);
 *
 * const { images } = await generateImage_({
 *   model: fal.imageModel("flux-schnell"),
 *   prompt: "lion roaring",
 *   cacheKey: ["lion", take], // cache based on deps
 * });
 * ```
 */
/**
 * Cached entries do not expire unless the caller asks for a TTL.
 *
 * This used to default to `"7d"`, which is the wrong model for what is being
 * cached. Entries here are AI generations keyed by `cacheKey` — a hash of the
 * model plus every input. The key changes whenever the inputs change, so a
 * stale hit is impossible; there is nothing for expiry to protect against.
 * What expiry did instead was silently re-bill the user: a project rendered
 * eight days after its last run paid full price again for byte-identical
 * output (~$0.15/image, ~$0.15/second of video).
 *
 * Pass `ttl` explicitly to opt into expiry.
 */
export function withCache<T extends object, R>(
  fn: (options: T) => Promise<R>,
  options: WithCacheOptions = {},
): CachedFn<T, R> {
  const storage = options.storage ?? defaultStorage;
  const ttl = parseTTL(options.ttl);
  const prefix = fn.name || "anonymous";
  const limit = options.limit;
  // Only the real call is limited; cache lookups stay unbounded.
  const call = (input: T): Promise<R> =>
    limit ? limit(() => fn(input)) : fn(input);
  return async (opts: WithCacheKey<T>): Promise<R> => {
    const { cacheKey, skipCacheWrite, ...rest } = opts;

    if (!cacheKey) {
      return call(rest as T);
    }

    const key = depsToKey(prefix, cacheKey);
    const cached = await storage.get(key);
    if (cached !== undefined) {
      return cached as R;
    }
    const result = await call(rest as T);
    if (!skipCacheWrite) {
      const flattened = flatten(result);
      await storage.set(key, flattened, ttl);
    }

    return result;
  };
}

export function clearCache(): void {
  memoryCache.clear();
}
