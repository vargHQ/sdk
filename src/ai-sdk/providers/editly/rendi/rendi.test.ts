import { describe, expect, test } from "bun:test";
import type { StorageProvider } from "../../../storage/types";
import { createRendiBackend } from ".";

const hasRendiKey = !!process.env.RENDI_API_KEY;

const mockStorage: StorageProvider = {
  async upload() {
    throw new Error("Mock storage - upload not expected in this test");
  },
};

describe("rendi backend validation", () => {
  test("throws error when inputs array is empty", async () => {
    const backend = createRendiBackend({ storage: mockStorage });

    await expect(
      backend.run({
        inputs: [],
        outputArgs: ["-c:v", "libx264"],
        outputPath: "output.mp4",
      }),
    ).rejects.toThrow("Rendi backend requires at least one input file");
  });

  test("throws error when inputs is undefined", async () => {
    const backend = createRendiBackend({ storage: mockStorage });

    await expect(
      backend.run({
        inputs: undefined as unknown as string[],
        outputArgs: ["-c:v", "libx264"],
        outputPath: "output.mp4",
      }),
    ).rejects.toThrow("Rendi backend requires at least one input file");
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
