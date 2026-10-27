import { describe, expect, test } from "bun:test";
import type { File } from "../../ai-sdk/file";
import { Clip, Overlay, Video } from "../elements";
import { renderClip } from "./clip";
import type { RenderContext } from "./context";

function createContext(hasAudio = true): RenderContext {
  const unsupported = async () => {
    throw new Error("unexpected generation call");
  };

  return {
    width: 1080,
    height: 1920,
    fps: 30,
    generateImage: unsupported,
    generateVideo: unsupported,
    generateSpeech: unsupported,
    generateMusic: unsupported,
    tempFiles: [],
    pendingFiles: new Map<string, Promise<File>>(),
    backend: {
      ffprobe: async () => ({ duration: 5, hasAudio }),
      resolvePath: async () => "/tmp/source.mp4",
    },
    generatedFiles: [],
  } as unknown as RenderContext;
}

describe("video source audio defaults", () => {
  test("keeps audio for a video by default", async () => {
    const clip = Clip({ children: Video({ src: "/tmp/source.mp4" }) });

    const rendered = await renderClip(clip, createContext());

    expect(rendered.layers[0]).toMatchObject({
      type: "video",
      mixVolume: 1,
    });
  });

  test("allows a video to opt out of source audio", async () => {
    const clip = Clip({
      children: Video({ src: "/tmp/source.mp4", keepAudio: false }),
    });

    const rendered = await renderClip(clip, createContext());

    expect(rendered.layers[0]).toMatchObject({
      type: "video",
      mixVolume: 0,
    });
  });

  test("does not add a missing audio stream in default mode", async () => {
    const clip = Clip({ children: Video({ src: "/tmp/source.mp4" }) });

    const rendered = await renderClip(clip, createContext(false));

    expect(rendered.layers[0]).toMatchObject({
      type: "video",
      mixVolume: 0,
    });
  });

  test("allows source audio to be forced on", async () => {
    const clip = Clip({
      children: Video({ src: "/tmp/source.mp4", keepAudio: true }),
    });

    const rendered = await renderClip(clip, createContext(false));

    expect(rendered.layers[0]).toMatchObject({
      type: "video",
      mixVolume: 1,
    });
  });

  test("keeps audio for an overlay video by default", async () => {
    const clip = Clip({
      children: Overlay({
        children: Video({ src: "/tmp/source.mp4" }),
        volume: 0.4,
      }),
    });

    const rendered = await renderClip(clip, createContext());

    expect(rendered.layers[0]).toMatchObject({
      type: "video",
      mixVolume: 0.4,
    });
  });

  test("allows an overlay video to opt out of source audio", async () => {
    const clip = Clip({
      children: Overlay({
        children: Video({ src: "/tmp/source.mp4" }),
        keepAudio: false,
      }),
    });

    const rendered = await renderClip(clip, createContext());

    expect(rendered.layers[0]).toMatchObject({
      type: "video",
      mixVolume: 0,
    });
  });
});
