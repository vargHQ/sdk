import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import type { File } from "../../ai-sdk/file";
import { fileCache } from "../../ai-sdk/file-cache";
import type { MusicModelV3 } from "../../ai-sdk/music-model";
import { localBackend } from "../../ai-sdk/providers/editly";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import { Image, Music, Video } from "../elements";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderMusic } from "./music";
import { renderVideo } from "./video";

function makeTempDir(suffix: string): string {
  return mkdtempSync(join(tmpdir(), `varg-seed-test-${suffix}-`));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function createImageModel(
  onGenerate?: (opts: { seed?: number }) => void,
): ImageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate(opts) {
      onGenerate?.({ seed: opts.seed });
      return {
        images: [new Uint8Array([1, 2, 3, opts.seed ?? 0])],
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

function createVideoModel(
  onGenerate?: (opts: { seed?: number }) => void,
): VideoModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-video",
    maxVideosPerCall: 1,
    async doGenerate(opts) {
      onGenerate?.({ seed: opts.seed });
      return {
        videos: [new Uint8Array([9, 9, 9, opts.seed ?? 0])],
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

function createMusicModel(
  onGenerate?: (opts: { seed?: number }) => void,
): MusicModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-music",
    async doGenerate(opts) {
      onGenerate?.({ seed: opts.seed });
      return {
        audio: new Uint8Array([5, 5, 5, opts.seed ?? 0]),
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-music",
          headers: undefined,
        },
      };
    },
  };
}

class MockGeneratedImage {
  readonly uint8Array: Uint8Array;
  readonly mimeType = "image/png";

  constructor(seed?: number) {
    this.uint8Array = new Uint8Array([1, 2, 3, seed ?? 0]);
  }

  get base64(): string {
    let binary = "";
    for (const byte of this.uint8Array) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}

class MockGeneratedVideo {
  readonly uint8Array: Uint8Array;
  readonly mimeType = "video/mp4";

  constructor(seed?: number) {
    this.uint8Array = new Uint8Array([9, 9, 9, seed ?? 0]);
  }

  get base64(): string {
    let binary = "";
    for (const byte of this.uint8Array) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  }
}

function createContext(
  cacheDir: string,
  callbacks?: {
    onImageGenerate?: (opts: { seed?: number }) => void;
    onVideoGenerate?: (opts: { seed?: number }) => void;
  },
): RenderContext {
  const storage = fileCache({ dir: cacheDir });

  return {
    width: 1080,
    height: 1920,
    fps: 30,
    cache: storage,
    generateImage: (async (opts: { seed?: number }) => {
      callbacks?.onImageGenerate?.({ seed: opts.seed });
      const img = new MockGeneratedImage(opts.seed);
      return {
        image: img,
        images: [img],
        warnings: [],
        responses: [],
        providerMetadata: undefined,
        usage: { images: 1 },
      };
    }) as unknown as RenderContext["generateImage"],
    generateVideo: (async (opts: { seed?: number }) => {
      callbacks?.onVideoGenerate?.({ seed: opts.seed });
      const vid = new MockGeneratedVideo(opts.seed);
      return {
        video: vid,
        videos: [vid],
        warnings: [],
      };
    }) as unknown as RenderContext["generateVideo"],
    tempFiles: [],
    pendingFiles: new Map<string, Promise<File>>(),
    backend: localBackend,
  };
}

function createMusicContext(
  cacheDir: string,
  model: MusicModelV3,
): RenderContext {
  const storage = fileCache({ dir: cacheDir });
  const emptyImg = new MockGeneratedImage();
  const emptyVid = new MockGeneratedVideo();

  return {
    width: 1080,
    height: 1920,
    fps: 30,
    cache: storage,
    generateImage: (async () => ({
      image: emptyImg,
      images: [emptyImg],
      warnings: [],
      responses: [],
      providerMetadata: undefined,
      usage: { images: 0 },
    })) as unknown as RenderContext["generateImage"],
    generateVideo: (async () => ({
      video: emptyVid,
      videos: [emptyVid],
      warnings: [],
    })) as unknown as RenderContext["generateVideo"],
    tempFiles: [],
    pendingFiles: new Map(),
    backend: localBackend,
    defaults: { music: model },
  };
}

describe("seed support", () => {
  test("seed is passed to image model via generateImage", async () => {
    const cacheDir = makeTempDir("img-seed-passthrough");
    let receivedSeed: number | undefined;

    const model = createImageModel();

    const img = Image({
      prompt: "test image",
      model,
      seed: 12345,
    });

    try {
      const ctx = createContext(cacheDir, {
        onImageGenerate: (opts) => {
          receivedSeed = opts.seed;
        },
      });
      await renderImage(img, ctx);

      expect(receivedSeed).toBe(12345);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("seed is passed to video model via generateVideo", async () => {
    const cacheDir = makeTempDir("vid-seed-passthrough");
    let receivedSeed: number | undefined;

    const model = createVideoModel();

    const vid = Video({
      prompt: "test video",
      model,
      seed: 67890,
    });

    try {
      const ctx = createContext(cacheDir, {
        onVideoGenerate: (opts) => {
          receivedSeed = opts.seed;
        },
      });
      await renderVideo(vid, ctx);

      expect(receivedSeed).toBe(67890);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("undefined seed is passed as undefined", async () => {
    const cacheDir = makeTempDir("no-seed");
    let receivedSeed: number | undefined = 999;

    const model = createImageModel();

    const img = Image({
      prompt: "sunset",
      model,
      aspectRatio: "16:9",
    });

    try {
      const ctx = createContext(cacheDir, {
        onImageGenerate: (opts) => {
          receivedSeed = opts.seed;
        },
      });
      await renderImage(img, ctx);

      expect(receivedSeed).toBeUndefined();
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("different seeds produce different cache keys for images", async () => {
    const cacheDir = makeTempDir("img-diff-seeds");
    const seeds: (number | undefined)[] = [];

    const model = createImageModel();

    const img1 = Image({
      prompt: "sunset over mountains",
      model,
      aspectRatio: "16:9",
      seed: 42,
    });

    const img2 = Image({
      prompt: "sunset over mountains",
      model,
      aspectRatio: "16:9",
      seed: 123,
    });

    try {
      const ctx = createContext(cacheDir, {
        onImageGenerate: (opts) => seeds.push(opts.seed),
      });

      await renderImage(img1, ctx);
      ctx.pendingFiles.clear();
      await renderImage(img2, ctx);

      expect(seeds.length).toBe(2);
      expect(seeds).toContain(42);
      expect(seeds).toContain(123);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("different seeds produce different cache keys for videos", async () => {
    const cacheDir = makeTempDir("vid-diff-seeds");
    const seeds: (number | undefined)[] = [];

    const model = createVideoModel();

    const vid1 = Video({
      prompt: "ocean waves",
      model,
      aspectRatio: "16:9",
      seed: 42,
    });

    const vid2 = Video({
      prompt: "ocean waves",
      model,
      aspectRatio: "16:9",
      seed: 999,
    });

    try {
      const ctx = createContext(cacheDir, {
        onVideoGenerate: (opts) => seeds.push(opts.seed),
      });

      await renderVideo(vid1, ctx);
      ctx.pendingFiles.clear();
      await renderVideo(vid2, ctx);

      expect(seeds.length).toBe(2);
      expect(seeds).toContain(42);
      expect(seeds).toContain(999);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });
});

describe("music seed support", () => {
  test("seed is passed to music model via generateMusic", async () => {
    const cacheDir = makeTempDir("music-seed-passthrough");
    let receivedSeed: number | undefined;

    const model = createMusicModel((opts) => {
      receivedSeed = opts.seed;
    });

    const music = Music({
      prompt: "ambient music",
      model,
      duration: 10,
      seed: 54321,
    });

    try {
      const ctx = createMusicContext(cacheDir, model);
      await renderMusic(music, ctx);

      expect(receivedSeed).toBe(54321);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("different seeds produce different cache keys for music", async () => {
    const cacheDir1 = makeTempDir("music-seed1");
    const cacheDir2 = makeTempDir("music-seed2");
    const seeds: (number | undefined)[] = [];

    const model = createMusicModel((opts) => {
      seeds.push(opts.seed);
    });

    const music1 = Music({
      prompt: "ambient music",
      model,
      duration: 10,
      seed: 42,
    });

    const music2 = Music({
      prompt: "ambient music",
      model,
      duration: 10,
      seed: 999,
    });

    try {
      const ctx1 = createMusicContext(cacheDir1, model);
      const ctx2 = createMusicContext(cacheDir2, model);

      await renderMusic(music1, ctx1);
      await renderMusic(music2, ctx2);

      expect(seeds.length).toBe(2);
      expect(seeds).toContain(42);
      expect(seeds).toContain(999);
    } finally {
      cleanupTempDir(cacheDir1);
      cleanupTempDir(cacheDir2);
    }
  });
});
