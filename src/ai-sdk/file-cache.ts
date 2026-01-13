import type { CacheStorage } from "./cache";

interface CacheEntry {
  value: unknown;
  expires: number;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val instanceof Uint8Array) {
      return {
        __type: "Uint8Array",
        data: Buffer.from(val).toString("base64"),
      };
    }
    return val;
  });
}

function deserialize(json: string): unknown {
  return JSON.parse(json, (_key, val) => {
    if (val && typeof val === "object" && val.__type === "Uint8Array") {
      return new Uint8Array(Buffer.from(val.data, "base64"));
    }
    return val;
  });
}

/**
 * File-based cache storage using Bun's file API.
 * Persists cache entries to disk as JSON files.
 *
 * @example
 * ```ts
 * import { generateImage } from "ai";
 * import { withCache, fileCache } from "./index";
 *
 * const storage = fileCache({ dir: ".cache/ai" });
 * const generateImage_ = withCache(generateImage, { ttl: "24h", storage });
 *
 * const { images } = await generateImage_({
 *   model: fal.imageModel("flux-schnell"),
 *   prompt: "lion roaring",
 *   cacheKey: ["lion", take],
 * });
 * ```
 */
export function fileCache(options: { dir: string }): CacheStorage {
  const { dir } = options;

  const ensureDir = async () => {
    const file = Bun.file(dir);
    if (!(await file.exists())) {
      await Bun.write(`${dir}/.gitkeep`, "");
    }
  };

  const keyToPath = (key: string): string => {
    // sanitize key for filesystem
    const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${dir}/${safe}.json`;
  };

  return {
    async get(key: string): Promise<unknown | undefined> {
      try {
        const path = keyToPath(key);
        const file = Bun.file(path);

        if (!(await file.exists())) {
          return undefined;
        }

        const content = await file.text();
        const entry = deserialize(content) as CacheEntry;

        if (entry.expires && Date.now() > entry.expires) {
          // expired, clean up
          await Bun.write(path, "").catch(() => {});
          return undefined;
        }

        return entry.value;
      } catch {
        return undefined;
      }
    },

    async set(key: string, value: unknown, ttl?: number): Promise<void> {
      await ensureDir();
      const path = keyToPath(key);
      const entry: CacheEntry = {
        value,
        expires: ttl ? Date.now() + ttl : 0,
      };
      await Bun.write(path, serialize(entry));
    },

    async delete(key: string): Promise<void> {
      const path = keyToPath(key);
      const file = Bun.file(path);
      if (await file.exists()) {
        // Bun doesn't have a direct delete, use unlink
        const { unlink } = await import("node:fs/promises");
        await unlink(path).catch(() => {});
      }
    },
  };
}
