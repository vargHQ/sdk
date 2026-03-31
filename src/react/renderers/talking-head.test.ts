import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3, SpeechModelV3 } from "@ai-sdk/provider";
import { withCache } from "../../ai-sdk/cache";
import { File } from "../../ai-sdk/file";
import { fileCache } from "../../ai-sdk/file-cache";
import { localBackend } from "../../ai-sdk/providers/editly";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import { Image, type Speech, TalkingHead } from "../elements";
import { ResolvedElement } from "../resolved-element";
import { renderClip } from "./clip";
import type { RenderContext } from "./context";
import { renderTalkingHead } from "./talking-head";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "varg-talking-head-test-"));
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
        images: [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])],
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
        videos: [new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70])],
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

type GenerateImageOptions = Parameters<RenderContext["generateImage"]>[0];
type GenerateVideoOptions = Parameters<RenderContext["generateVideo"]>[0];

function createContext(
  cacheDir: string,
  counters: { imageCalls: number; videoCalls: number; speechCalls: number },
): RenderContext {
  const storage = fileCache({ dir: cacheDir });

  const generateImage = withCache(
    async (_opts: GenerateImageOptions) => {
      counters.imageCalls += 1;
      return {
        images: [
          {
            uint8Array: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
            mimeType: "image/png",
          },
        ],
        warnings: [],
      };
    },
    { storage },
  );

  const generateVideo = withCache(
    async (_opts: GenerateVideoOptions) => {
      counters.videoCalls += 1;
      const data = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]);
      return {
        video: { uint8Array: data, mimeType: "video/mp4" },
        videos: [{ uint8Array: data, mimeType: "video/mp4" }],
        warnings: [],
      };
    },
    { storage },
  );

  return {
    width: 1080,
    height: 1920,
    fps: 30,
    cache: storage,
    generateImage: generateImage as unknown as RenderContext["generateImage"],
    generateVideo: generateVideo as unknown as RenderContext["generateVideo"],
    tempFiles: [],
    pendingFiles: new Map<string, Promise<File>>(),
    backend: localBackend,
    generatedFiles: [],
    defaults: {
      image: createImageModel(),
      video: createVideoModel(),
      speech: createSpeechModel(),
    },
  };
}

/** Helper: create a mock resolved image element */
function createResolvedImage(): ResolvedElement<"image"> {
  const mockFile = File.fromGenerated({
    uint8Array: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
    mediaType: "image/png",
  });
  return new ResolvedElement<"image">(
    { type: "image", props: { prompt: "test" }, children: [] },
    { file: mockFile, duration: 0 },
  );
}

/** Helper: create a mock resolved speech element */
function createResolvedSpeech(): ResolvedElement<"speech"> {
  const mockFile = File.fromGenerated({
    uint8Array: new Uint8Array([0xff, 0xfb, 0x90, 4, 5, 6]),
    mediaType: "audio/mpeg",
  });
  return new ResolvedElement<"speech">(
    { type: "speech", props: { voice: "rachel" }, children: ["Hello world!"] },
    { file: mockFile, duration: 3 },
  );
}

describe("TalkingHead element", () => {
  test("creates correct element structure with image/audio props", () => {
    const image = Image({
      prompt: "young woman, casual outfit",
      model: createImageModel(),
    });
    const element = TalkingHead({
      image,
      audio: createResolvedSpeech(),
      model: createVideoModel(),
    });

    expect(element.type).toBe("talking-head");
    expect(element.props.image).toBeDefined();
    expect(element.props.audio).toBeDefined();
  });

  test("is thenable (awaitable)", () => {
    const element = TalkingHead({
      image: createResolvedImage() as unknown as ReturnType<typeof Image>,
      audio: createResolvedSpeech() as unknown as ReturnType<typeof Speech>,
      model: createVideoModel(),
    });

    expect(typeof (element as any).then).toBe("function");
  });

  test("clip renderer handles pre-resolved TalkingHead element", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0, speechCalls: 0 };

    try {
      const ctx = createContext(cacheDir, counters);

      // Create a pre-resolved TalkingHead element (simulating `await TalkingHead(...)`)
      const mockVideoFile = File.fromGenerated({
        uint8Array: new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]),
        mediaType: "video/mp4",
      });

      const resolvedTalkingHead = new ResolvedElement<"talking-head">(
        {
          type: "talking-head",
          props: {
            image: createResolvedImage(),
            audio: createResolvedSpeech(),
          },
          children: [],
        },
        {
          file: mockVideoFile,
          duration: 5,
        },
      );

      // Use it inside a Clip
      const clip = {
        type: "clip" as const,
        props: { duration: 5 },
        children: [resolvedTalkingHead],
      };

      const result = await renderClip(clip as any, ctx);

      // The clip should contain a video layer
      expect(result.layers.length).toBeGreaterThan(0);
      expect(result.layers.some((l) => l.type === "video")).toBe(true);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });
});

describe("renderTalkingHead", () => {
  test("throws when no image prop provided", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0, speechCalls: 0 };

    try {
      const ctx = createContext(cacheDir, counters);
      const element = TalkingHead({
        audio: createResolvedSpeech() as unknown as ReturnType<typeof Speech>,
        model: createVideoModel(),
        // no image — should throw
      } as any);

      await expect(renderTalkingHead(element as any, ctx)).rejects.toThrow(
        "TalkingHead requires 'image' prop",
      );
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("throws when no audio prop provided", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0, speechCalls: 0 };

    try {
      const ctx = createContext(cacheDir, counters);
      const element = TalkingHead({
        image: createResolvedImage() as unknown as ReturnType<typeof Image>,
        model: createVideoModel(),
        // no audio — should throw
      } as any);

      await expect(renderTalkingHead(element as any, ctx)).rejects.toThrow(
        "TalkingHead requires 'audio' prop",
      );
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("throws when no model and no defaults.video", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0, speechCalls: 0 };

    try {
      const ctx = createContext(cacheDir, counters);
      // Remove defaults.video to test error
      ctx.defaults = { image: createImageModel(), speech: createSpeechModel() };

      const element = TalkingHead({
        image: createResolvedImage() as unknown as ReturnType<typeof Image>,
        audio: createResolvedSpeech() as unknown as ReturnType<typeof Speech>,
        // no model
      } as any);

      await expect(renderTalkingHead(element as any, ctx)).rejects.toThrow(
        "TalkingHead requires 'model' prop",
      );
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("renders with pre-resolved image and audio (skips generation)", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0, speechCalls: 0 };

    try {
      const ctx = createContext(cacheDir, counters);

      const resolvedImage = createResolvedImage();
      const resolvedSpeech = createResolvedSpeech();

      const element = TalkingHead({
        image: resolvedImage as unknown as ReturnType<typeof Image>,
        audio: resolvedSpeech as unknown as ReturnType<typeof Speech>,
        model: createVideoModel(),
      } as any);

      const result = await renderTalkingHead(element as any, ctx);

      // Should NOT have called generateImage (image was pre-resolved)
      expect(counters.imageCalls).toBe(0);
      // Should have called generateVideo (for lipsync)
      expect(counters.videoCalls).toBe(1);
      expect(result).toBeDefined();
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("renders with lazy (non-awaited) image element", async () => {
    const cacheDir = makeTempDir();
    const counters = { imageCalls: 0, videoCalls: 0, speechCalls: 0 };

    try {
      const ctx = createContext(cacheDir, counters);

      // Lazy image — not awaited, so it's a raw VargElement
      const lazyImage = Image({
        prompt: "young woman, casual outfit",
        model: createImageModel(),
      });

      const resolvedSpeech = createResolvedSpeech();

      const element = TalkingHead({
        image: lazyImage,
        audio: resolvedSpeech as unknown as ReturnType<typeof Speech>,
        model: createVideoModel(),
      } as any);

      const result = await renderTalkingHead(element as any, ctx);

      // Should have called generateImage (lazy image needed rendering)
      expect(counters.imageCalls).toBe(1);
      // Should have called generateVideo (for lipsync)
      expect(counters.videoCalls).toBe(1);
      expect(result).toBeDefined();
    } finally {
      cleanupTempDir(cacheDir);
    }
  });
});
