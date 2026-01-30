/**
 * Rendi backend tests - same as editly.test.ts but uses cloud ffmpeg
 *
 * NOTE: Free tier has 4 commands/min rate limit. Run tests individually:
 *   bun test src/ai-sdk/providers/editly/rendi/editly-with-rendi-backend.test.ts -t "merges two"
 */

import { describe, expect, test } from "bun:test";
import { $ } from "bun";
import type { StorageProvider } from "../../../storage/types";
import { editly } from "../index";
import { createRendiBackend } from ".";

const shouldRunRendiTests =
  !!process.env.RENDI_INTEGRATION_TESTS && !!process.env.RENDI_API_KEY;

const VIDEO_1 = "https://s3.varg.ai/test-media/sora-landscape.mp4";
const VIDEO_2 = "https://s3.varg.ai/test-media/simpsons-scene.mp4";
const VIDEO_TALKING =
  "https://s3.varg.ai/test-media/workflow-talking-synced.mp4";
const IMAGE_SQUARE = "https://s3.varg.ai/test-media/replicate-forest.png";

const mockStorage: StorageProvider = {
  async upload() {
    throw new Error("Mock storage - upload not expected in this test");
  },
};

const rendiBackend = shouldRunRendiTests
  ? createRendiBackend({ storage: mockStorage })
  : (null as never);

async function saveResult(
  result: {
    output: { type: "url"; url: string } | { type: "file"; path: string };
  },
  outPath: string,
) {
  expect(result.output.type).toBe("url");
  if (result.output.type === "url") {
    expect(result.output.url).toMatch(/^https:\/\//);
    const res = await fetch(result.output.url);
    if (!res.ok) throw new Error(`Failed to download: ${res.status}`);

    const dir = outPath.split("/").slice(0, -1).join("/");
    await $`mkdir -p ${dir}`.quiet();

    const bytes = await res.arrayBuffer();
    await Bun.write(outPath, bytes);

    const written = Bun.file(outPath);
    if (!(await written.exists()) || written.size === 0) {
      throw new Error(`Failed to write output file: ${outPath}`);
    }
    console.log(`Output: ${outPath}`);
  }
}

describe.skipIf(!shouldRunRendiTests)("editly (rendi backend)", () => {
  test("merges two videos with fade transition", async () => {
    const outPath = "output/rendi/merge.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("picture-in-picture (pip)", async () => {
    const outPath = "output/rendi/pip.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("image ken burns preserves aspect ratio", async () => {
    const outPath = "output/rendi/ken-burns.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("subtitle layer", async () => {
    const outPath = "output/rendi/subtitle.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("news-title layer", async () => {
    const outPath = "output/rendi/news-title.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("keepSourceAudio preserves original video audio", async () => {
    const outPath = "output/rendi/keep-audio.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("keepSourceAudio with cutFrom stays in sync", async () => {
    const outPath = "output/rendi/keep-audio-cut.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("contain-blur resize mode for video", async () => {
    const outPath = "output/rendi/contain-blur.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("video overlay with cropPosition", async () => {
    const outPath = "output/rendi/crop-position.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);

  test("portrait 9:16 image with zoompan cover mode", async () => {
    const outPath = "output/rendi/portrait-zoompan.mp4";
    const result = await editly({
      outPath,
      backend: rendiBackend,
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

    await saveResult(result, outPath);
  }, 120000);
});
