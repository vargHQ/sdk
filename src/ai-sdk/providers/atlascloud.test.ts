import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AtlasCloudAPIError, createAtlasCloud } from "./atlascloud";

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

function makeFetchHarness(
  responses: Array<{ status?: number; json?: unknown; bytes?: number[] }>,
) {
  const original = globalThis.fetch;
  const queue = [...responses];
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input, init) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    calls.push({
      url: input.toString(),
      method: init?.method ?? "GET",
      headers,
      body:
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : null,
    });

    const next = queue.shift();
    if (!next) throw new Error("Unexpected fetch call");
    if (next.bytes) {
      return new Response(new Uint8Array(next.bytes), {
        status: next.status ?? 200,
      });
    }
    return Response.json(next.json ?? {}, { status: next.status ?? 200 });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function imageOptions() {
  return {
    prompt: "a city at sunrise",
    n: 1,
    size: "1024x768" as const,
    aspectRatio: "4:3" as const,
    seed: 42,
    files: undefined,
    mask: undefined,
    providerOptions: {},
  };
}

function videoOptions() {
  return {
    prompt: "a paper boat crossing a pond",
    n: 1,
    resolution: "1280x720" as const,
    aspectRatio: "16:9" as const,
    duration: 5,
    fps: 24,
    seed: 7,
    files: undefined,
    providerOptions: {},
  };
}

describe("Atlas Cloud provider", () => {
  const previousKey = process.env.ATLASCLOUD_API_KEY;
  let restoreFetch: (() => void) | undefined;

  beforeEach(() => {
    delete process.env.ATLASCLOUD_API_KEY;
  });

  afterEach(() => {
    restoreFetch?.();
    restoreFetch = undefined;
    if (previousKey === undefined) delete process.env.ATLASCLOUD_API_KEY;
    else process.env.ATLASCLOUD_API_KEY = previousKey;
  });

  test("submits, polls, and downloads an image", async () => {
    const harness = makeFetchHarness([
      { json: { code: "200", data: { id: "img-1", status: "processing" } } },
      {
        json: {
          code: "200",
          data: {
            id: "img-1",
            status: "completed",
            outputs: ["https://cdn.example/image.png"],
          },
        },
      },
      { bytes: [1, 2, 3] },
    ]);
    restoreFetch = harness.restore;

    const provider = createAtlasCloud({
      apiKey: "test-key",
      pollIntervalMs: 0,
    });
    const result = await provider
      .imageModel("qwen-image-3.0/text-to-image")
      .doGenerate(imageOptions());

    expect(result.images[0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(harness.calls.map((call) => call.url)).toEqual([
      "https://api.atlascloud.ai/api/v1/model/generateImage",
      "https://api.atlascloud.ai/api/v1/model/prediction/img-1",
      "https://cdn.example/image.png",
    ]);
    expect(harness.calls[0]?.headers.authorization).toBe("Bearer test-key");
    expect(harness.calls[0]?.body).toEqual({
      model: "qwen-image-3.0/text-to-image",
      prompt: "a city at sunrise",
      n: 1,
      size: "1024*768",
      aspect_ratio: "4:3",
      seed: 42,
    });
  });

  test("passes model options while keeping apiKey out of the body", async () => {
    const harness = makeFetchHarness([
      {
        json: {
          code: 200,
          data: {
            status: "completed",
            outputs: ["https://cdn.example/image.png"],
          },
        },
      },
      { bytes: [4] },
    ]);
    restoreFetch = harness.restore;

    const provider = createAtlasCloud();
    await provider.imageModel("vendor/model").doGenerate({
      ...imageOptions(),
      providerOptions: {
        atlascloud: {
          apiKey: "per-call-key",
          negative_prompt: "blurry",
          size: "512*512",
        },
      },
    });

    expect(harness.calls[0]?.headers.authorization).toBe("Bearer per-call-key");
    expect(harness.calls[0]?.body).toEqual({
      model: "vendor/model",
      prompt: "a city at sunrise",
      n: 1,
      size: "512*512",
      aspect_ratio: "4:3",
      seed: 42,
      negative_prompt: "blurry",
    });
  });

  test("encodes inline files and URL files in the images field", async () => {
    const harness = makeFetchHarness([
      {
        json: {
          data: {
            status: "completed",
            outputs: ["https://cdn.example/edit.png"],
          },
          code: 200,
        },
      },
      { bytes: [5] },
    ]);
    restoreFetch = harness.restore;

    const provider = createAtlasCloud({ apiKey: "test-key" });
    await provider.imageModel("vendor/edit").doGenerate({
      ...imageOptions(),
      files: [
        {
          type: "file",
          mediaType: "image/png",
          data: new Uint8Array([1, 2, 3]),
        },
        { type: "url", url: "https://example.com/reference.png" },
      ],
    });

    expect(harness.calls[0]?.body?.images).toEqual([
      "data:image/png;base64,AQID",
      "https://example.com/reference.png",
    ]);
  });

  test("submits video fields to the video endpoint", async () => {
    const harness = makeFetchHarness([
      {
        json: {
          code: 200,
          data: {
            status: "completed",
            outputs: ["https://cdn.example/video.mp4"],
          },
        },
      },
      { bytes: [6, 7] },
    ]);
    restoreFetch = harness.restore;

    const provider = createAtlasCloud({ apiKey: "test-key" });
    const result = await provider
      .videoModel("bytedance/seedance-2.5/text-to-video")
      .doGenerate(videoOptions());

    expect(result.videos[0]).toEqual(new Uint8Array([6, 7]));
    expect(harness.calls[0]?.url).toEndWith("/model/generateVideo");
    expect(harness.calls[0]?.body).toMatchObject({
      model: "bytedance/seedance-2.5/text-to-video",
      prompt: "a paper boat crossing a pond",
      size: "1280*720",
      aspect_ratio: "16:9",
      duration: 5,
      fps: 24,
      seed: 7,
    });
  });

  test("uses ATLASCLOUD_API_KEY as the fallback", async () => {
    process.env.ATLASCLOUD_API_KEY = "env-key";
    const harness = makeFetchHarness([
      {
        json: {
          code: 200,
          data: {
            status: "completed",
            outputs: ["https://cdn.example/image.png"],
          },
        },
      },
      { bytes: [8] },
    ]);
    restoreFetch = harness.restore;

    await createAtlasCloud()
      .imageModel("vendor/model")
      .doGenerate(imageOptions());
    expect(harness.calls[0]?.headers.authorization).toBe("Bearer env-key");
  });

  test("reports failed predictions", async () => {
    const harness = makeFetchHarness([
      { json: { code: 200, data: { id: "failed-1", status: "processing" } } },
      {
        json: {
          code: 200,
          data: { id: "failed-1", status: "failed", error: "bad prompt" },
        },
      },
    ]);
    restoreFetch = harness.restore;

    const request = createAtlasCloud({ apiKey: "test-key", pollIntervalMs: 0 })
      .imageModel("vendor/model")
      .doGenerate(imageOptions());
    await expect(request).rejects.toThrow("bad prompt");
  });

  test("preserves HTTP status on API errors", async () => {
    const harness = makeFetchHarness([
      { status: 429, json: { error: "slow down" } },
    ]);
    restoreFetch = harness.restore;

    const request = createAtlasCloud({ apiKey: "test-key" })
      .imageModel("vendor/model")
      .doGenerate(imageOptions());
    const error: unknown = await Promise.resolve(request).catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(AtlasCloudAPIError);
    expect((error as AtlasCloudAPIError).statusCode).toBe(429);
  });

  test("requires an API key only when a request is made", async () => {
    const provider = createAtlasCloud();
    expect(provider.imageModel("vendor/model").modelId).toBe("vendor/model");
    await expect(
      provider.imageModel("vendor/model").doGenerate(imageOptions()),
    ).rejects.toThrow("ATLASCLOUD_API_KEY");
    expect(() => provider.languageModel("vendor/model")).toThrow();
  });
});
