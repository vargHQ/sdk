export interface CacheStorage {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface WithCacheOptions {
  ttl?: number | string;
  storage?: CacheStorage;
}

type CacheKeyDeps = (string | number | boolean | null | undefined)[];

type WithCacheKey<T> = T & { cacheKey?: CacheKeyDeps };

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

  const value = Number.parseInt(match[1]!, 10);
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

function depsToKey(deps: CacheKeyDeps): string {
  return deps.map((d) => String(d ?? "")).join(":");
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
const DEFAULT_TTL = "1h";

export function withCache<T extends object, R>(
  fn: (options: T) => Promise<R>,
  options: WithCacheOptions = {},
): CachedFn<T, R> {
  const storage = options.storage ?? defaultStorage;
  const ttl = parseTTL(options.ttl ?? DEFAULT_TTL);

  return async (opts: WithCacheKey<T>): Promise<R> => {
    const { cacheKey, ...rest } = opts;

    // no cacheKey = no caching, pass through
    if (!cacheKey) {
      return fn(rest as T);
    }

    const key = depsToKey(cacheKey);
    const cached = await storage.get(key);
    if (cached !== undefined) {
      return cached as R;
    }

    const result = await fn(rest as T);
    await storage.set(key, result, ttl);

    return result;
  };
}

export function clearCache(): void {
  memoryCache.clear();
}
