import { describe, expect, mock, test } from "bun:test";
import { File } from "../ai-sdk/file";
import {
  Captions,
  Clip,
  Image,
  Music,
  Render,
  Speech,
  Video,
} from "./elements";
import { resolveLazy } from "./renderers/resolve-lazy";
import { ResolvedElement } from "./resolved-element";
import type { VargElement, VargNode } from "./types";

// ---------------------------------------------------------------------------
// Helper: create a ResolvedElement manually (bypasses AI generation)
// ---------------------------------------------------------------------------
function makeResolved<T extends VargElement["type"]>(
  element: VargElement<T>,
  duration: number,
): ResolvedElement<T> {
  const file = File.fromGenerated({
    uint8Array: new Uint8Array([0, 1, 2, 3]),
    mediaType: "audio/mpeg",
  });
  return new ResolvedElement(element, { file, duration });
}

// ---------------------------------------------------------------------------
// Phase 1: ResolvedElement class
// ---------------------------------------------------------------------------
describe("ResolvedElement", () => {
  test("wraps a VargElement with meta (file + duration)", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const resolved = makeResolved(speech, 3.8);

    expect(resolved.type).toBe("speech");
    expect(resolved.props.voice).toBe("adam");
    expect(resolved.children).toEqual(["hello"]);
    expect(resolved.duration).toBe(3.8);
    expect(resolved.meta.duration).toBe(3.8);
    expect(resolved.meta.file).toBeInstanceOf(File);
  });

  test("instanceof check works", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const resolved = makeResolved(speech, 2.5);

    expect(resolved instanceof ResolvedElement).toBe(true);
    // A plain VargElement is NOT a ResolvedElement
    expect(speech instanceof ResolvedElement).toBe(false);
  });

  test("satisfies VargElement shape (can be used as child)", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const resolved = makeResolved(speech, 4.0);

    // Can be used as a Clip child
    const clip = Clip({
      duration: resolved.duration,
      children: [resolved as unknown as VargNode],
    });

    expect(clip.type).toBe("clip");
    expect(clip.props.duration).toBe(4.0);
    expect(clip.children.length).toBe(1);
  });

  test("duration getter reads from meta", () => {
    const music = Music({ prompt: "chill beats" });
    const resolved = makeResolved(music, 30.5);

    expect(resolved.duration).toBe(30.5);
    expect(resolved.meta.duration).toBe(30.5);
  });

  test("file getter reads from meta", () => {
    const image = Image({ prompt: "sunset" });
    const resolved = makeResolved(image, 0);

    expect(resolved.file).toBeInstanceOf(File);
    expect(resolved.duration).toBe(0); // images have 0 duration
  });

  test("aspectRatio on meta", () => {
    const image = Image({ prompt: "sunset", aspectRatio: "9:16" });
    const file = File.fromGenerated({
      uint8Array: new Uint8Array([0]),
      mediaType: "image/png",
    });
    const resolved = new ResolvedElement(image, {
      file,
      duration: 0,
      aspectRatio: "9:16",
    });

    expect(resolved.aspectRatio).toBe("9:16");
  });
});

// ---------------------------------------------------------------------------
// Phase 1: Element factories are thenable
// ---------------------------------------------------------------------------
describe("element factories are thenable", () => {
  test("Speech() returns a VargElement with a .then method", () => {
    const speech = Speech({ voice: "adam", children: "hello" });

    expect(speech.type).toBe("speech");
    expect(typeof (speech as any).then).toBe("function");
  });

  test("Video() returns a VargElement with a .then method", () => {
    const video = Video({ prompt: "sunset" });

    expect(video.type).toBe("video");
    expect(typeof (video as any).then).toBe("function");
  });

  test("Image() returns a VargElement with a .then method", () => {
    const image = Image({ prompt: "cat" });

    expect(image.type).toBe("image");
    expect(typeof (image as any).then).toBe("function");
  });

  test("Music() returns a VargElement with a .then method", () => {
    const music = Music({ prompt: "chill" });

    expect(music.type).toBe("music");
    expect(typeof (music as any).then).toBe("function");
  });

  test("thenable elements still have .type (not treated as pure Promises)", () => {
    // This is critical: the JSX runtime uses .type to distinguish thenable
    // VargElements from async component Promises
    const speech = Speech({ voice: "adam", children: "test" });
    expect(speech.type).toBe("speech");
    expect("type" in speech).toBe(true);
  });

  test("Render, Clip, Captions are NOT thenable (no .then)", () => {
    const render = Render({ width: 1080, height: 1920 });
    const clip = Clip({ duration: 5 });
    const captions = Captions({ style: "tiktok" });

    expect((render as any).then).toBeUndefined();
    expect((clip as any).then).toBeUndefined();
    expect((captions as any).then).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 1: ResolvedElement in composition tree
// ---------------------------------------------------------------------------
describe("ResolvedElement in composition tree", () => {
  test("audio.duration drives Clip duration", () => {
    const speech = Speech({ voice: "adam", children: "hello world" });
    const audio = makeResolved(speech, 3.8);

    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({
          duration: audio.duration,
          children: [audio as unknown as VargNode],
        }),
      ],
    });

    expect(tree.type).toBe("render");
    const clip = tree.children[0] as VargElement<"clip">;
    expect(clip.type).toBe("clip");
    expect(clip.props.duration).toBe(3.8);
  });

  test("audio.duration in template literal", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const audio = makeResolved(speech, 3.8);

    const prompt = `This video is exactly ${audio.duration} seconds long.`;
    expect(prompt).toBe("This video is exactly 3.8 seconds long.");
  });

  test("resolved speech as Captions src", () => {
    const speech = Speech({ voice: "adam", children: "hello" });
    const audio = makeResolved(speech, 3.8);

    const captions = Captions({
      src: audio as unknown as VargElement<"speech">,
      style: "tiktok",
      withAudio: true,
    });

    expect(captions.type).toBe("captions");
    expect(captions.props.src).toBe(audio);
  });

  test("two resolved audios in same tree", () => {
    const s1 = makeResolved(
      Speech({ voice: "rachel", children: "part one" }),
      2.5,
    );
    const s2 = makeResolved(
      Speech({ voice: "rachel", children: "part two" }),
      5.3,
    );

    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({
          duration: s1.duration,
          children: [s1 as unknown as VargNode],
        }),
        Clip({
          duration: s2.duration,
          children: [s2 as unknown as VargNode],
        }),
      ],
    });

    const clips = tree.children as VargElement[];
    expect((clips[0] as VargElement<"clip">).props.duration).toBe(2.5);
    expect((clips[1] as VargElement<"clip">).props.duration).toBe(5.3);
  });

  test("dynamic clip count from audio.duration", () => {
    const speech = Speech({ voice: "adam", children: "long narration..." });
    const audio = makeResolved(speech, 12.4);

    const clipDuration = 2;
    const numClips = Math.ceil(audio.duration / clipDuration);

    expect(numClips).toBe(7); // ceil(12.4 / 2) = 7

    const clips = Array.from({ length: numClips }, (_, i) =>
      Clip({
        duration: Math.min(clipDuration, audio.duration - i * clipDuration),
        key: i,
      }),
    );

    expect(clips.length).toBe(7);
    expect(clips[0]!.props.duration).toBe(2);
    expect(clips[6]!.props.duration).toBeCloseTo(0.4); // 12.4 - 6*2 = 0.4
  });
});

// ---------------------------------------------------------------------------
// Phase 2: JSX runtime lazy wrapping
// ---------------------------------------------------------------------------
describe("JSX runtime lazy wrapping", () => {
  // Import the jsx function directly
  const { jsx } = require("./runtime/jsx-runtime");

  test("sync component returns VargElement directly", () => {
    function SyncScene(props: Record<string, unknown>) {
      return Clip({ duration: 5 });
    }

    const result = jsx(SyncScene, {});
    expect(result.type).toBe("clip");
  });

  test("async component is wrapped as __lazy element", () => {
    async function AsyncScene(props: Record<string, unknown>) {
      return Clip({ duration: 5 });
    }

    const result = jsx(AsyncScene, {});
    expect(result.type).toBe("__lazy");
    expect(result.props._promise).toBeInstanceOf(Promise);
  });

  test("thenable VargElement (Speech) is NOT wrapped as __lazy", () => {
    // Speech() returns an object with both .type and .then
    // The JSX runtime should recognize this as a VargElement, not a Promise
    const result = jsx(Speech, { voice: "adam", children: "test" });
    expect(result.type).toBe("speech");
    expect(result.type).not.toBe("__lazy");
  });
});

// ---------------------------------------------------------------------------
// Phase 2: resolveLazy
// ---------------------------------------------------------------------------
describe("resolveLazy", () => {
  test("passes through plain VargElements unchanged", async () => {
    const element = Render({
      width: 1080,
      height: 1920,
      children: [Clip({ duration: 5 })],
    });

    const resolved = (await resolveLazy(element)) as VargElement;
    expect(resolved.type).toBe("render");
    expect((resolved.children[0] as VargElement).type).toBe("clip");
  });

  test("passes through primitives and nulls", async () => {
    expect(await resolveLazy(null)).toBe(null);
    expect(await resolveLazy(undefined)).toBe(undefined);
    expect(await resolveLazy("hello")).toBe("hello");
    expect(await resolveLazy(42)).toBe(42);
  });

  test("resolves a __lazy element", async () => {
    const lazyElement: VargElement<"__lazy"> = {
      type: "__lazy",
      props: {
        _promise: Promise.resolve(Clip({ duration: 10 })),
      },
      children: [],
    };

    const resolved = (await resolveLazy(lazyElement)) as VargElement;
    expect(resolved.type).toBe("clip");
    expect(resolved.props.duration).toBe(10);
  });

  test("resolves __lazy that returns an array (Fragment)", async () => {
    const lazyElement: VargElement<"__lazy"> = {
      type: "__lazy",
      props: {
        _promise: Promise.resolve([
          Clip({ duration: 3 }),
          Clip({ duration: 5 }),
        ]),
      },
      children: [],
    };

    const resolved = await resolveLazy(lazyElement);
    expect(Array.isArray(resolved)).toBe(true);
    const arr = resolved as VargNode[];
    expect(arr.length).toBe(2);
    expect((arr[0] as VargElement).type).toBe("clip");
    expect((arr[1] as VargElement).type).toBe("clip");
  });

  test("resolves nested __lazy elements", async () => {
    const innerLazy: VargElement<"__lazy"> = {
      type: "__lazy",
      props: { _promise: Promise.resolve(Clip({ duration: 7 })) },
      children: [],
    };

    const outerLazy: VargElement<"__lazy"> = {
      type: "__lazy",
      props: { _promise: Promise.resolve(innerLazy) },
      children: [],
    };

    const resolved = (await resolveLazy(outerLazy)) as VargElement;
    expect(resolved.type).toBe("clip");
    expect(resolved.props.duration).toBe(7);
  });

  test("resolves __lazy inside Render children", async () => {
    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({ duration: 3 }),
        {
          type: "__lazy" as const,
          props: {
            _promise: Promise.resolve([
              Clip({ duration: 5 }),
              Clip({ duration: 4 }),
            ]),
          },
          children: [],
        } as VargElement<"__lazy">,
        Clip({ duration: 2 }),
      ],
    });

    const resolved = (await resolveLazy(tree)) as VargElement<"render">;
    expect(resolved.type).toBe("render");

    // Should have 4 children: the original Clip(3), the two from the lazy, and Clip(2)
    const children = resolved.children as VargElement[];
    expect(children.length).toBe(4);
    expect(children[0]!.props.duration).toBe(3);
    expect(children[1]!.props.duration).toBe(5);
    expect(children[2]!.props.duration).toBe(4);
    expect(children[3]!.props.duration).toBe(2);
  });

  test("resolves async Scene-like component pattern", async () => {
    // Simulates the strawberry-vs-chocolate example
    async function Scene(props: { text: string; clipCount: number }) {
      // In real code this would be: const audio = await Speech({...})
      // Here we simulate it with a resolved element
      const clips = Array.from({ length: props.clipCount }, (_, i) =>
        Clip({ duration: 2, key: i }),
      );
      return clips; // Fragment-like return (array)
    }

    const { jsx } = require("./runtime/jsx-runtime");

    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        jsx(Scene, { text: "strawberry", clipCount: 3 }),
        jsx(Scene, { text: "chocolate", clipCount: 2 }),
      ],
    });

    // Before resolution: children contain __lazy elements
    expect((tree.children[0] as VargElement).type).toBe("__lazy");
    expect((tree.children[1] as VargElement).type).toBe("__lazy");

    // After resolution: lazy elements are replaced with clip arrays
    const resolved = (await resolveLazy(tree)) as VargElement<"render">;
    const children = resolved.children as VargElement[];

    // 3 clips from strawberry + 2 from chocolate = 5 total
    expect(children.length).toBe(5);
    for (const child of children) {
      expect(child.type).toBe("clip");
      expect(child.props.duration).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Nested clips (container clip pattern)
// ---------------------------------------------------------------------------
describe("nested clips (container clip pattern)", () => {
  test("container clip with child clips produces correct structure", () => {
    // Pattern 1: shared audio across sub-clips
    const audio = makeResolved(
      Speech({ voice: "adam", children: "hello world" }),
      4.0,
    );

    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({
          duration: audio.duration,
          children: [
            Clip({
              duration: 2,
              children: [Image({ prompt: "black dog" })],
            }),
            Clip({
              duration: 2,
              children: [Image({ prompt: "orange cat" })],
            }),
            Captions({
              src: audio as unknown as VargElement<"speech">,
              style: "tiktok",
              withAudio: true,
            }),
          ],
        }),
      ],
    });

    expect(tree.type).toBe("render");
    // The outer Clip is a container — it has child clips
    const containerClip = tree.children[0] as VargElement<"clip">;
    expect(containerClip.type).toBe("clip");
    expect(containerClip.props.duration).toBe(4.0);

    // Container has 3 children: 2 inner clips + captions
    expect(containerClip.children.length).toBe(3);
    expect((containerClip.children[0] as VargElement).type).toBe("clip");
    expect((containerClip.children[1] as VargElement).type).toBe("clip");
    expect((containerClip.children[2] as VargElement).type).toBe("captions");
  });

  test("pattern 2: per-clip audio with auto-duration parent", () => {
    const s1 = makeResolved(
      Speech({ voice: "adam", children: "this is a black dog" }),
      2.5,
    );
    const s2 = makeResolved(
      Speech({ voice: "adam", children: "this is an orange cat" }),
      3.0,
    );

    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({
          children: [
            Clip({
              duration: s1.duration,
              children: [
                Image({ prompt: "black dog" }),
                s1 as unknown as VargNode,
              ],
            }),
            Clip({
              duration: s2.duration,
              children: [
                Image({ prompt: "orange cat" }),
                s2 as unknown as VargNode,
              ],
            }),
          ],
        }),
      ],
    });

    // Outer clip has no explicit duration — children define it
    const containerClip = tree.children[0] as VargElement<"clip">;
    expect(containerClip.type).toBe("clip");
    expect(containerClip.props.duration).toBeUndefined();

    // Inner clips have durations matching their speech
    const inner0 = containerClip.children[0] as VargElement<"clip">;
    const inner1 = containerClip.children[1] as VargElement<"clip">;
    expect(inner0.props.duration).toBe(2.5);
    expect(inner1.props.duration).toBe(3.0);
  });

  test("3-level nesting produces correct flat structure", () => {
    // Scene > Acts > Clips
    const tree = Render({
      width: 1080,
      height: 1920,
      children: [
        Clip({
          children: [
            Clip({
              children: [
                Clip({ duration: 3, children: [Image({ prompt: "a" })] }),
                Clip({ duration: 3, children: [Image({ prompt: "b" })] }),
              ],
            }),
            Clip({
              duration: 4,
              children: [Image({ prompt: "c" })],
            }),
          ],
        }),
      ],
    });

    // Verify the structure exists — the flattening happens inside renderRoot,
    // which we can't easily unit test without mocking the whole render pipeline.
    // But we can verify the element tree is valid.
    const scene = tree.children[0] as VargElement<"clip">;
    expect(scene.type).toBe("clip");
    const act1 = scene.children[0] as VargElement<"clip">;
    const act2 = scene.children[1] as VargElement<"clip">;
    expect(act1.type).toBe("clip");
    expect(act2.type).toBe("clip");
    expect(act2.props.duration).toBe(4);

    const clip1 = act1.children[0] as VargElement<"clip">;
    const clip2 = act1.children[1] as VargElement<"clip">;
    expect(clip1.props.duration).toBe(3);
    expect(clip2.props.duration).toBe(3);
  });

  test("async Scene component with container clip pattern", async () => {
    const { jsx } = require("./runtime/jsx-runtime");

    async function Scene(props: { clipCount: number }) {
      const audio = makeResolved(
        Speech({ voice: "adam", children: "narration" }),
        props.clipCount * 2,
      );

      return Clip({
        duration: audio.duration,
        children: [
          ...Array.from({ length: props.clipCount }, (_, i) =>
            Clip({
              duration: 2,
              children: [Image({ prompt: `image ${i}` })],
            }),
          ),
          Captions({
            src: audio as unknown as VargElement<"speech">,
            style: "tiktok",
            withAudio: true,
          }),
        ],
      });
    }

    const tree = Render({
      width: 1080,
      height: 1920,
      children: [jsx(Scene, { clipCount: 3 }), jsx(Scene, { clipCount: 2 })],
    });

    // Before resolution: lazy elements
    expect((tree.children[0] as VargElement).type).toBe("__lazy");
    expect((tree.children[1] as VargElement).type).toBe("__lazy");

    // After resolution: container clips
    const resolved = (await resolveLazy(tree)) as VargElement<"render">;
    const children = resolved.children as VargElement[];

    expect(children.length).toBe(2);
    expect(children[0]!.type).toBe("clip");
    expect(children[0]!.props.duration).toBe(6); // 3 clips * 2s
    expect(children[1]!.type).toBe("clip");
    expect(children[1]!.props.duration).toBe(4); // 2 clips * 2s

    // First container has 3 inner clips + 1 captions = 4 children
    expect(children[0]!.children.length).toBe(4);
    // Second container has 2 inner clips + 1 captions = 3 children
    expect(children[1]!.children.length).toBe(3);
  });
});
