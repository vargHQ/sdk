/**
 * Graph invariant: one element = one generation, no matter how many
 * concurrent paths lead to it.
 *
 * Regression tests for the ep5 incident: 12 async components awaiting
 * `vid.audio.speechRange()` concurrently resolved shared dependency
 * images through the standalone resolve path, which had no in-flight
 * dedup — one location card produced 52 API jobs.
 */

import { describe, expect, mock, test } from "bun:test";
import { Image, Video } from "../elements";
import { resolveImageElement, resolveVideoElement } from "../resolve";
import type { ImageProps } from "../types";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]);

function makeCountingImageModel(counter: { calls: number }) {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-image",
    maxImagesPerCall: 1,
    doGenerate: mock(async () => {
      counter.calls++;
      // Simulate network latency so concurrent callers overlap in-flight.
      await new Promise((r) => setTimeout(r, 30));
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

describe("standalone resolve in-flight dedup", () => {
  test("concurrent resolveImageElement calls for the same element generate once", async () => {
    const counter = { calls: 0 };
    const img = Image({
      prompt: "a shared location card",
      model: makeCountingImageModel(counter),
    });

    const results = await Promise.all([
      resolveImageElement(img, img.props as ImageProps),
      resolveImageElement(img, img.props as ImageProps),
      resolveImageElement(img, img.props as ImageProps),
    ]);

    expect(counter.calls).toBe(1);
    // All callers observe the same resolved file
    expect(results[1]!.meta.file).toBe(results[0]!.meta.file);
    expect(results[2]!.meta.file).toBe(results[0]!.meta.file);
    // Meta written back — later paths see the element as pre-resolved
    expect(img.meta?.file).toBe(results[0]!.meta.file);
  });

  test("sequential re-resolve after completion does not regenerate", async () => {
    const counter = { calls: 0 };
    const img = Image({
      prompt: "resolve me twice",
      model: makeCountingImageModel(counter),
    });

    const first = await resolveImageElement(img, img.props as ImageProps);
    const second = await resolveImageElement(img, img.props as ImageProps);

    expect(counter.calls).toBe(1);
    expect(second.meta.file).toBe(first.meta.file);
  });

  test("ep5 shape: concurrent videos sharing one input image generate it once", async () => {
    const counter = { calls: 0 };
    const shared = Image({
      prompt: "the one location card",
      model: makeCountingImageModel(counter),
    });

    const videoCounter = { calls: 0 };
    const videoModel = {
      specificationVersion: "v3",
      provider: "mock",
      modelId: "mock-video",
      doGenerate: mock(async () => {
        videoCounter.calls++;
        await new Promise((r) => setTimeout(r, 10));
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

    // 3 distinct videos, all referencing the SAME image element — the ep5
    // dependency shape (12 videos -> 4 composites -> 1 locTrail).
    const videos = [1, 2, 3].map((i) =>
      Video({
        prompt: { text: `scene ${i}`, images: [shared] },
        model: videoModel,
      }),
    );

    const settled = await Promise.allSettled(
      videos.map((v) =>
        resolveVideoElement(v, v.props as Record<string, unknown>),
      ),
    );

    // The shared image resolved exactly once regardless of video outcomes —
    // this is the ep5 regression assertion (was 12 parallel generations).
    expect(counter.calls).toBe(1);
    // Videos are distinct elements — all three resolve successfully.
    // (No exact assert on videoCounter: generateVideo goes through the
    // disk cache, so doGenerate may be skipped on cache hits.)
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    expect(fulfilled.length).toBe(3);
    expect(videoCounter.calls).toBeLessThanOrEqual(3);
  });

  test("failed resolve stays memoized — no silent money re-spend on re-await", async () => {
    let calls = 0;
    const failingModel = {
      specificationVersion: "v3",
      provider: "mock",
      modelId: "mock-failing",
      maxImagesPerCall: 1,
      doGenerate: mock(async () => {
        calls++;
        throw new Error("provider exploded");
      }),
      // biome-ignore lint/suspicious/noExplicitAny: minimal mock model
    } as any;
    const img = Image({ prompt: "doomed", model: failingModel });

    const [a, b] = await Promise.allSettled([
      resolveImageElement(img, img.props as ImageProps),
      resolveImageElement(img, img.props as ImageProps),
    ]);
    expect(a!.status).toBe("rejected");
    expect(b!.status).toBe("rejected");
    expect(calls).toBe(1);

    // Re-awaiting the failed element re-throws without a new API call.
    const c = await resolveImageElement(img, img.props as ImageProps).catch(
      (e) => e,
    );
    expect(c).toBeInstanceOf(Error);
    expect(calls).toBe(1);
  });

  test("distinct elements with identical props remain distinct graph nodes", async () => {
    const counter = { calls: 0 };
    const model = makeCountingImageModel(counter);
    const a = Image({ prompt: "same prompt", model });
    const b = Image({ prompt: "same prompt", model });

    await Promise.all([
      resolveImageElement(a, a.props as ImageProps),
      resolveImageElement(b, b.props as ImageProps),
    ]);

    // Identity-keyed memoization: two elements, two resolves. (The disk
    // cache collapses them by cacheKey in real runs; with a mock model
    // and no shared cache both hit the model.)
    expect(counter.calls).toBe(2);
  });
});
