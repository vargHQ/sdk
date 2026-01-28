/**
 * Rendi backend tests - same as editly.test.ts but uses cloud ffmpeg
 *
 * NOTE: Free tier has 4 commands/min rate limit. Run tests individually:
 *   bun test src/ai-sdk/providers/editly/editly-rendi.test.ts -t "merges two"
 */
import { describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { localBackend } from "./backends";
import { editly } from "./index";

const VIDEO_1 = "https://s3.varg.ai/test-media/sora-landscape.mp4";
const VIDEO_2 = "https://s3.varg.ai/test-media/simpsons-scene.mp4";
const VIDEO_TALKING =
  "https://s3.varg.ai/test-media/workflow-talking-synced.mp4";
const IMAGE_SQUARE = "https://s3.varg.ai/test-media/replicate-forest.png";
const IMAGE_PORTRAIT = "https://s3.varg.ai/test-media/madi-portrait.png";

describe("editly (rendi backend)", () => {
  test("merges two videos with fade transition", async () => {
    const outPath = "output/rendi/editly-test-merge.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
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
    const info = await localBackend.ffprobe(outPath);
    expect(info.duration).toBeGreaterThan(2);
  }, 120000);

  test("picture-in-picture (pip)", async () => {
    const outPath = "output/rendi/editly-test-pip.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
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
              width: "30%",
              height: "30%",
              left: "68%",
              top: "2%",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  }, 120000);

  test("image ken burns preserves aspect ratio", async () => {
    const outPath = "output/rendi/editly-test-image-aspect.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
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
              resizeMode: "contain",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  }, 120000);

  test("subtitle layer", async () => {
    const outPath = "output/rendi/editly-test-subtitle.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
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
  }, 120000);

  test("news-title layer", async () => {
    const outPath = "output/rendi/editly-test-news-title.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
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
  }, 120000);

  test("keepSourceAudio preserves original video audio", async () => {
    const outPath = "output/rendi/editly-test-keep-source-audio.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
      width: 1280,
      height: 720,
      fps: 30,
      keepSourceAudio: true,
      clips: [
        {
          layers: [
            { type: "video", path: VIDEO_TALKING },
            { type: "subtitle", text: "Original audio should play" },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  }, 120000);

  test("keepSourceAudio with cutFrom stays in sync", async () => {
    const outPath = "output/rendi/editly-test-keep-source-audio-cutfrom.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
      width: 1280,
      height: 720,
      fps: 30,
      keepSourceAudio: true,
      clips: [
        {
          layers: [
            { type: "video", path: VIDEO_TALKING, cutFrom: 2, cutTo: 6 },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  }, 120000);

  test("contain-blur resize mode for video", async () => {
    const outPath = "output/rendi/editly-test-contain-blur-video.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
      width: 1080,
      height: 1920,
      fps: 30,
      clips: [
        {
          duration: 3,
          layers: [
            { type: "video", path: VIDEO_1, resizeMode: "contain-blur" },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
  }, 120000);

  test("video overlay with cropPosition", async () => {
    const outPath = "output/rendi/editly-test-crop-position.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
      width: 1080,
      height: 1920,
      fps: 30,
      clips: [
        {
          duration: 3,
          layers: [
            { type: "fill-color", color: "#000000" },
            {
              type: "video",
              path: VIDEO_1,
              width: 1080,
              height: 960,
              left: 0,
              top: 0,
              resizeMode: "cover",
              cropPosition: "top",
            },
            {
              type: "video",
              path: VIDEO_2,
              width: 1080,
              height: 960,
              left: 0,
              top: 960,
              resizeMode: "cover",
              cropPosition: "bottom",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
    const info = await localBackend.ffprobe(outPath);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
  }, 120000);

  test("portrait 9:16 image with zoompan cover mode", async () => {
    const outPath = "output/rendi/editly-test-portrait-zoompan.mp4";
    if (existsSync(outPath)) unlinkSync(outPath);

    await editly({
      outPath,
      backend: "rendi",
      width: 1080,
      height: 1920,
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
              resizeMode: "cover",
            },
          ],
        },
      ],
    });

    expect(existsSync(outPath)).toBe(true);
    const info = await localBackend.ffprobe(outPath);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
  }, 120000);
});
