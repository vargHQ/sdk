import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { withCache } from "../../ai-sdk/cache";
import { fileCache } from "../../ai-sdk/file-cache";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import { Image, Video } from "../elements";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderVideo } from "./video";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "varg-cache-test-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function createImageModel(): ImageModelV3 {
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

function createVideoModel(): VideoModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-video",
    maxVideosPerCall: 1,
    async doGenerate() {
      return {
        videos: [new Uint8Array([9, 9, 9])],
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

type GenerateImageOptions = Parameters<RenderContext["generateImage"]>[0];
type GenerateVideoOptions = Parameters<RenderContext["generateVideo"]>[0];

function createContext(
  cacheDir: string,
  counters: { imageCalls: number; videoCalls: number },
): RenderContext {
  const storage = fileCache({ dir: cacheDir });

  const generateImage = withCache(async (_opts: GenerateImageOptions) => {
    counters.imageCalls += 1;
    return {
      images: [
        {
          uint8Array: new Uint8Array([1, 2, 3]),
          mimeType: "image/png",
        },
      ],
      warnings: [],
    };
  });

  const generateVideo = withCache(async (_opts: GenerateVideoOptions) => {
    counters.videoCalls += 1;
    const first = new Uint8Array([9, 9, 9]);
    return {
      video: { uint8Array: first, mimeType: "video/mp4" },
      videos: [{ uint8Array: first, mimeType: "video/mp4" }],
      warnings: [],
    };
  });

  return {
    width: 1080,
    height: 1920,
    fps: 30,
    cache: storage,
    generateImage: generateImage as RenderContext["generateImage"],
    generateVideo: generateVideo as RenderContext["generateVideo"],
    tempFiles: [],
    pending: new Map(),
  };
}

describe("render cache behavior", () => {
  test("reuses cached video across separate contexts when only trim/layout differ", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0 };

    const model = createVideoModel();
    const imageModel = createImageModel();

    const base = Video({
      prompt: "walk forward",
      model,
      duration: 5,
      aspectRatio: "9:16",
    });

    const variant = Video({
      prompt: "walk forward",
      model,
      duration: 5,
      aspectRatio: "9:16",
      cutFrom: 0.5,
      cutTo: 2.5,
      left: "10%",
      width: "80%",
      keepAudio: true,
      volume: 0.5,
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderVideo(base, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderVideo(variant, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.videoCalls).toBe(1);
  });

  test("reuses cached image across separate contexts when only layout differs", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0 };

    const videoModel = createVideoModel();
    const imageModel = createImageModel();

    const base = Image({
      prompt: "sunset over mountains",
      model: imageModel,
      aspectRatio: "16:9",
    });

    const variant = Image({
      prompt: "sunset over mountains",
      model: imageModel,
      aspectRatio: "16:9",
      left: "5%",
      top: "5%",
      width: "90%",
      height: "90%",
      resize: "cover",
      zoom: "in",
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderImage(base, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderImage(variant, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.imageCalls).toBe(1);
  });
});
