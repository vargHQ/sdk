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

function depsToKey(prefix: string, deps: CacheKeyDeps): string {
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
const DEFAULT_TTL = "1h";

export function withCache<T extends object, R>(
  fn: (options: T) => Promise<R>,
  options: WithCacheOptions = {},
): CachedFn<T, R> {
  const storage = options.storage ?? defaultStorage;
  const ttl = parseTTL(options.ttl ?? DEFAULT_TTL);
  const prefix = fn.name || "anonymous";

  return async (opts: WithCacheKey<T>): Promise<R> => {
    const { cacheKey, ...rest } = opts;

    if (!cacheKey) {
      return fn(rest as T);
    }

    const key = depsToKey(prefix, cacheKey);
    const cached = await storage.get(key);
    if (cached !== undefined) {
      return cached as R;
    }

    const result = await fn(rest as T);
    const flattened = flatten(result);
    await storage.set(key, flattened, ttl);

    return result;
  };
}

export function clearCache(): void {
  memoryCache.clear();
}
