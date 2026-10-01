import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { calculateIdeogramV45Cost } from "../../definitions/models/ideogram-v4-5";
import {
  applyImageFileInputs,
  computeFileHashes,
  computePendingKey,
  resolveImageEndpoint,
  supportsImageAcceleration,
} from "./fal";

const TEST_PENDING_DIR = ".cache/fal-pending-test";

describe("fal queue recovery", () => {
  beforeEach(() => {
    if (existsSync(TEST_PENDING_DIR)) {
      rmSync(TEST_PENDING_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_PENDING_DIR)) {
      rmSync(TEST_PENDING_DIR, { recursive: true });
    }
  });

  describe("computePendingKey", () => {
    test("produces same key for same endpoint and input", () => {
      const endpoint = "fal-ai/flux-schnell";
      const input = { prompt: "a cat", num_images: 1 };

      const key1 = computePendingKey(endpoint, input);
      const key2 = computePendingKey(endpoint, input);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^pending_[a-f0-9]+$/);
    });

    test("produces different keys for different inputs", () => {
      const endpoint = "fal-ai/flux-schnell";

      const key1 = computePendingKey(endpoint, { prompt: "a cat" });
      const key2 = computePendingKey(endpoint, { prompt: "a dog" });

      expect(key1).not.toBe(key2);
    });

    test("uses stableKey when provided", () => {
      const endpoint = "fal-ai/flux-schnell";
      const input1 = { prompt: "test", image_urls: ["https://fal.media/abc"] };
      const input2 = { prompt: "test", image_urls: ["https://fal.media/xyz"] };
      const stableKey = "stable-key-from-file-hashes";

      const key1 = computePendingKey(endpoint, input1, stableKey);
      const key2 = computePendingKey(endpoint, input2, stableKey);

      expect(key1).toBe(key2);
    });

    test("without stableKey, different image_urls produce different keys", () => {
      const endpoint = "fal-ai/flux-schnell";
      const input1 = { prompt: "test", image_urls: ["https://fal.media/abc"] };
      const input2 = { prompt: "test", image_urls: ["https://fal.media/xyz"] };

      const key1 = computePendingKey(endpoint, input1);
      const key2 = computePendingKey(endpoint, input2);

      expect(key1).not.toBe(key2);
    });
  });

  describe("computeFileHashes", () => {
    test("returns empty array for undefined files", async () => {
      const hashes = await computeFileHashes(undefined);
      expect(hashes).toEqual([]);
    });

    test("returns empty array for empty files", async () => {
      const hashes = await computeFileHashes([]);
      expect(hashes).toEqual([]);
    });

    test("returns URL as-is for url type files", async () => {
      const files = [
        { type: "url" as const, url: "https://example.com/image.png" },
      ];
      const hashes = await computeFileHashes(files);
      expect(hashes).toEqual(["https://example.com/image.png"]);
    });

    test("produces stable hash for same file bytes", async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const files = [
        { type: "file" as const, data: bytes, mediaType: "image/png" },
      ];

      const hashes1 = await computeFileHashes(files);
      const hashes2 = await computeFileHashes(files);

      expect(hashes1).toEqual(hashes2);
      expect(hashes1[0]).toMatch(/^[a-f0-9]+$/);
    });

    test("produces different hashes for different bytes", async () => {
      const files1 = [
        {
          type: "file" as const,
          data: new Uint8Array([1, 2, 3]),
          mediaType: "image/png",
        },
      ];
      const files2 = [
        {
          type: "file" as const,
          data: new Uint8Array([4, 5, 6]),
          mediaType: "image/png",
        },
      ];

      const hashes1 = await computeFileHashes(files1);
      const hashes2 = await computeFileHashes(files2);

      expect(hashes1[0]).not.toBe(hashes2[0]);
    });

    test("handles base64 encoded data", async () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const base64 = btoa(String.fromCharCode(...bytes));
      const files = [
        { type: "file" as const, data: base64, mediaType: "image/png" },
      ];

      const hashes = await computeFileHashes(files);
      expect(hashes[0]).toMatch(/^[a-f0-9]+$/);
    });

    test("same bytes as Uint8Array and base64 produce same hash", async () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]);
      const base64 = btoa(String.fromCharCode(...bytes));

      const filesBytes = [
        { type: "file" as const, data: bytes, mediaType: "image/png" },
      ];
      const filesBase64 = [
        { type: "file" as const, data: base64, mediaType: "image/png" },
      ];

      const hashesBytes = await computeFileHashes(filesBytes);
      const hashesBase64 = await computeFileHashes(filesBase64);

      expect(hashesBytes[0]).toBe(hashesBase64[0]);
    });
  });

  describe("stable key integration", () => {
    test("same file bytes produce same stable key across runs", async () => {
      const endpoint = "fal-ai/nano-banana-pro/edit";
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const files = [
        { type: "file" as const, data: bytes, mediaType: "image/png" },
      ];

      const fileHashes = await computeFileHashes(files);
      const input = { prompt: "test prompt", num_images: 1 };
      const stableKey = JSON.stringify({ endpoint, input, fileHashes });

      const inputWithUrl1 = {
        ...input,
        image_urls: ["https://fal.media/upload1"],
      };
      const inputWithUrl2 = {
        ...input,
        image_urls: ["https://fal.media/upload2"],
      };

      const key1 = computePendingKey(endpoint, inputWithUrl1, stableKey);
      const key2 = computePendingKey(endpoint, inputWithUrl2, stableKey);

      expect(key1).toBe(key2);
    });

    test("different file bytes produce different stable keys", async () => {
      const endpoint = "fal-ai/nano-banana-pro/edit";
      const input = { prompt: "test prompt", num_images: 1 };

      const files1 = [
        {
          type: "file" as const,
          data: new Uint8Array([1, 2, 3]),
          mediaType: "image/png",
        },
      ];
      const files2 = [
        {
          type: "file" as const,
          data: new Uint8Array([4, 5, 6]),
          mediaType: "image/png",
        },
      ];

      const hashes1 = await computeFileHashes(files1);
      const hashes2 = await computeFileHashes(files2);

      const stableKey1 = JSON.stringify({
        endpoint,
        input,
        fileHashes: hashes1,
      });
      const stableKey2 = JSON.stringify({
        endpoint,
        input,
        fileHashes: hashes2,
      });

      const key1 = computePendingKey(endpoint, input, stableKey1);
      const key2 = computePendingKey(endpoint, input, stableKey2);

      expect(key1).not.toBe(key2);
    });
  });
});

describe("ideogram v4.5 wiring", () => {
  test("aliases and canonical id resolve to fal endpoints", () => {
    expect(resolveImageEndpoint("ideogram-v4-5")).toBe("ideogram/v4.5");
    expect(resolveImageEndpoint("ideogram_v4_5")).toBe("ideogram/v4.5");
    expect(resolveImageEndpoint("ideogram-v4-5/edit")).toBe(
      "ideogram/v4.5/edit",
    );
    expect(resolveImageEndpoint("ideogram/v4.5")).toBe("ideogram/v4.5");
  });

  test("files auto-route the t2i id to /edit", () => {
    expect(resolveImageEndpoint("ideogram-v4-5", true)).toBe(
      "ideogram/v4.5/edit",
    );
    expect(resolveImageEndpoint("ideogram_v4_5", true)).toBe(
      "ideogram/v4.5/edit",
    );
    expect(resolveImageEndpoint("ideogram/v4.5", true)).toBe(
      "ideogram/v4.5/edit",
    );
    expect(resolveImageEndpoint("raw:ideogram/v4.5", true)).toBe(
      "ideogram/v4.5",
    );
  });

  test("no acceleration field (strict fal schema)", () => {
    expect(supportsImageAcceleration("ideogram-v4-5")).toBe(false);
    expect(supportsImageAcceleration("ideogram/v4.5/edit")).toBe(false);
    expect(supportsImageAcceleration("flux-schnell")).toBe(true);
  });

  test("files → image_url + reference_image_urls", () => {
    const one: Record<string, unknown> = {};
    applyImageFileInputs("ideogram-v4-5/edit", one, ["a"]);
    expect(one).toEqual({ image_url: "a" });

    const three: Record<string, unknown> = {};
    applyImageFileInputs("ideogram-v4-5", three, ["a", "b", "c"]);
    expect(three).toEqual({ image_url: "a", reference_image_urls: ["b", "c"] });
  });

  test("more than 4 references throws before submitting", () => {
    expect(() =>
      applyImageFileInputs("ideogram-v4-5/edit", {}, [
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
      ]),
    ).toThrow(/up to 4 references/);
  });

  test("other models keep their layout", () => {
    const multi: Record<string, unknown> = {};
    applyImageFileInputs("nano-banana-pro/edit", multi, ["a", "b"]);
    expect(multi).toEqual({ image_urls: ["a", "b"] });

    const single: Record<string, unknown> = {};
    applyImageFileInputs("reve/edit", single, ["a", "b"]);
    expect(single).toEqual({ image_url: "a" });
  });

  test("pricing by quality × num_images", () => {
    expect(calculateIdeogramV45Cost({})).toBeCloseTo(0.06);
    expect(
      calculateIdeogramV45Cost({ providerOptions: { quality: "very_low" } }),
    ).toBeCloseTo(0.008);
    expect(
      calculateIdeogramV45Cost({
        numImages: 8,
        providerOptions: { quality: "high" },
      }),
    ).toBeCloseTo(1.76);
  });
});
