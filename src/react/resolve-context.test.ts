import { describe, expect, mock, test } from "bun:test";
import type { CacheStorage } from "../ai-sdk/cache";
import { File } from "../ai-sdk/file";
import type { FFmpegBackend } from "../ai-sdk/providers/editly/backends";
import type { VideoInfo } from "../ai-sdk/providers/editly/types";
import {
  getResolveContext,
  type ResolveContext,
  withResolveContext,
} from "./resolve-context";

// ---------------------------------------------------------------------------
// Mock backends
// ---------------------------------------------------------------------------

/** Create a mock local backend for testing. */
function createMockLocalBackend(): FFmpegBackend & {
  ffprobeCalls: string[];
  resolvePathCalls: unknown[];
} {
  const ffprobeCalls: string[] = [];
  const resolvePathCalls: unknown[] = [];

  return {
    name: "mock-local",
    ffprobeCalls,
    resolvePathCalls,
    async ffprobe(input: string): Promise<VideoInfo> {
      ffprobeCalls.push(input);
      return { duration: 3.5, width: 1080, height: 1920 };
    },
    async resolvePath(path: unknown): Promise<string> {
      resolvePathCalls.push(path);
      if (typeof path === "string") return path;
      if (path instanceof File) {
        return (path as File).url ?? `/tmp/mock-resolved-${Date.now()}`;
      }
      return `/tmp/mock-resolved-${Date.now()}`;
    },
    async run() {
      return {
        output: { type: "file" as const, path: "/tmp/mock-output.mp4" },
      };
    },
  };
}

/** Create a mock cloud (Rendi-like) backend for testing. */
function createMockCloudBackend(): FFmpegBackend & {
  ffprobeCalls: string[];
  resolvePathCalls: unknown[];
  uploadedFiles: string[];
} {
  const ffprobeCalls: string[] = [];
  const resolvePathCalls: unknown[] = [];
  const uploadedFiles: string[] = [];

  return {
    name: "mock-cloud",
    ffprobeCalls,
    resolvePathCalls,
    uploadedFiles,
    async ffprobe(input: string): Promise<VideoInfo> {
      ffprobeCalls.push(input);
      // Cloud backend probes via API, returns same structure
      return { duration: 5.2, width: 720, height: 1280 };
    },
    async resolvePath(path: unknown): Promise<string> {
      resolvePathCalls.push(path);
      if (typeof path === "string") {
        if (path.startsWith("http")) return path;
        // Cloud backend uploads local files
        const url = `https://storage.cloud.dev/uploads/${Date.now()}.mp4`;
        uploadedFiles.push(path);
        return url;
      }
      if (path instanceof File) {
        if ((path as File).url) return (path as File).url!;
        const url = `https://storage.cloud.dev/uploads/${Date.now()}.mp4`;
        uploadedFiles.push("file-object");
        return url;
      }
      return `https://storage.cloud.dev/uploads/${Date.now()}.mp4`;
    },
    async run() {
      return {
        output: {
          type: "url" as const,
          url: "https://storage.cloud.dev/output/result.mp4",
        },
      };
    },
  };
}

/** Create a mock cache for testing. */
function createMockCache(): CacheStorage & {
  store: Map<string, unknown>;
  getCalls: string[];
  setCalls: string[];
} {
  const store = new Map<string, unknown>();
  const getCalls: string[] = [];
  const setCalls: string[] = [];

  return {
    store,
    getCalls,
    setCalls,
    async get(key: string) {
      getCalls.push(key);
      return store.get(key);
    },
    async set(key: string, value: unknown) {
      setCalls.push(key);
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: ResolveContext basics
// ---------------------------------------------------------------------------
describe("ResolveContext", () => {
  test("getResolveContext() returns undefined outside withResolveContext", () => {
    expect(getResolveContext()).toBeUndefined();
  });

  test("getResolveContext() returns context inside withResolveContext", () => {
    const backend = createMockLocalBackend();
    const ctx: ResolveContext = { backend };

    withResolveContext(ctx, () => {
      const current = getResolveContext();
      expect(current).toBeDefined();
      expect(current!.backend.name).toBe("mock-local");
    });
  });

  test("context is scoped — not visible after withResolveContext returns", () => {
    const backend = createMockLocalBackend();
    withResolveContext({ backend }, () => {
      expect(getResolveContext()).toBeDefined();
    });
    expect(getResolveContext()).toBeUndefined();
  });

  test("nested contexts override outer context", () => {
    const localBackend = createMockLocalBackend();
    const cloudBackend = createMockCloudBackend();

    withResolveContext({ backend: localBackend }, () => {
      expect(getResolveContext()!.backend.name).toBe("mock-local");

      withResolveContext({ backend: cloudBackend }, () => {
        expect(getResolveContext()!.backend.name).toBe("mock-cloud");
      });

      // Outer context restored
      expect(getResolveContext()!.backend.name).toBe("mock-local");
    });
  });

  test("context propagates through async functions", async () => {
    const backend = createMockLocalBackend();
    const cache = createMockCache();

    const result = await withResolveContext({ backend, cache }, async () => {
      // Simulate async component calling await Speech()
      await new Promise((r) => setTimeout(r, 10));
      const ctx = getResolveContext();
      return {
        backendName: ctx?.backend.name,
        hasCache: !!ctx?.cache,
      };
    });

    expect(result.backendName).toBe("mock-local");
    expect(result.hasCache).toBe(true);
  });

  test("context with cache is accessible", () => {
    const backend = createMockLocalBackend();
    const cache = createMockCache();

    withResolveContext({ backend, cache }, () => {
      const ctx = getResolveContext();
      expect(ctx!.cache).toBeDefined();
      expect(ctx!.cache).toBe(cache);
    });
  });

  test("context without cache has undefined cache", () => {
    const backend = createMockLocalBackend();

    withResolveContext({ backend }, () => {
      const ctx = getResolveContext();
      expect(ctx!.cache).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests: Backend behavior differences
// ---------------------------------------------------------------------------
describe("backend behavior", () => {
  test("local backend returns file paths from resolvePath", async () => {
    const backend = createMockLocalBackend();
    const path = await backend.resolvePath("/tmp/test.mp3");
    expect(path).toBe("/tmp/test.mp3");
    expect(backend.resolvePathCalls).toEqual(["/tmp/test.mp3"]);
  });

  test("cloud backend returns URLs from resolvePath", async () => {
    const backend = createMockCloudBackend();
    const path = await backend.resolvePath("/local/test.mp3");
    expect(path).toStartWith("https://storage.cloud.dev/uploads/");
    expect(backend.uploadedFiles.length).toBe(1);
  });

  test("cloud backend passes through URLs in resolvePath", async () => {
    const backend = createMockCloudBackend();
    const path = await backend.resolvePath("https://example.com/audio.mp3");
    expect(path).toBe("https://example.com/audio.mp3");
    expect(backend.uploadedFiles.length).toBe(0); // no upload needed
  });

  test("local backend ffprobe returns duration", async () => {
    const backend = createMockLocalBackend();
    const info = await backend.ffprobe("/tmp/test.mp3");
    expect(info.duration).toBe(3.5);
    expect(backend.ffprobeCalls).toEqual(["/tmp/test.mp3"]);
  });

  test("cloud backend ffprobe returns duration", async () => {
    const backend = createMockCloudBackend();
    const info = await backend.ffprobe("https://storage.cloud.dev/audio.mp3");
    expect(info.duration).toBe(5.2);
    expect(backend.ffprobeCalls).toEqual([
      "https://storage.cloud.dev/audio.mp3",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Tests: Context in resolve pipeline simulation
// ---------------------------------------------------------------------------
describe("resolve pipeline with different backends", () => {
  test("simulated probeDuration uses local backend when context has local", async () => {
    const backend = createMockLocalBackend();

    const duration = await withResolveContext({ backend }, async () => {
      const ctx = getResolveContext()!;
      // Simulate what probeDurationViaBackend does
      const file = File.fromGenerated({
        uint8Array: new Uint8Array([0, 1, 2]),
        mediaType: "audio/mpeg",
      });
      const path = await ctx.backend.resolvePath(file);
      const info = await ctx.backend.ffprobe(path);
      return info.duration;
    });

    expect(duration).toBe(3.5);
    expect(backend.resolvePathCalls.length).toBe(1);
    expect(backend.ffprobeCalls.length).toBe(1);
  });

  test("simulated probeDuration uses cloud backend when context has cloud", async () => {
    const backend = createMockCloudBackend();

    const duration = await withResolveContext({ backend }, async () => {
      const ctx = getResolveContext()!;
      const file = File.fromGenerated({
        uint8Array: new Uint8Array([0, 1, 2]),
        mediaType: "audio/mpeg",
      });
      const path = await ctx.backend.resolvePath(file);
      const info = await ctx.backend.ffprobe(path);
      return info.duration;
    });

    expect(duration).toBe(5.2); // cloud backend returns 5.2
    expect(backend.resolvePathCalls.length).toBe(1);
    expect(backend.ffprobeCalls.length).toBe(1);
    expect(backend.uploadedFiles.length).toBe(1); // file was uploaded
  });

  test("simulated resolve uses cache from context", async () => {
    const backend = createMockLocalBackend();
    const cache = createMockCache();

    await withResolveContext({ backend, cache }, async () => {
      const ctx = getResolveContext()!;
      // Simulate cache usage
      await ctx.cache!.set("test-key", { data: "cached" });
      const cached = await ctx.cache!.get("test-key");
      expect(cached).toEqual({ data: "cached" });
    });

    expect(cache.setCalls).toEqual(["test-key"]);
    expect(cache.getCalls).toEqual(["test-key"]);
  });

  test("local file resolution uses backend.resolvePath in context", async () => {
    const cloudBackend = createMockCloudBackend();

    const resolvedPath = await withResolveContext(
      { backend: cloudBackend },
      async () => {
        const ctx = getResolveContext()!;
        // Simulate what resolveImageInputForStandalone does for local paths
        const localFile = File.fromPath("/local/image.png");
        return ctx.backend.resolvePath(localFile);
      },
    );

    // Cloud backend should have uploaded the file and returned a URL
    expect(resolvedPath).toStartWith("https://storage.cloud.dev/uploads/");
    expect(cloudBackend.uploadedFiles.length).toBe(1);
  });

  test("no context falls back gracefully (simulated top-level await)", async () => {
    // Outside withResolveContext — simulates top-level await
    const ctx = getResolveContext();
    expect(ctx).toBeUndefined();

    // Code should check for ctx and fall back to local behavior
    const usesLocal = ctx?.backend ? false : true;
    expect(usesLocal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Concurrent contexts (multiple renders in parallel)
// ---------------------------------------------------------------------------
describe("concurrent resolve contexts", () => {
  test("parallel withResolveContext calls are isolated", async () => {
    const localBackend = createMockLocalBackend();
    const cloudBackend = createMockCloudBackend();

    const [result1, result2] = await Promise.all([
      withResolveContext({ backend: localBackend }, async () => {
        await new Promise((r) => setTimeout(r, 20));
        return getResolveContext()!.backend.name;
      }),
      withResolveContext({ backend: cloudBackend }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        return getResolveContext()!.backend.name;
      }),
    ]);

    expect(result1).toBe("mock-local");
    expect(result2).toBe("mock-cloud");
  });

  test("parallel renders with different caches are isolated", async () => {
    const backend = createMockLocalBackend();
    const cache1 = createMockCache();
    const cache2 = createMockCache();

    await Promise.all([
      withResolveContext({ backend, cache: cache1 }, async () => {
        await getResolveContext()!.cache!.set("key", "from-cache-1");
        await new Promise((r) => setTimeout(r, 10));
        const val = await getResolveContext()!.cache!.get("key");
        expect(val).toBe("from-cache-1");
      }),
      withResolveContext({ backend, cache: cache2 }, async () => {
        await getResolveContext()!.cache!.set("key", "from-cache-2");
        await new Promise((r) => setTimeout(r, 5));
        const val = await getResolveContext()!.cache!.get("key");
        expect(val).toBe("from-cache-2");
      }),
    ]);

    // Each cache only has its own value
    expect(cache1.store.get("key")).toBe("from-cache-1");
    expect(cache2.store.get("key")).toBe("from-cache-2");
  });
});
