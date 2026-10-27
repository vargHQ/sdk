import { afterEach, describe, expect, spyOn, test } from "bun:test";
import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends";
import { resetAudioWarnings, resolveVideoMixVolume } from "./audio";

type ProbeResult = Awaited<ReturnType<FFmpegBackend["ffprobe"]>>;

function backendReturning(
  info: ProbeResult | (() => never),
  name = "test",
): FFmpegBackend {
  return {
    name,
    ffprobe: async () => (typeof info === "function" ? info() : info),
    resolvePath: async (p: unknown) => String(p),
  } as unknown as FFmpegBackend;
}

afterEach(() => {
  resetAudioWarnings();
});

describe("resolveVideoMixVolume", () => {
  test("keeps audio when the source has an audio stream", async () => {
    const volume = await resolveVideoMixVolume({
      backend: backendReturning({ duration: 5, hasAudio: true }),
      path: "/tmp/a.mp4",
    });

    expect(volume).toBe(1);
  });

  test("honours an explicit volume alongside the default", async () => {
    const volume = await resolveVideoMixVolume({
      backend: backendReturning({ duration: 5, hasAudio: true }),
      path: "/tmp/a.mp4",
      volume: 0.15,
    });

    expect(volume).toBe(0.15);
  });

  test("mutes a source with no audio stream, without warning", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const volume = await resolveVideoMixVolume({
      backend: backendReturning({ duration: 5, hasAudio: false }),
      path: "/tmp/silent.mp4",
    });

    expect(volume).toBe(0);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test("keepAudio: false wins without probing", async () => {
    let probed = false;
    const backend = {
      name: "test",
      ffprobe: async () => {
        probed = true;
        return { duration: 5, hasAudio: true };
      },
      resolvePath: async (p: unknown) => String(p),
    } as unknown as FFmpegBackend;

    const volume = await resolveVideoMixVolume({
      backend,
      keepAudio: false,
      path: "/tmp/a.mp4",
    });

    expect(volume).toBe(0);
    expect(probed).toBe(false);
  });

  test("keepAudio: true wins without probing", async () => {
    let probed = false;
    const backend = {
      name: "test",
      ffprobe: async () => {
        probed = true;
        return { duration: 5, hasAudio: false };
      },
      resolvePath: async (p: unknown) => String(p),
    } as unknown as FFmpegBackend;

    const volume = await resolveVideoMixVolume({
      backend,
      keepAudio: true,
      path: "/tmp/a.mp4",
    });

    expect(volume).toBe(1);
    expect(probed).toBe(false);
  });

  test("warns instead of silently muting when the probe fails", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const volume = await resolveVideoMixVolume({
      backend: backendReturning(() => {
        throw new Error("ffprobe not found");
      }),
      path: "https://s3.varg.ai/media/clip.mp4?sig=abc",
    });

    expect(volume).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain("clip.mp4");
    expect(message).not.toContain("sig=abc");
    expect(message).toContain("keepAudio: true");

    warn.mockRestore();
  });

  test("warns when the backend cannot report stream info", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});

    const volume = await resolveVideoMixVolume({
      backend: backendReturning({ duration: 5 }, "rendi"),
      path: "/tmp/a.mp4",
    });

    expect(volume).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("rendi");

    warn.mockRestore();
  });

  test("warns once per backend, not once per clip", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const backend = backendReturning({ duration: 5 }, "rendi");

    for (const path of ["/tmp/a.mp4", "/tmp/b.mp4", "/tmp/c.mp4"]) {
      await resolveVideoMixVolume({ backend, path });
    }

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
