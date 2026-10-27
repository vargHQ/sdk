/**
 * The standalone resolve path must reuse cached images.
 *
 * `resolveImageElementImpl` used to call the raw `generateImage`, which does
 * not understand `cacheKey` and silently dropped it. Every `await Image()` —
 * including the nested scene stills pulled in by `vid.audio.speechRange()` —
 * therefore paid for a fresh generation with a fresh seed, even when an
 * identical image was already on disk from an earlier preview stage.
 *
 * That is not just a billing bug. An approve-the-stills-then-render workflow
 * silently fed the video model a *different* image than the one approved, so
 * the first frame of each clip never matched the still the user signed off on.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { fileCache } from "../ai-sdk/file-cache";
import { localBackend } from "../ai-sdk/providers/editly";
import { Image } from "./elements";
import { withResolveContext } from "./resolve-context";

let cacheDir: string;

beforeEach(() => {
  cacheDir = mkdtempSync(join(tmpdir(), "varg-resolve-image-cache-"));
});

afterEach(() => {
  rmSync(cacheDir, { recursive: true, force: true });
});

/** An image model that counts calls and returns a different image each time. */
function createCountingImageModel(): ImageModelV3 & { calls: number } {
  let calls = 0;
  const model = {
    specificationVersion: "v3" as const,
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate() {
      calls += 1;
      // Distinct bytes per call stand in for a distinct seed: if the second
      // resolve returns [1] the cache was used, if it returns [2] it was not.
      return {
        images: [new Uint8Array([calls])],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-image",
          headers: undefined,
        },
      };
    },
    get calls() {
      return calls;
    },
  };
  return model as ImageModelV3 & { calls: number };
}

/**
 * Run `fn` with a resolve context wired to a throwaway disk cache.
 *
 * The `await` must happen *inside* `withResolveContext`. `AsyncLocalStorage.run`
 * only keeps the store alive for the synchronous body plus whatever it awaits;
 * returning an unawaited thenable lets the actual generation land outside the
 * context, where `getActiveCache()` silently falls back to the real `.cache/ai`.
 */
function withCache<T>(dir: string, fn: () => PromiseLike<T>): Promise<T> {
  return withResolveContext(
    { backend: localBackend, cache: fileCache({ dir }) },
    async () => await fn(),
  );
}

describe("standalone image resolve — caching", () => {
  test("a second identical element hits the cache instead of regenerating", async () => {
    const model = createCountingImageModel();

    // Two *distinct* elements with identical props. Element-identity
    // memoization (the WeakMap in resolve.ts) cannot collapse these — only
    // the cacheKey can, which is exactly what regressed.
    const props = { prompt: "a heavyset man in a gym", model };

    const first = await withCache(cacheDir, () => Image(props));
    const second = await withCache(cacheDir, () => Image(props));

    expect(model.calls).toBe(1);

    // Same bytes, not merely a same-shaped result: proves the cached image
    // was returned rather than a fresh generation that happened to match.
    const a = await first.meta.file.arrayBuffer();
    const b = await second.meta.file.arrayBuffer();
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  test("the result survives a fresh cache handle over the same directory", async () => {
    const model = createCountingImageModel();
    const props = { prompt: "same prompt across runs", model };

    // Two separate `withResolveContext` scopes with separate `fileCache`
    // instances model two separate CLI invocations — the preview stage and
    // the later full render — against one on-disk cache.
    await withCache(cacheDir, () => Image(props));
    await withCache(cacheDir, () => Image(props));

    expect(model.calls).toBe(1);
  });

  test("changing the prompt still generates", async () => {
    const model = createCountingImageModel();

    await withCache(cacheDir, () => Image({ prompt: "scene one", model }));
    await withCache(cacheDir, () => Image({ prompt: "scene two", model }));

    expect(model.calls).toBe(2);
  });
});
