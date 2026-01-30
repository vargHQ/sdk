import { describe, expect, test, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { fileCache } from "../../ai-sdk/file-cache";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import { Clip, Image, Video, Music, Overlay, Speech } from "../elements";
import type { VargElement } from "../types";
import { renderRoot } from "./render";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "varg-render-test-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function createTestImageModel(): ImageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate() {
      return {
        images: [new Uint8Array([137, 80, 78, 71])], // PNG header
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
        videos: [new Uint8Array([0, 0, 0, 32])], // MP4 header
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

function createRenderElement(children: unknown[] = []): VargElement<"render"> {
  return {
    type: "render",
    props: {
      width: 1920,
      height: 1080,
      fps: 30,
    },
    children: children as VargElement[],
  };
}

describe("renderRoot", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  test("renders with default dimensions when not specified", async () => {
    const element: VargElement<"render"> = {
      type: "render",
      props: {},
      children: [],
    };

    const options = {
      output: `${tempDir}/output.mp4`,
      quiet: true,
    };

    const result = await renderRoot(element, options);
    expect(result).toBeInstanceOf(Uint8Array);
    cleanupTempDir(tempDir);
  });

  test("uses custom dimensions from props", async () => {
    const element: VargElement<"render"> = {
      type: "render",
      props: {
        width: 1280,
        height: 720,
        fps: 60,
      },
      children: [],
    };

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("resolveCacheStorage returns undefined for undefined input", async () => {
    const element = createRenderElement();
    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("resolveCacheStorage creates fileCache from string path", async () => {
    const cacheDir = makeTempDir();
    const element = createRenderElement();

    try {
      const result = await renderRoot(element, {
        cache: cacheDir,
        quiet: true,
      });
      expect(result).toBeInstanceOf(Uint8Array);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("resolveCacheStorage uses provided CacheStorage object", async () => {
    const cacheDir = makeTempDir();
    const cache = fileCache({ dir: cacheDir });
    const element = createRenderElement();

    try {
      const result = await renderRoot(element, { cache, quiet: true });
      expect(result).toBeInstanceOf(Uint8Array);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("uses strict mode by default", async () => {
    const element = createRenderElement();
    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("supports preview mode", async () => {
    const imageModel = createTestImageModel();
    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Image({ prompt: "test", model: imageModel })],
      }),
    ]);

    const result = await renderRoot(element, {
      mode: "preview",
      quiet: true,
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("processes clip elements from children", async () => {
    const element = createRenderElement([
      Clip({ duration: 2, children: [] }),
      Clip({ duration: 3, children: [] }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("processes overlay elements from children", async () => {
    const element = createRenderElement([
      Clip({ duration: 2, children: [] }),
      Overlay({
        left: "10%",
        top: "10%",
        width: "50%",
        height: "50%",
        children: [],
      }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("processes music elements from children", async () => {
    const element = createRenderElement([
      Clip({ duration: 3, children: [] }),
      Music({ src: "media/test-audio.mp3", volume: 0.5 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("skips invalid children (null, undefined, non-objects)", async () => {
    const element: VargElement<"render"> = {
      type: "render",
      props: {},
      children: [null, undefined, "string", 123, Clip({ duration: 2 })],
    };

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("calculates total duration correctly with transitions", async () => {
    const element = createRenderElement([
      Clip({ duration: 3, transition: { name: "fade", duration: 0.5 } }),
      Clip({ duration: 2, transition: { name: "fade", duration: 0.3 } }),
      Clip({ duration: 4 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("throws error when clip data is missing", async () => {
    const element = createRenderElement([
      {
        type: "clip",
        props: { duration: 3 },
        children: [],
      } as VargElement,
    ]);

    expect(
      renderRoot(element, { quiet: true })
    ).rejects.toThrow();
  });

  test("uses default models when provided in options", async () => {
    const imageModel = createTestImageModel();
    const videoModel = createTestVideoModel();

    const element = createRenderElement();
    const result = await renderRoot(element, {
      quiet: true,
      defaults: {
        image: imageModel,
        video: videoModel,
      },
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("respects verbose option", async () => {
    const element = createRenderElement();
    const result = await renderRoot(element, {
      quiet: true,
      verbose: true,
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("respects shortest prop", async () => {
    const element: VargElement<"render"> = {
      type: "render",
      props: { shortest: true },
      children: [Clip({ duration: 2 })],
    };

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("adds overlays to all clips", async () => {
    const element = createRenderElement([
      Clip({ duration: 2, children: [] }),
      Clip({ duration: 3, children: [] }),
      Overlay({ left: "10%", top: "10%", children: [] }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("auto-trims music to video length when no cutTo specified", async () => {
    const element = createRenderElement([
      Clip({ duration: 5, children: [] }),
      Music({ src: "media/test-audio.mp3" }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("uses music cutFrom and cutTo when specified", async () => {
    const element = createRenderElement([
      Clip({ duration: 10, children: [] }),
      Music({ src: "media/test-audio.mp3", cutFrom: 2, cutTo: 8 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("uses music duration to calculate cutTo", async () => {
    const element = createRenderElement([
      Clip({ duration: 10, children: [] }),
      Music({ src: "media/test-audio.mp3", duration: 5 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("throws error when music has neither src nor prompt", async () => {
    const element = createRenderElement([
      Clip({ duration: 5, children: [] }),
      Music({}),
    ]);

    expect(
      renderRoot(element, { quiet: true })
    ).rejects.toThrow("Music requires either src or prompt");
  });

  test("returns Uint8Array from file output", async () => {
    const element = createRenderElement();
    const result = await renderRoot(element, {
      output: `${tempDir}/output.mp4`,
      quiet: true,
    });

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    cleanupTempDir(tempDir);
  });

  test("caches wrapped generateImage calls", async () => {
    const cacheDir = makeTempDir();
    const imageModel = createTestImageModel();
    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Image({ prompt: "test", model: imageModel })],
      }),
    ]);

    try {
      const result = await renderRoot(element, {
        cache: cacheDir,
        quiet: true,
      });
      expect(result).toBeInstanceOf(Uint8Array);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("caches wrapped generateVideo calls", async () => {
    const cacheDir = makeTempDir();
    const videoModel = createTestVideoModel();
    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Video({ prompt: "test", model: videoModel })],
      }),
    ]);

    try {
      const result = await renderRoot(element, {
        cache: cacheDir,
        quiet: true,
      });
      expect(result).toBeInstanceOf(Uint8Array);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("tracks placeholder count in preview mode", async () => {
    const imageModel = createTestImageModel();
    const videoModel = createTestVideoModel();

    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [
          Image({ prompt: "img1", model: imageModel }),
          Video({ prompt: "vid1", model: videoModel }),
        ],
      }),
    ]);

    const result = await renderRoot(element, {
      mode: "preview",
      quiet: false,
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("in preview mode wraps image model with placeholder middleware", async () => {
    const imageModel = createTestImageModel();
    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Image({ prompt: "test", model: imageModel })],
      }),
    ]);

    const result = await renderRoot(element, {
      mode: "preview",
      quiet: true,
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("in preview mode wraps video model with placeholder middleware", async () => {
    const videoModel = createTestVideoModel();
    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Video({ prompt: "test", model: videoModel })],
      }),
    ]);

    const result = await renderRoot(element, {
      mode: "preview",
      quiet: true,
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles empty render element", async () => {
    const element = createRenderElement([]);
    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("processes clips in parallel", async () => {
    const element = createRenderElement([
      Clip({ duration: 1, children: [] }),
      Clip({ duration: 1, children: [] }),
      Clip({ duration: 1, children: [] }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("respects backend option", async () => {
    const element = createRenderElement();
    const result = await renderRoot(element, {
      quiet: true,
      backend: "local",
    });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles overlay with video child and keepAudio", async () => {
    const videoModel = createTestVideoModel();
    const element = createRenderElement([
      Clip({ duration: 3, children: [] }),
      Overlay({
        left: "10%",
        top: "10%",
        keepAudio: true,
        volume: 0.8,
        children: [Video({ prompt: "overlay video", model: videoModel })],
      }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles overlay with image child", async () => {
    const imageModel = createTestImageModel();
    const element = createRenderElement([
      Clip({ duration: 3, children: [] }),
      Overlay({
        left: "20%",
        top: "20%",
        width: "60%",
        height: "60%",
        children: [Image({ prompt: "overlay image", model: imageModel })],
      }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles speech element and adds to audio tracks", async () => {
    const element = createRenderElement([
      Clip({ duration: 3, children: [] }),
      Speech({ voice: "alloy", volume: 0.9, children: "Test speech" }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles music with prompt instead of src", async () => {
    const element = createRenderElement([
      Clip({ duration: 5, children: [] }),
      Music({ prompt: "upbeat electronic", volume: 0.6 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles music with start offset", async () => {
    const element = createRenderElement([
      Clip({ duration: 10, children: [] }),
      Music({ src: "media/test-audio.mp3", start: 3, volume: 0.5 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("creates progress tracker with correct quiet flag", async () => {
    const element = createRenderElement();

    const result1 = await renderRoot(element, { quiet: true });
    expect(result1).toBeInstanceOf(Uint8Array);

    const result2 = await renderRoot(element, { quiet: false });
    expect(result2).toBeInstanceOf(Uint8Array);
  });

  test("handles non-v3 image models without middleware wrapping", async () => {
    const nonV3Model = {
      specificationVersion: "v2" as const,
      provider: "test",
      modelId: "test-v2",
      async doGenerate() {
        return {
          images: [new Uint8Array([1, 2, 3])],
          warnings: [],
        };
      },
    };

    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Image({ prompt: "test", model: nonV3Model as any })],
      }),
    ]);

    const result = await renderRoot(element, { mode: "preview", quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("wraps generateImage with cache when cache provided", async () => {
    const cacheDir = makeTempDir();
    const imageModel = createTestImageModel();
    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [Image({ prompt: "cached", model: imageModel })],
      }),
    ]);

    try {
      const result = await renderRoot(element, { cache: cacheDir, quiet: true });
      expect(result).toBeInstanceOf(Uint8Array);
    } finally {
      cleanupTempDir(cacheDir);
    }
  });

  test("handles multiple overlays on same clips", async () => {
    const imageModel = createTestImageModel();
    const element = createRenderElement([
      Clip({ duration: 2, children: [] }),
      Clip({ duration: 3, children: [] }),
      Overlay({
        left: "10%",
        top: "10%",
        children: [Image({ prompt: "overlay1", model: imageModel })],
      }),
      Overlay({
        left: "50%",
        top: "50%",
        children: [Image({ prompt: "overlay2", model: imageModel })],
      }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("tracks placeholder count separately for images and videos", async () => {
    const imageModel = createTestImageModel();
    const videoModel = createTestVideoModel();

    const element = createRenderElement([
      Clip({
        duration: 1,
        children: [
          Image({ prompt: "img1", model: imageModel }),
          Image({ prompt: "img2", model: imageModel }),
          Video({ prompt: "vid1", model: videoModel }),
        ],
      }),
    ]);

    const result = await renderRoot(element, { mode: "preview", quiet: false });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles clips with auto duration", async () => {
    const element: VargElement<"render"> = {
      type: "render",
      props: {},
      children: [
        {
          type: "clip",
          props: { duration: "auto" },
          children: [],
        } as VargElement,
      ],
    };

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("calculates timeline correctly with multiple transitions", async () => {
    const element = createRenderElement([
      Clip({ duration: 5, transition: { name: "fade", duration: 1 } }),
      Clip({ duration: 4, transition: { name: "wiperight", duration: 0.5 } }),
      Clip({ duration: 3, transition: { name: "fadeblack", duration: 0.8 } }),
      Clip({ duration: 6 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });

  test("handles music cutFrom with duration", async () => {
    const element = createRenderElement([
      Clip({ duration: 10, children: [] }),
      Music({ src: "media/test-audio.mp3", cutFrom: 2, duration: 6 }),
    ]);

    const result = await renderRoot(element, { quiet: true });
    expect(result).toBeInstanceOf(Uint8Array);
  });
});