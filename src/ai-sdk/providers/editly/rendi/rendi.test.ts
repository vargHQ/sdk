import { describe, expect, test } from "bun:test";
import type { StorageProvider } from "../../../storage/types";
import { createRendiBackend } from ".";

const hasRendiKey = !!process.env.RENDI_API_KEY;

const mockStorage: StorageProvider = {
  async upload() {
    throw new Error("Mock storage - upload not expected in this test");
  },
};

/** Mock storage that accepts uploads and returns a predictable URL. */
const uploadableStorage: StorageProvider = {
  async upload(_data: Uint8Array, key: string) {
    return `https://mock-storage.test/${key}`;
  },
};

describe("rendi backend validation", () => {
  test("throws when inputs empty and no filterComplex", async () => {
    const backend = createRendiBackend({
      apiKey: "test-key",
      storage: mockStorage,
    });

    await expect(
      backend.run({
        inputs: [],
        outputArgs: ["-c:v", "libx264"],
        outputPath: "output.mp4",
      }),
    ).rejects.toThrow(
      "Rendi backend requires at least one input file or a filterComplex",
    );
  });

  test("throws when inputs undefined and no filterComplex", async () => {
    const backend = createRendiBackend({
      apiKey: "test-key",
      storage: mockStorage,
    });

    await expect(
      backend.run({
        inputs: undefined as unknown as string[],
        outputArgs: ["-c:v", "libx264"],
        outputPath: "output.mp4",
      }),
    ).rejects.toThrow(
      "Rendi backend requires at least one input file or a filterComplex",
    );
  });

  test("generates dummy input when inputs empty but filterComplex present", async () => {
    // The run() call will still fail at the Rendi API fetch (no real server),
    // but it should NOT throw the "requires at least one input" error.
    // It should get past the validation and fail at the network call.
    const backend = createRendiBackend({
      apiKey: "test-key",
      storage: uploadableStorage,
    });

    await expect(
      backend.run({
        inputs: [],
        filterComplex: "color=c=#1a1a2e:s=1080x1920:d=5:r=30[color0]",
        outputArgs: ["-map", "[color0]", "-c:v", "libx264"],
        outputPath: "output.mp4",
      }),
    ).rejects.toThrow(/Rendi submit failed|fetch/);
  });
});

describe.skipIf(!hasRendiKey)("rendi backend", () => {
  test("ffprobe remote file", async () => {
    const backend = createRendiBackend({ storage: mockStorage });
    const info = await backend.ffprobe(
      "https://storage.rendi.dev/sample/big_buck_bunny_720p_5sec_intro.mp4",
    );

    expect(info.duration).toBeGreaterThan(0);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
  }, 30000);

  test("run simple ffmpeg command", async () => {
    const backend = createRendiBackend({ storage: mockStorage });

    const result = await backend.run({
      inputs: [
        "https://storage.rendi.dev/sample/big_buck_bunny_720p_5sec_intro.mp4",
      ],
      outputArgs: ["-t", "2", "-c:v", "libx264", "-preset", "ultrafast"],
      outputPath: "output.mp4",
      verbose: true,
    });

    expect(result.output.type).toBe("url");
    if (result.output.type === "url") {
      expect(result.output.url).toMatch(/^https:\/\//);
    }
  }, 120000);
});
