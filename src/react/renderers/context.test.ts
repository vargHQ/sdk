import { describe, expect, test } from "bun:test";
import { generateImage } from "ai";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { generateVideo } from "../../ai-sdk/generate-video";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import { fileCache } from "../../ai-sdk/file-cache";
import type { RenderContext } from "./context";
import { createProgressTracker } from "./progress";

function createTestImageModel(): ImageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate() {
      return {
        images: [new Uint8Array([1, 2, 3])],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-image",
          headers: undefined,
        },
      };
    },
  };
}

function createTestVideoModel(): VideoModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-video",
    maxVideosPerCall: 1,
    async doGenerate() {
      return {
        videos: [new Uint8Array([4, 5, 6])],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-video",
          headers: undefined,
        },
      };
    },
  };
}

describe("RenderContext", () => {
  test("creates context with default dimensions", () => {
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    expect(ctx.width).toBe(1920);
    expect(ctx.height).toBe(1080);
    expect(ctx.fps).toBe(30);
    expect(ctx.tempFiles).toEqual([]);
    expect(ctx.pending).toBeInstanceOf(Map);
  });

  test("creates context with custom dimensions", () => {
    const ctx: RenderContext = {
      width: 1280,
      height: 720,
      fps: 60,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    expect(ctx.width).toBe(1280);
    expect(ctx.height).toBe(720);
    expect(ctx.fps).toBe(60);
  });

  test("context includes cache storage when provided", () => {
    const cache = fileCache({ dir: "/tmp/test-cache" });
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      cache,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    expect(ctx.cache).toBe(cache);
  });

  test("context includes progress tracker when provided", () => {
    const progress = createProgressTracker(false);
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      progress,
      pending: new Map(),
    };

    expect(ctx.progress).toBe(progress);
  });

  test("pending map is empty by default", () => {
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    expect(ctx.pending.size).toBe(0);
  });

  test("can add entries to pending map", () => {
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    const promise = Promise.resolve("/tmp/test.png");
    ctx.pending.set("test-key", promise);

    expect(ctx.pending.size).toBe(1);
    expect(ctx.pending.get("test-key")).toBe(promise);
  });

  test("context supports default models", () => {
    const imageModel = createTestImageModel();
    const videoModel = createTestVideoModel();

    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
      defaults: {
        image: imageModel,
        video: videoModel,
      },
    };

    expect(ctx.defaults?.image).toBe(imageModel);
    expect(ctx.defaults?.video).toBe(videoModel);
  });

  test("tempFiles array is mutable", () => {
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    ctx.tempFiles.push("/tmp/file1.png");
    ctx.tempFiles.push("/tmp/file2.mp4");

    expect(ctx.tempFiles).toHaveLength(2);
    expect(ctx.tempFiles).toContain("/tmp/file1.png");
    expect(ctx.tempFiles).toContain("/tmp/file2.mp4");
  });

  test("context with all optional fields", () => {
    const cache = fileCache({ dir: "/tmp/cache" });
    const progress = createProgressTracker(true);
    const imageModel = createTestImageModel();

    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      cache,
      generateImage,
      generateVideo,
      tempFiles: ["/tmp/temp1.png"],
      progress,
      pending: new Map([["key1", Promise.resolve("/path/1")]]),
      defaults: { image: imageModel },
    };

    expect(ctx.cache).toBe(cache);
    expect(ctx.progress).toBe(progress);
    expect(ctx.tempFiles).toHaveLength(1);
    expect(ctx.pending.size).toBe(1);
    expect(ctx.defaults?.image).toBe(imageModel);
  });

  test("context interface type checking", () => {
    const ctx: RenderContext = {
      width: 1920,
      height: 1080,
      fps: 30,
      generateImage,
      generateVideo,
      tempFiles: [],
      pending: new Map(),
    };

    expect(typeof ctx.width).toBe("number");
    expect(typeof ctx.height).toBe("number");
    expect(typeof ctx.fps).toBe("number");
    expect(typeof ctx.generateImage).toBe("function");
    expect(typeof ctx.generateVideo).toBe("function");
    expect(Array.isArray(ctx.tempFiles)).toBe(true);
    expect(ctx.pending instanceof Map).toBe(true);
  });
});