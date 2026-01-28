import { describe, expect, test } from "bun:test";
import { createRendiBackend } from ".";

describe("rendi backend", () => {
  test("ffprobe remote file", async () => {
    const backend = createRendiBackend();
    const info = await backend.ffprobe(
      "https://storage.rendi.dev/sample/big_buck_bunny_720p_5sec_intro.mp4",
    );

    expect(info.duration).toBeGreaterThan(0);
    expect(info.width).toBe(1280);
    expect(info.height).toBe(720);
  }, 30000);

  test("run simple ffmpeg command", async () => {
    const backend = createRendiBackend();

    const result = await backend.run({
      args: [
        "-i",
        "https://storage.rendi.dev/sample/big_buck_bunny_720p_5sec_intro.mp4",
        "-t",
        "2",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-y",
        "output.mp4",
      ],
      inputs: [
        "https://storage.rendi.dev/sample/big_buck_bunny_720p_5sec_intro.mp4",
      ],
      outputPath: "output.mp4",
      verbose: true,
    });

    expect(result.output.type).toBe("url");
    if (result.output.type === "url") {
      expect(result.output.url).toMatch(/^https:\/\//);
    }
  }, 120000);
});
