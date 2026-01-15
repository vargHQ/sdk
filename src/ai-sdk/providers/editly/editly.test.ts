import { describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { ffprobe } from "./ffmpeg";
import { editly } from "./index";

const VIDEO_1 = "output/sora-landscape.mp4";
const VIDEO_2 = "output/simpsons-scene.mp4";
const VIDEO_TALKING = "output/workflow-talking-synced.mp4";
const IMAGE_SQUARE = "media/replicate-forest.png";

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

  test("pip with originX/originY", async () => {
    const outPath = "output/editly-test-pip-origin.mp4";
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
              left: 0.95,
              top: 0.05,
              originX: "right",
              originY: "top",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("pip continuous across clips", async () => {
    const outPath = "output/editly-test-pip-continuous.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"];
    const clips = colors.map((color, i) => ({
      duration: 1,
      layers: [
        { type: "fill-color" as const, color },
        {
          type: "video" as const,
          path: VIDEO_TALKING,
          width: 0.3,
          height: 0.3,
          left: 0.95,
          top: 0.05,
          originX: "right" as const,
          originY: "top" as const,
        },
      ],
      transition:
        i < colors.length - 1 ? { name: "fade", duration: 0.3 } : undefined,
    }));

    await editly({
      outPath,
      width: 1280,
      height: 720,
      fps: 30,
      clips,
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

  test("image ken burns preserves aspect ratio", async () => {
    const outPath = "output/editly-test-image-aspect.mp4";
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
            {
              type: "image",
              path: IMAGE_SQUARE,
              zoomDirection: "in",
              zoomAmount: 0.1,
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("image pan left/right", async () => {
    const outPath = "output/editly-test-image-pan.mp4";
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
            {
              type: "image",
              path: "media/cyberpunk-street.png",
              zoomDirection: "left",
              zoomAmount: 0.15,
            },
          ],
          transition: { name: "fade", duration: 0.5 },
        },
        {
          duration: 3,
          layers: [
            {
              type: "image",
              path: "media/cyberpunk-street.png",
              zoomDirection: "right",
              zoomAmount: 0.15,
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("title with custom font", async () => {
    const outPath = "output/editly-test-title-font.mp4";
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
            { type: "fill-color", color: "#1a1a2e" },
            {
              type: "title",
              text: "Custom Font Test",
              textColor: "#ffffff",
              fontPath:
                "/System/Library/Fonts/Supplemental/Comic Sans MS Bold.ttf",
              position: "center",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("image-overlay with position presets", async () => {
    const outPath = "output/editly-test-image-overlay.mp4";
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
              type: "image-overlay",
              path: IMAGE_SQUARE,
              position: "bottom-right",
              width: 0.2,
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("image-overlay with ken burns zoom", async () => {
    const outPath = "output/editly-test-image-overlay-zoom.mp4";
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
            { type: "fill-color", color: "#1a1a2e" },
            {
              type: "image-overlay",
              path: IMAGE_SQUARE,
              position: "center",
              width: 0.4,
              zoomDirection: "in",
              zoomAmount: 0.15,
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("image-overlay continuous across clips", async () => {
    const outPath = "output/editly-test-image-overlay-continuous.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1"];
    const clips = colors.map((color, i) => ({
      duration: 2,
      layers: [
        { type: "fill-color" as const, color },
        {
          type: "image-overlay" as const,
          path: IMAGE_SQUARE,
          position: "top-right" as const,
          width: 0.2,
        },
      ],
      transition:
        i < colors.length - 1 ? { name: "fade", duration: 0.3 } : undefined,
    }));

    await editly({
      outPath,
      width: 1280,
      height: 720,
      fps: 30,
      clips,
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("subtitle layer", async () => {
    const outPath = "output/editly-test-subtitle.mp4";
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
              type: "subtitle",
              text: "This is a subtitle at the bottom",
            },
          ],
        },
        {
          duration: 3,
          layers: [
            { type: "video", path: VIDEO_2 },
            {
              type: "subtitle",
              text: "Another subtitle with custom colors",
              textColor: "yellow",
              backgroundColor: "blue@0.8",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("title-background layer", async () => {
    const outPath = "output/editly-test-title-background.mp4";
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
            {
              type: "title-background",
              text: "Welcome",
              textColor: "white",
              background: {
                type: "radial-gradient",
                colors: ["#667eea", "#764ba2"],
              },
            },
          ],
        },
        {
          duration: 3,
          layers: [
            {
              type: "title-background",
              text: "Goodbye",
              textColor: "#ffff00",
              background: {
                type: "linear-gradient",
                colors: ["#11998e", "#38ef7d"],
              },
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("rainbow-colors layer", async () => {
    const outPath = "output/editly-test-rainbow.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        {
          duration: 4,
          layers: [{ type: "rainbow-colors" }],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("news-title layer", async () => {
    const outPath = "output/editly-test-news-title.mp4";
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
              type: "news-title",
              text: "BREAKING NEWS: Something important happened",
              backgroundColor: "red",
            },
          ],
        },
        {
          duration: 3,
          layers: [
            { type: "video", path: VIDEO_2 },
            {
              type: "news-title",
              text: "TOP STORY",
              backgroundColor: "blue",
              position: "top",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("slide-in-text layer", async () => {
    const outPath = "output/editly-test-slide-in.mp4";
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
            { type: "fill-color", color: "#1a1a2e" },
            {
              type: "slide-in-text",
              text: "Sliding In!",
              color: "white",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("subtitle continuous across clips", async () => {
    const outPath = "output/editly-test-subtitle-continuous.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 1280,
      height: 720,
      fps: 30,
      clips: [
        {
          duration: 2,
          layers: [
            { type: "video", path: VIDEO_1 },
            { type: "subtitle", text: "Continuous subtitle test" },
          ],
          transition: { name: "fade", duration: 0.5 },
        },
        {
          duration: 2,
          layers: [
            { type: "video", path: VIDEO_2 },
            { type: "subtitle", text: "Continuous subtitle test" },
          ],
          transition: { name: "fade", duration: 0.5 },
        },
        {
          duration: 2,
          layers: [
            { type: "fill-color", color: "#1a1a2e" },
            { type: "subtitle", text: "Continuous subtitle test" },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("audio layer in clip", async () => {
    const outPath = "output/editly-test-audio-layer.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        {
          duration: 3,
          layers: [
            { type: "fill-color", color: "#1a1a2e" },
            { type: "title", text: "Audio Layer Test" },
            { type: "audio", path: "media/kirill-voice.mp3" },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });

  test("detached-audio layer with start offset", async () => {
    const outPath = "output/editly-test-detached-audio.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      width: 640,
      height: 480,
      fps: 30,
      clips: [
        {
          duration: 5,
          layers: [
            { type: "fill-color", color: "#1a1a2e" },
            { type: "title", text: "Audio starts at 2s" },
            {
              type: "detached-audio",
              path: "media/kirill-voice.mp3",
              start: 2,
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  });
});
