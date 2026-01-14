import { describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { ffprobe } from "./ffmpeg";
import { editly } from "./index";

const VIDEO_1 = "output/sora-landscape.mp4";
const VIDEO_2 = "output/simpsons-scene.mp4";

describe("editly", () => {
  test("requires outPath", async () => {
    await expect(
      editly({ outPath: "", clips: [{ layers: [{ type: "fill-color" }] }] }),
    ).rejects.toThrow();
  });

  test("requires at least one clip", async () => {
    await expect(editly({ outPath: "test.mp4", clips: [] })).rejects.toThrow(
      "At least one clip is required",
    );
  });

  test("creates video with fill-color", async () => {
    const outPath = "output/editly-test-fill.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        { duration: 2, layers: [{ type: "fill-color", color: "#ff0000" }] },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
    const info = await ffprobe(outPath);
    expect(info.duration).toBeCloseTo(2, 0);
  });

  test("creates video with title overlay", async () => {
    const outPath = "output/editly-test-title.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        {
          duration: 2,
          layers: [
            { type: "fill-color", color: "#1a1a2e" },
            { type: "title", text: "Hello World", textColor: "#ffffff" },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("merges two videos with fade transition", async () => {
    const outPath = "output/editly-test-merge.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 1280,
      height: 720,
      fps: 30,
      clips: [
        {
          layers: [{ type: "video", path: VIDEO_1 }],
          transition: { name: "fade", duration: 0.5 },
        },
        {
          layers: [{ type: "video", path: VIDEO_2 }],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
    const info = await ffprobe(outPath);
    expect(info.duration).toBeGreaterThan(2);
  });

  test("picture-in-picture (pip)", async () => {
    const outPath = "output/editly-test-pip.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 1280,
      height: 720,
      fps: 30,
      clips: [
        {
          duration: 3,
          layers: [
            { type: "video", path: VIDEO_1 },
            {
              type: "video",
              path: VIDEO_2,
              width: 0.3,
              height: 0.3,
              left: 0.68,
              top: 0.02,
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("gradients", async () => {
    const outPath = "output/editly-test-gradients.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        {
          duration: 1,
          layers: [{ type: "linear-gradient", colors: ["#02aab0", "#00cdac"] }],
        },
        {
          duration: 1,
          layers: [{ type: "radial-gradient", colors: ["#b002aa", "#ac00cd"] }],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("multiple clips with transitions", async () => {
    const outPath = "output/editly-test-transitions.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        {
          duration: 2,
          layers: [{ type: "fill-color", color: "#ff0000" }],
          transition: { name: "fade", duration: 0.5 },
        },
        {
          duration: 2,
          layers: [{ type: "fill-color", color: "#00ff00" }],
          transition: { name: "fade", duration: 0.5 },
        },
        {
          duration: 2,
          layers: [{ type: "fill-color", color: "#0000ff" }],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
    const info = await ffprobe(outPath);
    expect(info.duration).toBeGreaterThan(3);
  });
});
