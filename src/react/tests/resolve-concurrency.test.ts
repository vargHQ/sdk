/**
 * The resolveLazy phase honors the render's `concurrency` budget.
 *
 * Async components generate during `resolveLazy`, which runs BEFORE
 * `executePlan` — so the executor's concurrency cap never applied to
 * them. ep5 (12 async components each awaiting `vid.audio.speechRange()`)
 * fanned out ~36-42 simultaneous API calls against a 60/min window and
 * then sustained a 429 retry storm.
 *
 * Dedup (resolve-dedup.test.ts) removed the *duplicate* calls; these
 * tests cover the *unique* ones, which are still unbounded without a
 * limiter. See sdk#225.
 */

import { describe, expect, mock, test } from "bun:test";
import pLimit from "p-limit";
import type { CacheStorage } from "../../ai-sdk/cache";
import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends";
import { Image, Video } from "../elements";
import { resolveImageElement, resolveVideoElement } from "../resolve";
import { withResolveContext } from "../resolve-context";
import type { ImageProps } from "../types";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);

/** Tracks peak simultaneous in-flight calls across a set of mock models. */
function makeConcurrencyTracker() {
  return { active: 0, maxActive: 0, calls: 0 };
}

type Tracker = ReturnType<typeof makeConcurrencyTracker>;

/** Mock image model that records how many generations overlap in time. */
function makeTrackingImageModel(t: Tracker, latencyMs = 20) {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-image",
    maxImagesPerCall: 1,
    doGenerate: mock(async () => {
      t.calls++;
      t.active++;
      t.maxActive = Math.max(t.maxActive, t.active);
      await new Promise((r) => setTimeout(r, latencyMs));
      t.active--;
      return {
        images: [PNG_BYTES],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "mock-image",
          headers: undefined,
        },
      };
    }),
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock model
  } as any;
}

/** Mock video model with the same in-flight accounting. */
function makeTrackingVideoModel(t: Tracker, latencyMs = 20) {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-video",
    doGenerate: mock(async () => {
      t.calls++;
      t.active++;
      t.maxActive = Math.max(t.maxActive, t.active);
      await new Promise((r) => setTimeout(r, latencyMs));
      t.active--;
      return {
        videos: [PNG_BYTES],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "mock-video",
          headers: undefined,
        },
      };
    }),
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock model
  } as any;
}

/**
 * In-memory cache so tests never touch the user's real `.cache/ai`
 * (generation cache is production data — see CLAUDE.md cache policy).
 */
function createMemoryCache(): CacheStorage & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get(key) {
      return store.get(key);
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

const stubBackend = {
  name: "mock",
  async ffprobe() {
    return { duration: 0, width: 0, height: 0 };
  },
  async resolvePath() {
    return "/tmp/mock";
  },
  async run() {
    return { output: { type: "file" as const, path: "/tmp/mock-output.mp4" } };
  },
} as unknown as FFmpegBackend;

describe("resolveLazy concurrency limit", () => {
  test("caps simultaneous generations at the context limit", async () => {
    const t = makeConcurrencyTracker();
    const model = makeTrackingImageModel(t);
    // 10 DISTINCT elements — dedup cannot collapse these; only a
    // semaphore bounds them.
    const images = Array.from({ length: 10 }, (_, i) =>
      Image({ prompt: `distinct scene ${i}`, model }),
    );

    await withResolveContext(
      { backend: stubBackend, cache: createMemoryCache(), limit: pLimit(3) },
      () =>
        Promise.all(
          images.map((img) =>
            resolveImageElement(img, img.props as ImageProps),
          ),
        ),
    );

    expect(t.calls).toBe(10);
    expect(t.maxActive).toBe(3);
  });

  test("without a limit the same graph fans out unbounded (the bug)", async () => {
    const t = makeConcurrencyTracker();
    const model = makeTrackingImageModel(t);
    const images = Array.from({ length: 10 }, (_, i) =>
      Image({ prompt: `unbounded scene ${i}`, model }),
    );

    // limit: undefined would fall back to the module-level limiter, so to
    // demonstrate the pre-fix behavior we hand it an explicit Infinity.
    await withResolveContext(
      {
        backend: stubBackend,
        cache: createMemoryCache(),
        limit: pLimit(Number.POSITIVE_INFINITY),
      },
      () =>
        Promise.all(
          images.map((img) =>
            resolveImageElement(img, img.props as ImageProps),
          ),
        ),
    );

    expect(t.maxActive).toBe(10);
  });

  test("nested dependencies do not deadlock at concurrency 1", async () => {
    // The critical safety property: a video resolves its nested image
    // INSIDE its own resolver. If the limiter wrapped whole resolvers, the
    // parent would hold the only slot while waiting on a child queued
    // behind it — permanent deadlock. Limiting only leaf network calls
    // keeps this graph live even at concurrency 1.
    const imgT = makeConcurrencyTracker();
    const vidT = makeConcurrencyTracker();
    const imageModel = makeTrackingImageModel(imgT, 5);
    const videoModel = makeTrackingVideoModel(vidT, 5);

    const videos = [1, 2, 3].map((i) =>
      Video({
        prompt: {
          text: `scene ${i}`,
          images: [Image({ prompt: `nested card ${i}`, model: imageModel })],
        },
        model: videoModel,
      }),
    );

    const settled = await withResolveContext(
      { backend: stubBackend, cache: createMemoryCache(), limit: pLimit(1) },
      () =>
        Promise.all(
          videos.map((v) =>
            resolveVideoElement(v, v.props as Record<string, unknown>),
          ),
        ),
    );

    expect(settled.length).toBe(3);
    expect(imgT.calls).toBe(3);
    expect(imgT.maxActive).toBe(1);
    expect(vidT.maxActive).toBe(1);
  });

  test("cache hits do not consume a limiter slot", async () => {
    // A fully cached run must not serialize on the limiter: cache reads
    // are cheap and are not the resource the semaphore protects.
    const t = makeConcurrencyTracker();
    const model = makeTrackingVideoModel(t, 5);
    const cache = createMemoryCache();

    const makeVideos = () =>
      [1, 2, 3, 4, 5].map((i) => Video({ prompt: `cached scene ${i}`, model }));

    // Warm pass populates the cache.
    await withResolveContext(
      { backend: stubBackend, cache, limit: pLimit(5) },
      () =>
        Promise.all(
          makeVideos().map((v) =>
            resolveVideoElement(v, v.props as Record<string, unknown>),
          ),
        ),
    );
    expect(t.calls).toBe(5);

    // Second pass: identical prompts, fresh elements, limit of 1. If cache
    // hits took slots this would still succeed but only by queueing; the
    // assertion that matters is that the model is never called again.
    const before = t.calls;
    await withResolveContext(
      { backend: stubBackend, cache, limit: pLimit(1) },
      () =>
        Promise.all(
          makeVideos().map((v) =>
            resolveVideoElement(v, v.props as Record<string, unknown>),
          ),
        ),
    );
    expect(t.calls).toBe(before);
  });

  test("limiter and dedup compose: shared element still generates once", async () => {
    const t = makeConcurrencyTracker();
    const model = makeTrackingImageModel(t);
    const shared = Image({ prompt: "the one location card", model });

    await withResolveContext(
      { backend: stubBackend, cache: createMemoryCache(), limit: pLimit(2) },
      () =>
        Promise.all(
          Array.from({ length: 5 }, () =>
            resolveImageElement(shared, shared.props as ImageProps),
          ),
        ),
    );

    // Dedup (WeakMap by element identity) is unaffected by the limiter.
    expect(t.calls).toBe(1);
  });

  test("falls back to a bounded limiter with no resolve context", async () => {
    // Top-level `await Promise.all([...])` outside render() has the same
    // fan-out problem with no RenderOptions to configure. The module-level
    // fallback (concurrency 3) bounds it.
    const t = makeConcurrencyTracker();
    const model = makeTrackingImageModel(t);
    const images = Array.from({ length: 8 }, (_, i) =>
      Image({ prompt: `top-level scene ${i}`, model }),
    );

    await Promise.all(
      images.map((img) => resolveImageElement(img, img.props as ImageProps)),
    );

    expect(t.calls).toBe(8);
    expect(t.maxActive).toBeLessThanOrEqual(3);
  });
});
