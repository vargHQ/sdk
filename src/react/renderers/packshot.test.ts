import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import { withCache } from "../../ai-sdk/cache";
import type { File } from "../../ai-sdk/file";
import { fileCache } from "../../ai-sdk/file-cache";
import { localBackend } from "../../ai-sdk/providers/editly";
import { Image, Packshot } from "../elements";
import type { RenderContext } from "./context";
import { renderPackshot } from "./packshot";

// Valid 4x4 red PNG generated via sharp — ffmpeg can decode this
// prettier-ignore
const PNG_4x4 = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 4, 0,
  0, 0, 4, 8, 2, 0, 0, 0, 38, 147, 9, 41, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 3,
  232, 0, 0, 3, 232, 1, 181, 123, 82, 107, 0, 0, 0, 17, 73, 68, 65, 84, 120,
  156, 99, 248, 207, 192, 0, 71, 8, 22, 94, 14, 0, 174, 147, 15, 241, 166, 148,
  72, 35, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "varg-packshot-test-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

/** Write a minimal valid PNG file and return its path. */
function createTestPng(dir: string, name = "test-logo.png"): string {
  const path = join(dir, name);
  writeFileSync(path, PNG_4x4);
  return path;
}

function createImageModel(): ImageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate() {
      return {
        images: [PNG_4x4],
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

type GenerateImageOptions = Parameters<RenderContext["generateImage"]>[0];
type GenerateVideoOptions = Parameters<RenderContext["generateVideo"]>[0];

function createContext(
  cacheDir: string,
  counters: { imageCalls: number },
): RenderContext {
  const storage = fileCache({ dir: cacheDir });

  const generateImage = withCache(async (_opts: GenerateImageOptions) => {
    counters.imageCalls += 1;
    return {
      images: [
        {
          uint8Array: PNG_4x4,
          mimeType: "image/png",
        },
      ],
      warnings: [],
    };
  });

  const generateVideo = withCache(async (_opts: GenerateVideoOptions) => {
    const data = new Uint8Array([0]);
    return {
      video: { uint8Array: data, mimeType: "video/mp4" },
      videos: [{ uint8Array: data, mimeType: "video/mp4" }],
      warnings: [],
    };
  });

  return {
    width: 64,
    height: 64,
    fps: 1,
    cache: storage,
    generateImage: generateImage as unknown as RenderContext["generateImage"],
    generateVideo: generateVideo as unknown as RenderContext["generateVideo"],
    generateSpeech: (async () => {
      throw new Error("generateSpeech not implemented in test");
    }) as unknown as RenderContext["generateSpeech"],
    generateMusic: (async () => {
      throw new Error("generateMusic not implemented in test");
    }) as unknown as RenderContext["generateMusic"],
    tempFiles: [],
    pendingFiles: new Map<string, Promise<File>>(),
    backend: localBackend,
    generatedFiles: [],
  };
}

describe("renderPackshot", () => {
  test(
    "renders with string logo URL",
    async () => {
      const cacheDir = makeTempDir();
      const counters = { imageCalls: 0 };

      try {
        const logoPath = createTestPng(cacheDir);
        const ctx = createContext(cacheDir, counters);

        const element = Packshot({
          background: "#000000",
          logo: logoPath,
          duration: 1,
        });

        const result = await renderPackshot(element, ctx);

        expect(typeof result).toBe("string");
        expect(existsSync(result)).toBe(true);
        // No AI generation needed for a string logo path
        expect(counters.imageCalls).toBe(0);
      } finally {
        cleanupTempDir(cacheDir);
      }
    },
    { timeout: 30_000 },
  );

  test(
    "renders with VargElement<image> logo",
    async () => {
      const cacheDir = makeTempDir();
      const counters = { imageCalls: 0 };
      const imageModel = createImageModel();

      try {
        const ctx = createContext(cacheDir, counters);

        const logo = Image({
          prompt: "test logo",
          model: imageModel,
          aspectRatio: "1:1",
        });

        const element = Packshot({
          background: "#000000",
          logo: logo,
          duration: 1,
        });

        const result = await renderPackshot(element, ctx);

        expect(typeof result).toBe("string");
        expect(existsSync(result)).toBe(true);
        // generateImage should have been called once for the logo
        expect(counters.imageCalls).toBe(1);
      } finally {
        cleanupTempDir(cacheDir);
      }
    },
    { timeout: 30_000 },
  );

  test(
    "renders with VargElement<image> background and VargElement<image> logo",
    async () => {
      const cacheDir = makeTempDir();
      const counters = { imageCalls: 0 };
      const imageModel = createImageModel();

      try {
        const ctx = createContext(cacheDir, counters);

        const bg = Image({
          prompt: "background image",
          model: imageModel,
          aspectRatio: "1:1",
        });

        const logo = Image({
          prompt: "logo image",
          model: imageModel,
          aspectRatio: "1:1",
        });

        const element = Packshot({
          background: bg,
          logo: logo,
          duration: 1,
        });

        const result = await renderPackshot(element, ctx);

        expect(typeof result).toBe("string");
        expect(existsSync(result)).toBe(true);
        // Two generateImage calls: one for background, one for logo
        expect(counters.imageCalls).toBe(2);
      } finally {
        cleanupTempDir(cacheDir);
      }
    },
    { timeout: 30_000 },
  );

  test(
    "renders without logo",
    async () => {
      const cacheDir = makeTempDir();
      const counters = { imageCalls: 0 };

      try {
        const ctx = createContext(cacheDir, counters);

        const element = Packshot({
          background: "#FF0000",
          duration: 1,
        });

        const result = await renderPackshot(element, ctx);

        expect(typeof result).toBe("string");
        expect(existsSync(result)).toBe(true);
        expect(counters.imageCalls).toBe(0);
      } finally {
        cleanupTempDir(cacheDir);
      }
    },
    { timeout: 30_000 },
  );

  test(
    "throws on invalid logo type",
    async () => {
      const cacheDir = makeTempDir();
      const counters = { imageCalls: 0 };

      try {
        const ctx = createContext(cacheDir, counters);

        const element = Packshot({
          background: "#000000",
          logo: 12345 as unknown as string,
          duration: 1,
        });

        await expect(renderPackshot(element, ctx)).rejects.toThrow();
      } finally {
        cleanupTempDir(cacheDir);
      }
    },
    { timeout: 30_000 },
  );
});
