export interface CacheOptions<T extends unknown[] = unknown[]> {
  key: string | ((...args: T) => string);
  ttl?: number | string;
  storage?: CacheStorage;
}

export interface CacheStorage {
  get(key: string): Promise<unknown | undefined>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

type AsyncFn<T extends unknown[], R> = (...args: T) => Promise<R>;

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

export function withCache<T extends unknown[], R>(
  fn: AsyncFn<T, R>,
  options: CacheOptions<T>,
): AsyncFn<T, R> {
  const storage = options.storage ?? defaultStorage;
  const ttl = parseTTL(options.ttl);

  return async (...args: T): Promise<R> => {
    const cacheKey =
      typeof options.key === "function" ? options.key(...args) : options.key;

    const cached = await storage.get(cacheKey);
    if (cached !== undefined) {
      return cached as R;
    }

    const result = await fn(...args);
    await storage.set(cacheKey, result, ttl);

    return result;
  };
}

export function clearCache(): void {
  memoryCache.clear();
}
