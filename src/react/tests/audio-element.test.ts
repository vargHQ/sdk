import { describe, expect, test } from "bun:test";
import { File } from "../../ai-sdk/file";
import { Speech, Video } from "../elements";
import { computeSoundBounds } from "../primitives/audio";
import { ResolvedElement } from "../resolved-element";
import type { VargElement } from "../types";

function makeResolved<T extends VargElement["type"]>(
  element: VargElement<T>,
  duration: number,
  words?: { word: string; start: number; end: number }[],
): ResolvedElement<T> {
  const file = File.fromGenerated({
    uint8Array: new Uint8Array([0, 1, 2, 3]),
    mediaType: "audio/mpeg",
  });
  return new ResolvedElement(element, { file, duration, words });
}

// ---------------------------------------------------------------------------
// .audio getter on lazy elements
// ---------------------------------------------------------------------------
describe("lazy element .audio getter", () => {
  test("Video().audio returns a VargElement<'audio'> with parent reference", () => {
    const vid = Video({ prompt: "sunset", src: undefined });
    const audio = vid.audio;

    expect(audio.type).toBe("audio");
    expect(audio.props.parent).toBe(vid);
  });

  test("Video().audio is memoized (same node on repeated access)", () => {
    const vid = Video({ prompt: "sunset" });
    expect(vid.audio).toBe(vid.audio);
  });

  test("Speech().audio is memoized and references parent", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const audio = speech.audio;

    expect(audio.type).toBe("audio");
    expect(audio.props.parent).toBe(speech);
    expect(speech.audio).toBe(audio);
  });

  test(".audio node exposes analysis methods", () => {
    const vid = Video({ prompt: "sunset" });
    expect(typeof vid.audio.transcribe).toBe("function");
    expect(typeof vid.audio.silenceSegments).toBe("function");
    expect(typeof vid.audio.range).toBe("function");
    expect(typeof vid.audio.speechRange).toBe("function");
    expect(typeof vid.audio.then).toBe("function");
  });

  test(".audio is not enumerable (doesn't pollute spread/serialization)", () => {
    const vid = Video({ prompt: "sunset" });
    void vid.audio; // trigger getter
    expect(Object.keys(vid)).not.toContain("audio");
  });
});

// ---------------------------------------------------------------------------
// .audio getter on ResolvedElement (speech is part of audio — contract change)
// ---------------------------------------------------------------------------
describe("ResolvedElement .audio getter", () => {
  test("resolved speech .audio returns an audio node pre-seeded with the same file", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const resolved = makeResolved(speech, 3.8, [
      { word: "hello", start: 0, end: 0.5 },
    ]);

    const audio = resolved.audio;
    expect(audio.type).toBe("audio");
    // Pre-seeded meta: same file, duration, words — no extraction needed
    expect(audio.meta?.file).toBe(resolved.meta.file);
    expect(audio.duration).toBe(3.8);
    expect(audio.words).toEqual([{ word: "hello", start: 0, end: 0.5 }]);
  });

  test("resolved speech .audio is memoized", () => {
    const resolved = makeResolved(Speech({ voice: "adam", children: "hi" }), 2);
    expect(resolved.audio).toBe(resolved.audio);
  });

  test("destructuring: const { audio, segments } = resolved still works", () => {
    const resolved = makeResolved(Speech({ voice: "adam", children: "hi" }), 2);
    const { audio, segments, duration } = resolved;
    expect(audio.type).toBe("audio");
    expect(audio.duration).toBe(2); // sync duration preserved for compat
    expect(segments).toEqual([]);
    expect(duration).toBe(2);
  });

  test("pre-seeded audio node resolves without generation (await works)", async () => {
    const resolved = makeResolved(Speech({ voice: "adam", children: "hi" }), 2);
    const audioResolved = await resolved.audio;
    expect(audioResolved).toBeInstanceOf(ResolvedElement);
    expect(audioResolved.meta.file).toBe(resolved.meta.file);
    expect(audioResolved.duration).toBe(2);
  });

  test("re-await returns the same result (memoized thenable, no .then self-delete)", async () => {
    const resolved = makeResolved(Speech({ voice: "adam", children: "hi" }), 2);
    const audio = resolved.audio;
    const first = await audio;
    const second = await audio;
    expect(first).toBe(second);
    // .then still present after await (unlike makeThenable elements)
    expect(typeof audio.then).toBe("function");
  });

  test("transcribe() reuses native words without transcription call", async () => {
    const resolved = makeResolved(
      Speech({ voice: "adam", children: "hi" }),
      2,
      [
        { word: "hello", start: 0, end: 0.5 },
        { word: "world", start: 0.5, end: 1.0 },
      ],
    );
    const result = await resolved.audio.transcribe();
    expect(result.text).toBe("hello world");
    expect(result.words.length).toBe(2);
  });

  test("resolved video .audio has no pre-seeded meta (extraction required)", () => {
    const vid = Video({ prompt: "sunset" });
    const file = File.fromGenerated({
      uint8Array: new Uint8Array([9, 9]),
      mediaType: "video/mp4",
    });
    const resolved = new ResolvedElement(vid, { file, duration: 5 });

    const audio = resolved.audio;
    expect(audio.type).toBe("audio");
    // Video parent: audio must be extracted, meta not pre-seeded
    expect(audio.meta).toBeUndefined();
    expect(audio.duration).toBe(0);
  });

  test("speechRange() returns first-word start to last-word end from native words", async () => {
    const resolved = makeResolved(
      Speech({ voice: "adam", children: "hi" }),
      5,
      [
        { word: "hello", start: 0.42, end: 0.9 },
        { word: "there", start: 1.0, end: 1.5 },
        { word: "world", start: 1.6, end: 2.31 },
      ],
    );
    const range = await resolved.audio.speechRange();
    expect(range).toEqual({ start: 0.42, end: 2.31 });
  });

  test("speechRange({ pad }) widens the range, clamped to [0, duration]", async () => {
    const resolved = makeResolved(
      Speech({ voice: "adam", children: "hi" }),
      2.4,
      [
        { word: "hello", start: 0.05, end: 0.9 },
        { word: "world", start: 1.0, end: 2.35 },
      ],
    );
    const range = await resolved.audio.speechRange({ pad: 0.1 });
    // start: 0.05 - 0.1 clamps to 0; end: 2.35 + 0.1 clamps to 2.4
    expect(range).toEqual({ start: 0, end: 2.4 });
  });

  test("speechRange() returns null when transcript has no words", async () => {
    const resolved = makeResolved(
      Speech({ voice: "adam", children: "hi" }),
      3,
      [], // empty words — pre-seeded, so transcribe() won't call whisper...
    );
    // ...but transcribe() falls back to whisper on empty words, so stub it.
    resolved.audio.transcribe = async () => ({ text: "", words: [] });
    const range = await resolved.audio.speechRange();
    expect(range).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// audio: "native" sugar
// ---------------------------------------------------------------------------
describe("audio: native sugar", () => {
  test("expands to keepAudio + fal generate_audio for direct models", () => {
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      model: {
        provider: "fal",
        modelId: "kling-v3",
      } as unknown as import("../types").VideoProps["model"],
    });
    expect(vid.props.keepAudio).toBe(true);
    const po = vid.props.providerOptions as Record<
      string,
      Record<string, unknown>
    >;
    expect(po.fal?.generate_audio).toBe(true);
  });

  test("expands to the unified varg.audio field for varg gateway models", () => {
    // NOT provider_options.fal.generate_audio: the varg API rejects unknown
    // provider_options keys with a 422 on models whose fal schema lacks the
    // flag. The unified `audio` field is mapped per model by the API's
    // mapping_rules (rename audio → generate_audio) and silently ignored by
    // models without native-audio support.
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      model: {
        provider: "varg",
        modelId: "kling-v3",
      } as unknown as import("../types").VideoProps["model"],
    });
    const po = vid.props.providerOptions as Record<
      string,
      Record<string, unknown>
    >;
    expect(po.varg?.audio).toBe(true);
    expect(po.varg?.fal).toBeUndefined();
    expect(vid.props.keepAudio).toBe(true);
  });

  test("defaults to fal namespace when no model given", () => {
    const vid = Video({ prompt: "sunset", audio: "native" });
    const po = vid.props.providerOptions as Record<
      string,
      Record<string, unknown>
    >;
    expect(po.fal?.generate_audio).toBe(true);
  });

  test("preserves existing providerOptions", () => {
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      providerOptions: { fal: { resolution: "720p" } },
    });
    const po = vid.props.providerOptions as Record<
      string,
      Record<string, unknown>
    >;
    expect(po.fal?.resolution).toBe("720p");
    expect(po.fal?.generate_audio).toBe(true);
  });

  test("does not override explicit generate_audio (conflict caught by compile)", () => {
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      providerOptions: { fal: { generate_audio: false } },
    });
    const po = vid.props.providerOptions as Record<
      string,
      Record<string, unknown>
    >;
    expect(po.fal?.generate_audio).toBe(false);
  });

  test("cache key unchanged by audio: native expansion vs manual options", async () => {
    const { computeCacheKey } = await import("../renderers/utils");
    const manual = Video({
      prompt: "sunset",
      keepAudio: true,
      providerOptions: { fal: { generate_audio: true } },
    });
    const sugar = Video({ prompt: "sunset", audio: "native" });
    expect(computeCacheKey(sugar)).toEqual(computeCacheKey(manual));
  });
});

// ---------------------------------------------------------------------------
// resolveLazy safety — audio nodes in the tree must not trigger resolution
// ---------------------------------------------------------------------------
describe("resolveLazy with audio nodes", () => {
  test("audio node in tree passes through without triggering resolution", async () => {
    const { resolveLazy } = await import("../renderers/resolve-lazy");
    const { Render, Clip } = await import("../elements");

    const vid = Video({ prompt: "sunset" });
    const tree = Render({
      children: Clip({
        duration: 3,
        children: [vid, vid.audio],
      }),
    });

    const resolved = (await resolveLazy(tree)) as VargElement;
    expect(resolved.type).toBe("render");
    const clip = resolved.children[0] as VargElement;
    const audioChild = clip.children.find(
      (c) => (c as VargElement)?.type === "audio",
    ) as VargElement;
    expect(audioChild).toBeDefined();
    // .then stripped by resolveLazy — Promise.all must not resolve it
    expect("then" in audioChild).toBe(false);
    // parent reference preserved for renderAudio
    expect(audioChild.props.parent).toBe(vid);
  });
});

// ---------------------------------------------------------------------------
// computeSoundBounds
// ---------------------------------------------------------------------------
describe("computeSoundBounds", () => {
  test("no silence — full duration", () => {
    expect(computeSoundBounds([], 10)).toEqual({ start: 0, end: 10 });
  });

  test("leading silence trims start", () => {
    expect(computeSoundBounds([{ start: 0, end: 0.26 }], 10)).toEqual({
      start: 0.26,
      end: 10,
    });
  });

  test("trailing silence trims end", () => {
    expect(computeSoundBounds([{ start: 2.64, end: 10 }], 10)).toEqual({
      start: 0,
      end: 2.64,
    });
  });

  test("leading + trailing silence", () => {
    expect(
      computeSoundBounds(
        [
          { start: 0, end: 0.26 },
          { start: 2.64, end: 3.0 },
        ],
        3.0,
      ),
    ).toEqual({ start: 0.26, end: 2.64 });
  });

  test("mid silence does not affect bounds", () => {
    expect(computeSoundBounds([{ start: 4, end: 6 }], 10)).toEqual({
      start: 0,
      end: 10,
    });
  });
});
