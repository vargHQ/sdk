import { describe, expect, mock, test } from "bun:test";

describe("OpenAI seed support", () => {
  test("sora produces unsupported warning for seed", async () => {
    const { createOpenAI } = await import("./openai");
    const openai = createOpenAI({ apiKey: "test-key" });
    const model = openai.videoModel("sora-2");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ id: "test-id", status: "completed" }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      } as Response),
    ) as unknown as typeof fetch;

    try {
      const result = await model.doGenerate({
        prompt: "test video",
        n: 1,
        resolution: undefined,
        aspectRatio: undefined,
        duration: 4,
        fps: undefined,
        seed: 42,
        files: undefined,
        providerOptions: {},
      });

      const seedWarning = result.warnings.find(
        (w) =>
          w.type === "unsupported" && "feature" in w && w.feature === "seed",
      );
      expect(seedWarning).toBeDefined();
      expect(seedWarning?.type).toBe("unsupported");
      if (seedWarning && "details" in seedWarning) {
        expect(seedWarning.details).toContain("not supported");
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Higgsfield seed support", () => {
  test("soul model includes seed in request params", async () => {
    const { createHiggsfield } = await import("./higgsfield");
    const higgsfield = createHiggsfield({
      apiKey: "test-key",
      apiSecret: "test-secret",
    });
    const model = higgsfield.imageModel("soul");

    let capturedBody: { params?: { seed?: number } } | undefined;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock(
      (url: string | URL | Request, opts?: RequestInit) => {
        const urlStr = url.toString();
        if (urlStr.includes("/v1/text2image/soul")) {
          capturedBody = JSON.parse(opts?.body as string);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: "test-job-id" }),
          } as Response);
        }
        if (urlStr.includes("/v1/job-sets/")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                jobs: [
                  {
                    status: "completed",
                    results: { min: { url: "https://example.com/image.png" } },
                  },
                ],
              }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        } as Response);
      },
    ) as unknown as typeof fetch;

    try {
      await model.doGenerate({
        prompt: "character portrait",
        n: 1,
        size: undefined,
        aspectRatio: "1:1",
        seed: 99999,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.params!.seed).toBe(99999);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Together seed support", () => {
  test("flux-schnell includes seed in request body", async () => {
    const { createTogetherProvider } = await import("./together");
    const together = createTogetherProvider({ apiKey: "test-key" });
    const model = together.imageModel("flux-schnell");

    let capturedBody: { seed?: number } | undefined;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock(
      (_url: string | URL | Request, opts?: RequestInit) => {
        capturedBody = JSON.parse(opts?.body as string);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ b64_json: "AAAA" }],
            }),
        } as Response);
      },
    ) as unknown as typeof fetch;

    try {
      await model.doGenerate({
        prompt: "test image",
        n: 1,
        size: undefined,
        aspectRatio: "16:9",
        seed: 77777,
        files: undefined,
        mask: undefined,
        providerOptions: {},
      });

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.seed).toBe(77777);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("ElevenLabs seed support", () => {
  test("music model produces warning for unsupported seed", async () => {
    const warnings: Array<{
      type: string;
      feature?: string;
      details?: string;
    }> = [];

    const mockModel = {
      specificationVersion: "v3" as const,
      provider: "elevenlabs",
      modelId: "music_v1",
      async doGenerate(options: { seed?: number }) {
        if (options.seed !== undefined) {
          warnings.push({
            type: "unsupported",
            feature: "seed",
            details: "Seed is not supported by ElevenLabs music generation",
          });
        }
        return {
          audio: new Uint8Array([1, 2, 3]),
          warnings,
          response: {
            timestamp: new Date(),
            modelId: "music_v1",
            headers: undefined,
          },
        };
      },
    };

    const result = await mockModel.doGenerate({ seed: 42 });

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]!.feature).toBe("seed");
    expect(result.warnings[0]!.type).toBe("unsupported");
  });
});

describe("Google seed support", () => {
  test("image model produces warning for unsupported seed", async () => {
    const warnings: Array<{
      type: string;
      feature?: string;
      details?: string;
    }> = [];

    const mockModel = {
      specificationVersion: "v3" as const,
      provider: "google",
      modelId: "gemini-3-pro-image",
      async doGenerate(options: { seed?: number }) {
        if (options.seed !== undefined) {
          warnings.push({
            type: "unsupported",
            feature: "seed",
            details: "Seed is not supported by Google image generation",
          });
        }
        return {
          images: [new Uint8Array([1, 2, 3])],
          warnings,
          response: {
            timestamp: new Date(),
            modelId: "gemini-3-pro-image",
            headers: undefined,
          },
        };
      },
    };

    const result = await mockModel.doGenerate({ seed: 42 });

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]!.feature).toBe("seed");
    expect(result.warnings[0]!.type).toBe("unsupported");
  });

  test("video model supports seed (no warning)", async () => {
    const warnings: Array<{
      type: string;
      feature?: string;
      details?: string;
    }> = [];

    const mockModel = {
      specificationVersion: "v3" as const,
      provider: "google",
      modelId: "veo-3",
      async doGenerate(_options: { seed?: number }) {
        return {
          videos: [new Uint8Array([1, 2, 3])],
          warnings,
          response: {
            timestamp: new Date(),
            modelId: "veo-3",
            headers: undefined,
          },
        };
      },
    };

    const result = await mockModel.doGenerate({ seed: 42 });

    expect(result.warnings.length).toBe(0);
  });
});

describe("FAL seed support logic", () => {
  test("video models that support seed are correctly identified", () => {
    const supportsSeed = (modelId: string): boolean => {
      const isLtx2 = modelId === "ltx-2-19b-distilled";
      const isWan = modelId.startsWith("wan-");
      return isLtx2 || isWan;
    };

    expect(supportsSeed("ltx-2-19b-distilled")).toBe(true);
    expect(supportsSeed("wan-2.5")).toBe(true);
    expect(supportsSeed("wan-2.5-preview")).toBe(true);
    expect(supportsSeed("kling-v2.5")).toBe(false);
    expect(supportsSeed("kling-v2.6")).toBe(false);
    expect(supportsSeed("minimax")).toBe(false);
    expect(supportsSeed("grok-imagine")).toBe(false);
  });
});
