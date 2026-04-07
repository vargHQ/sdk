import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3, SpeechModelV3 } from "@ai-sdk/provider";
import { withCache } from "../../ai-sdk/cache";
import type { File } from "../../ai-sdk/file";
import { fileCache } from "../../ai-sdk/file-cache";
import type { MusicModelV3 } from "../../ai-sdk/music-model";
import { localBackend } from "../../ai-sdk/providers/editly";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import { Image, Music, Speech, Video } from "../elements";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderMusic } from "./music";
import { renderSpeech } from "./speech";
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

function createSpeechModel(): SpeechModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-speech",
    async doGenerate() {
      return {
        audio: new Uint8Array([0xff, 0xfb, 0x90, 4, 5, 6]),
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-speech",
          headers: undefined,
        },
      };
    },
  };
}

function createMusicModel(): MusicModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-music",
    async doGenerate() {
      return {
        audio: new Uint8Array([0xff, 0xfb, 0x90, 7, 8, 9]),
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

type GenerateImageOptions = Parameters<RenderContext["generateImage"]>[0];
type GenerateVideoOptions = Parameters<RenderContext["generateVideo"]>[0];
type GenerateSpeechOptions = Parameters<RenderContext["generateSpeech"]>[0];
type GenerateMusicOptions = Parameters<RenderContext["generateMusic"]>[0];

interface Counters {
  imageCalls: number;
  videoCalls: number;
  speechCalls: number;
  musicCalls: number;
}

function createContext(cacheDir: string, counters: Counters): RenderContext {
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

  const generateSpeech = withCache(async (_opts: GenerateSpeechOptions) => {
    counters.speechCalls += 1;
    return {
      audio: { uint8Array: new Uint8Array([0xff, 0xfb, 0x90, 4, 5, 6]) },
      warnings: [],
      responses: [],
      providerMetadata: {},
    };
  });

  const generateMusic = withCache(async (_opts: GenerateMusicOptions) => {
    counters.musicCalls += 1;
    return {
      audio: { uint8Array: new Uint8Array([0xff, 0xfb, 0x90, 7, 8, 9]) },
      warnings: [],
      response: {
        timestamp: new Date(),
        modelId: "test-music",
        headers: undefined,
      },
    };
  });

  return {
    width: 1080,
    height: 1920,
    fps: 30,
    cache: storage,
    generateImage: generateImage as unknown as RenderContext["generateImage"],
    generateVideo: generateVideo as unknown as RenderContext["generateVideo"],
    generateSpeech:
      generateSpeech as unknown as RenderContext["generateSpeech"],
    generateMusic: generateMusic as unknown as RenderContext["generateMusic"],
    tempFiles: [],
    pendingFiles: new Map<string, Promise<File>>(),
    backend: localBackend,
    generatedFiles: [],
  };
}

function zeroCounters(): Counters {
  return { imageCalls: 0, videoCalls: 0, speechCalls: 0, musicCalls: 0 };
}

describe("render cache behavior", () => {
  test("reuses cached video across separate contexts when only trim/layout differ", async () => {
    const cacheDir = makeTempDir();
    const counters = zeroCounters();

    const model = createVideoModel();

    const base = Video({
      prompt: "walk forward",
      model,
      aspectRatio: "9:16",
    });

    const variant = Video({
      prompt: "walk forward",
      model,
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
    const counters = zeroCounters();

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

  test("reuses cached speech across separate contexts when only volume/id differ", async () => {
    const cacheDir = makeTempDir();
    const counters = zeroCounters();

    const speechModel = createSpeechModel();

    const base = Speech({
      children: "Hello, welcome to the show!",
      model: speechModel,
      voice: "rachel",
    });

    // volume and id are excluded from cache key (IGNORED_PROPS_BY_TYPE)
    const variant = Speech({
      children: "Hello, welcome to the show!",
      model: speechModel,
      voice: "rachel",
      volume: 0.5,
      id: "intro-speech",
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderSpeech(base, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderSpeech(variant, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.speechCalls).toBe(1);
  });

  test("does not reuse cached speech when text differs", async () => {
    const cacheDir = makeTempDir();
    const counters = zeroCounters();

    const speechModel = createSpeechModel();

    const first = Speech({
      children: "Hello, welcome!",
      model: speechModel,
      voice: "rachel",
    });

    const second = Speech({
      children: "Goodbye, see you later!",
      model: speechModel,
      voice: "rachel",
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderSpeech(first, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderSpeech(second, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.speechCalls).toBe(2);
  });

  test("does not reuse cached speech when voice differs", async () => {
    const cacheDir = makeTempDir();
    const counters = zeroCounters();

    const speechModel = createSpeechModel();

    const first = Speech({
      children: "Same text here",
      model: speechModel,
      voice: "rachel",
    });

    const second = Speech({
      children: "Same text here",
      model: speechModel,
      voice: "josh",
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderSpeech(first, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderSpeech(second, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.speechCalls).toBe(2);
  });

  test("reuses cached music across separate contexts with identical params", async () => {
    const cacheDir = makeTempDir();
    const counters = zeroCounters();

    const musicModel = createMusicModel();

    const base = Music({
      prompt: "upbeat electronic track",
      model: musicModel,
      duration: 30,
    });

    // Same prompt/model/duration — should hit cache
    const duplicate = Music({
      prompt: "upbeat electronic track",
      model: musicModel,
      duration: 30,
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderMusic(base, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderMusic(duplicate, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.musicCalls).toBe(1);
  });

  test("does not reuse cached music when prompt differs", async () => {
    const cacheDir = makeTempDir();
    const counters = zeroCounters();

    const musicModel = createMusicModel();

    const first = Music({
      prompt: "upbeat electronic track",
      model: musicModel,
    });

    const second = Music({
      prompt: "calm piano melody",
      model: musicModel,
    });

    try {
      const ctx1 = createContext(cacheDir, counters);
      await renderMusic(first, ctx1);

      const ctx2 = createContext(cacheDir, counters);
      await renderMusic(second, ctx2);
    } finally {
      cleanupTempDir(cacheDir);
    }

    expect(counters.musicCalls).toBe(2);
  });
});
