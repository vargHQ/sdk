import { describe, expect, test } from "bun:test";
import { editlyWeb } from "./index";

const hasWebCodecs =
  typeof globalThis.VideoEncoder !== "undefined" &&
  typeof globalThis.AudioEncoder !== "undefined";

describe("editly-web", () => {
  describe("validation", () => {
    test("requires at least one clip", async () => {
      await expect(
        editlyWeb({
          clips: [],
          sources: new Map(),
        }),
      ).rejects.toThrow("At least one clip is required");
    });

    test("throws when video source not found", async () => {
      if (!hasWebCodecs) return;

      await expect(
        editlyWeb({
          clips: [{ layers: [{ type: "video", path: "missing.mp4" }] }],
          sources: new Map(),
        }),
      ).rejects.toThrow("Video source not found: missing.mp4");
    });

    test("throws when image source not found", async () => {
      if (!hasWebCodecs) return;

      await expect(
        editlyWeb({
          clips: [
            { duration: 2, layers: [{ type: "image", path: "missing.png" }] },
          ],
          sources: new Map(),
        }),
      ).rejects.toThrow("Image source not found: missing.png");
    });
  });

  describe("fill-color layer", () => {
    test.skipIf(!hasWebCodecs)("creates video with fill-color", async () => {
      const result = await editlyWeb({
        width: 640,
        height: 480,
        fps: 30,
        clips: [
          { duration: 2, layers: [{ type: "fill-color", color: "#ff0000" }] },
        ],
        sources: new Map(),
      });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("gradient layers", () => {
    test.skipIf(!hasWebCodecs)("creates linear-gradient", async () => {
      const result = await editlyWeb({
        width: 640,
        height: 480,
        fps: 30,
        clips: [
          {
            duration: 1,
            layers: [
              { type: "linear-gradient", colors: ["#02aab0", "#00cdac"] },
            ],
          },
        ],
        sources: new Map(),
      });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test.skipIf(!hasWebCodecs)("creates radial-gradient", async () => {
      const result = await editlyWeb({
        width: 640,
        height: 480,
        fps: 30,
        clips: [
          {
            duration: 1,
            layers: [
              { type: "radial-gradient", colors: ["#b002aa", "#ac00cd"] },
            ],
          },
        ],
        sources: new Map(),
      });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("video layer", () => {
    test.skipIf(!hasWebCodecs)("creates video from video source", async () => {
      const videoData = await Bun.file(
        "output/sora-landscape.mp4",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1280,
        height: 720,
        fps: 30,
        clips: [
          {
            duration: 2,
            layers: [{ type: "video", path: "input.mp4" }],
          },
        ],
        sources: new Map([["input.mp4", videoData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test.skipIf(!hasWebCodecs)("video with cutFrom/cutTo", async () => {
      const videoData = await Bun.file(
        "output/sora-landscape.mp4",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1280,
        height: 720,
        fps: 30,
        clips: [
          {
            layers: [
              { type: "video", path: "input.mp4", cutFrom: 1, cutTo: 3 },
            ],
          },
        ],
        sources: new Map([["input.mp4", videoData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test.skipIf(!hasWebCodecs)("video with resizeMode contain", async () => {
      const videoData = await Bun.file(
        "output/sora-landscape.mp4",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1080,
        height: 1920,
        fps: 30,
        clips: [
          {
            duration: 2,
            layers: [
              { type: "video", path: "input.mp4", resizeMode: "contain" },
            ],
          },
        ],
        sources: new Map([["input.mp4", videoData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
    });

    test.skipIf(!hasWebCodecs)("video with resizeMode cover", async () => {
      const videoData = await Bun.file(
        "output/sora-landscape.mp4",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1080,
        height: 1920,
        fps: 30,
        clips: [
          {
            duration: 2,
            layers: [{ type: "video", path: "input.mp4", resizeMode: "cover" }],
          },
        ],
        sources: new Map([["input.mp4", videoData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
    });

    test.skipIf(!hasWebCodecs)(
      "video with resizeMode contain-blur",
      async () => {
        const videoData = await Bun.file(
          "output/sora-landscape.mp4",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 1080,
          height: 1920,
          fps: 30,
          clips: [
            {
              duration: 2,
              layers: [
                {
                  type: "video",
                  path: "input.mp4",
                  resizeMode: "contain-blur",
                },
              ],
            },
          ],
          sources: new Map([["input.mp4", videoData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );
  });

  describe("image layer", () => {
    test.skipIf(!hasWebCodecs)("creates video from image source", async () => {
      const imageData = await Bun.file(
        "media/replicate-forest.png",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1280,
        height: 720,
        fps: 30,
        clips: [
          {
            duration: 2,
            layers: [{ type: "image", path: "image.png" }],
          },
        ],
        sources: new Map([["image.png", imageData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    test.skipIf(!hasWebCodecs)(
      "image with resizeMode contain-blur",
      async () => {
        const imageData = await Bun.file(
          "media/replicate-forest.png",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 1920,
          height: 1080,
          fps: 30,
          clips: [
            {
              duration: 2,
              layers: [
                {
                  type: "image",
                  path: "image.png",
                  resizeMode: "contain-blur",
                },
              ],
            },
          ],
          sources: new Map([["image.png", imageData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );
  });

  describe("multiple clips", () => {
    test.skipIf(!hasWebCodecs)(
      "creates video with multiple fill-color clips",
      async () => {
        const result = await editlyWeb({
          width: 640,
          height: 480,
          fps: 30,
          clips: [
            { duration: 1, layers: [{ type: "fill-color", color: "#ff0000" }] },
            { duration: 1, layers: [{ type: "fill-color", color: "#00ff00" }] },
            { duration: 1, layers: [{ type: "fill-color", color: "#0000ff" }] },
          ],
          sources: new Map(),
        });

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
      },
    );

    test.skipIf(!hasWebCodecs)("multiple clips with transitions", async () => {
      const result = await editlyWeb({
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
        sources: new Map(),
      });

      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe("audio", () => {
    test.skipIf(!hasWebCodecs)(
      "keepSourceAudio preserves video audio",
      async () => {
        const videoData = await Bun.file(
          "output/workflow-talking-synced.mp4",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 1280,
          height: 720,
          fps: 30,
          keepSourceAudio: true,
          clips: [
            {
              duration: 3,
              layers: [{ type: "video", path: "input.mp4" }],
            },
          ],
          sources: new Map([["input.mp4", videoData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
        expect(result.length).toBeGreaterThan(0);
      },
    );

    test.skipIf(!hasWebCodecs)("audio layer in clip", async () => {
      const audioData = await Bun.file("media/kirill-voice.mp3").arrayBuffer();

      const result = await editlyWeb({
        width: 640,
        height: 480,
        fps: 30,
        clips: [
          {
            duration: 3,
            layers: [
              { type: "fill-color", color: "#1a1a2e" },
              { type: "audio", path: "audio.mp3" },
            ],
          },
        ],
        sources: new Map([["audio.mp3", audioData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
    });

    test.skipIf(!hasWebCodecs)(
      "detached-audio layer with start offset",
      async () => {
        const audioData = await Bun.file(
          "media/kirill-voice.mp3",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 640,
          height: 480,
          fps: 30,
          clips: [
            {
              duration: 5,
              layers: [
                { type: "fill-color", color: "#1a1a2e" },
                { type: "detached-audio", path: "audio.mp3", start: 2 },
              ],
            },
          ],
          sources: new Map([["audio.mp3", audioData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );

    test.skipIf(!hasWebCodecs)(
      "audioTracks with cutFrom/cutTo/start",
      async () => {
        const audioData = await Bun.file(
          "media/kirill-voice.mp3",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 640,
          height: 480,
          fps: 30,
          audioTracks: [
            {
              path: "audio.mp3",
              cutFrom: 0,
              cutTo: 2,
              start: 1,
              mixVolume: 0.8,
            },
          ],
          clips: [
            {
              duration: 5,
              layers: [{ type: "fill-color", color: "#1a1a2e" }],
            },
          ],
          sources: new Map([["audio.mp3", audioData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );

    test.skipIf(!hasWebCodecs)(
      "loopAudio loops audio to match video duration",
      async () => {
        const audioData = await Bun.file(
          "media/kirill-voice.mp3",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 640,
          height: 480,
          fps: 30,
          audioFilePath: "audio.mp3",
          loopAudio: true,
          clips: [
            {
              duration: 10,
              layers: [{ type: "fill-color", color: "#1a1a2e" }],
            },
          ],
          sources: new Map([["audio.mp3", audioData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );

    test.skipIf(!hasWebCodecs)(
      "clipsAudioVolume controls source video audio level",
      async () => {
        const videoData = await Bun.file(
          "output/workflow-talking-synced.mp4",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 1280,
          height: 720,
          fps: 30,
          keepSourceAudio: true,
          clipsAudioVolume: 0.3,
          clips: [
            {
              duration: 3,
              layers: [{ type: "video", path: "input.mp4" }],
            },
          ],
          sources: new Map([["input.mp4", videoData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );

    test.skipIf(!hasWebCodecs)(
      "audioNorm normalizes audio levels",
      async () => {
        const videoData = await Bun.file(
          "output/workflow-talking-synced.mp4",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 1280,
          height: 720,
          fps: 30,
          keepSourceAudio: true,
          audioNorm: { enable: true },
          clips: [
            {
              duration: 3,
              layers: [{ type: "video", path: "input.mp4" }],
            },
          ],
          sources: new Map([["input.mp4", videoData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );

    test.skipIf(!hasWebCodecs)(
      "keepSourceAudio with cutFrom stays in sync",
      async () => {
        const videoData = await Bun.file(
          "output/workflow-talking-synced.mp4",
        ).arrayBuffer();

        const result = await editlyWeb({
          width: 1280,
          height: 720,
          fps: 30,
          keepSourceAudio: true,
          clips: [
            {
              layers: [
                { type: "video", path: "input.mp4", cutFrom: 2, cutTo: 6 },
              ],
            },
          ],
          sources: new Map([["input.mp4", videoData]]),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );
  });

  describe("defaults", () => {
    test.skipIf(!hasWebCodecs)(
      "defaults.duration applies to clips",
      async () => {
        const result = await editlyWeb({
          width: 640,
          height: 480,
          fps: 30,
          defaults: {
            duration: 3,
          },
          clips: [
            { layers: [{ type: "fill-color", color: "#ff0000" }] },
            { layers: [{ type: "fill-color", color: "#00ff00" }] },
          ],
          sources: new Map(),
        });

        expect(result).toBeInstanceOf(Uint8Array);
      },
    );
  });

  describe("mixed layers", () => {
    test.skipIf(!hasWebCodecs)("video with fill-color background", async () => {
      const videoData = await Bun.file(
        "output/sora-landscape.mp4",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1280,
        height: 720,
        fps: 30,
        clips: [
          {
            duration: 2,
            layers: [
              { type: "fill-color", color: "#1a1a2e" },
              { type: "video", path: "input.mp4" },
            ],
          },
        ],
        sources: new Map([["input.mp4", videoData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
    });

    test.skipIf(!hasWebCodecs)("gradient with image overlay", async () => {
      const imageData = await Bun.file(
        "media/replicate-forest.png",
      ).arrayBuffer();

      const result = await editlyWeb({
        width: 1280,
        height: 720,
        fps: 30,
        clips: [
          {
            duration: 2,
            layers: [
              { type: "linear-gradient", colors: ["#667eea", "#764ba2"] },
              { type: "image", path: "image.png" },
            ],
          },
        ],
        sources: new Map([["image.png", imageData]]),
      });

      expect(result).toBeInstanceOf(Uint8Array);
    });
  });
});
