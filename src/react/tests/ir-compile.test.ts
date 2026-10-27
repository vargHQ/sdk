import { describe, expect, test } from "bun:test";
import { File } from "../../ai-sdk/file";
import { Captions, Clip, Image, Render, Speech, Video } from "../elements";
import { compile } from "../ir/compile";
import { topoSort } from "../ir/topo-sort";
import type { Step } from "../ir/types";
import { ResolvedElement } from "../resolved-element";
import type { VargElement } from "../types";

function makeStep(id: string, dependsOn: Step[] = []): Step {
  return {
    id,
    kind: "generate-image",
    element: { type: "image", props: {}, children: [] },
    dependsOn,
    cacheKey: "",
    status: "pending",
    label: id,
    path: [],
  };
}

describe("topoSort", () => {
  test("orders dependencies before dependents", () => {
    const a = makeStep("a");
    const b = makeStep("b", [a]);
    const c = makeStep("c", [b]);
    const sorted = topoSort([c, b, a]);
    expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  test("throws on circular dependency", () => {
    const a = makeStep("a");
    const b = makeStep("b", [a]);
    a.dependsOn.push(b);
    expect(() => topoSort([a, b])).toThrow(/Circular dependency/);
  });

  test("stable for independent steps", () => {
    const a = makeStep("a");
    const b = makeStep("b");
    expect(topoSort([a, b]).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("compile", () => {
  test("errors when root is not <Render>", () => {
    const clip = Clip({ duration: 3 });
    const plan = compile(clip);
    expect(plan.hasErrors()).toBe(true);
    expect(plan.errors[0]?.code).toBe("VARG_ROOT_NOT_RENDER");
  });

  test("builds steps for a simple render tree", () => {
    const tree = Render({
      children: Clip({
        duration: 3,
        children: Image({ prompt: "a cat", src: undefined }),
      }),
    });
    const plan = compile(tree);
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds).toContain("generate-image");
    expect(kinds[kinds.length - 1]).toBe("compose");
  });

  test("nested prompt.images become dependencies, image before video", () => {
    const img = Image({ prompt: "portrait" });
    const vid = Video({ prompt: { text: "talk", images: [img] } });
    const tree = Render({
      children: Clip({ duration: 3, children: vid }),
    });
    const plan = compile(tree);
    const imageStep = plan.steps.find((s) => s.kind === "generate-image");
    const videoStep = plan.steps.find((s) => s.kind === "generate-video");
    expect(imageStep).toBeDefined();
    expect(videoStep).toBeDefined();
    expect(videoStep!.dependsOn).toContain(imageStep!);
    expect(plan.steps.indexOf(imageStep!)).toBeLessThan(
      plan.steps.indexOf(videoStep!),
    );
  });

  test("shared element (same reference) produces a single step", () => {
    const img = Image({ prompt: "portrait" });
    const vid1 = Video({ prompt: { text: "a", images: [img] } });
    const vid2 = Video({ prompt: { text: "b", images: [img] } });
    const tree = Render({
      children: [
        Clip({ duration: 3, children: vid1 }),
        Clip({ duration: 3, children: vid2 }),
      ],
    });
    const plan = compile(tree);
    const imageSteps = plan.steps.filter((s) => s.kind === "generate-image");
    expect(imageSteps.length).toBe(1);
  });

  test("pre-resolved elements get status skipped", () => {
    const resolved = new ResolvedElement(
      { type: "speech", props: {}, children: ["hello"] },
      {
        file: File.fromBuffer(new Uint8Array([1]), "audio/mp3"),
        duration: 2,
      },
    );
    const tree = Render({
      children: Clip({
        duration: 2,
        children: resolved as unknown as VargElement,
      }),
    });
    const plan = compile(tree);
    const speechStep = plan.steps.find((s) => s.kind === "generate-speech");
    expect(speechStep?.status).toBe("skipped");
  });

  test("audio native + keepAudio false is a validation error", () => {
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      keepAudio: false,
    });
    const tree = Render({ children: Clip({ duration: 3, children: vid }) });
    const plan = compile(tree);
    expect(plan.hasErrors()).toBe(true);
    expect(plan.errors.some((d) => d.code === "VARG_AUDIO_CONFLICT")).toBe(
      true,
    );
  });

  test("audio native + generate_audio false is a validation error", () => {
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      providerOptions: { fal: { generate_audio: false } },
    });
    const tree = Render({ children: Clip({ duration: 3, children: vid }) });
    const plan = compile(tree);
    expect(plan.errors.some((d) => d.code === "VARG_AUDIO_CONFLICT")).toBe(
      true,
    );
  });

  test("audio native + nested varg.fal.generate_audio false is a validation error", () => {
    const vid = Video({
      prompt: "sunset",
      audio: "native",
      providerOptions: { varg: { fal: { generate_audio: false } } },
    });
    const tree = Render({ children: Clip({ duration: 3, children: vid }) });
    const plan = compile(tree);
    expect(plan.errors.some((d) => d.code === "VARG_AUDIO_CONFLICT")).toBe(
      true,
    );
  });

  test("audio native alone is valid", () => {
    const vid = Video({ prompt: "sunset", audio: "native" });
    const tree = Render({ children: Clip({ duration: 3, children: vid }) });
    const plan = compile(tree);
    expect(plan.errors.filter((d) => d.code === "VARG_AUDIO_CONFLICT")).toEqual(
      [],
    );
  });

  test("missing prompt and src is an error", () => {
    const tree = Render({
      children: Clip({
        duration: 3,
        children: { type: "video", props: {}, children: [] } as VargElement,
      }),
    });
    const plan = compile(tree);
    expect(plan.errors.some((d) => d.code === "VARG_MISSING_SOURCE")).toBe(
      true,
    );
  });

  test("speech as clip child creates a generate-speech step", () => {
    const tree = Render({
      children: Clip({
        duration: 3,
        children: Speech({ voice: "adam", children: "hello" }),
      }),
    });
    const plan = compile(tree);
    expect(plan.steps.some((s) => s.kind === "generate-speech")).toBe(true);
  });

  test("toJSON is serializable and stable", () => {
    const img = Image({ prompt: "portrait" });
    const vid = Video({ prompt: { text: "talk", images: [img] } });
    const tree = Render({ children: Clip({ duration: 3, children: vid }) });
    const json = compile(tree).toJSON();
    expect(() => JSON.stringify(json)).not.toThrow();
    expect(json.steps.every((s) => Array.isArray(s.dependsOn))).toBe(true);
    // dependsOn serialized as ids
    const videoStep = json.steps.find((s) => s.kind === "generate-video");
    const imageStep = json.steps.find((s) => s.kind === "generate-image");
    expect(videoStep!.dependsOn).toContain(imageStep!.id);
  });

  test("video.audio node creates extract-audio step depending on the video", () => {
    const vid = Video({ prompt: "sunset" });
    const tree = Render({
      children: [Clip({ duration: 3, children: vid }), vid.audio],
    });
    const plan = compile(tree);
    const videoStep = plan.steps.find((s) => s.kind === "generate-video");
    const audioStep = plan.steps.find((s) => s.kind === "extract-audio");
    expect(videoStep).toBeDefined();
    expect(audioStep).toBeDefined();
    expect(audioStep!.dependsOn).toContain(videoStep!);
    expect(plan.steps.indexOf(videoStep!)).toBeLessThan(
      plan.steps.indexOf(audioStep!),
    );
    // video is shared between the clip and the audio derivation — one step
    expect(plan.steps.filter((s) => s.kind === "generate-video").length).toBe(
      1,
    );
  });

  test("Captions src={vid.audio} discovers the extract-audio dependency", () => {
    const vid = Video({ prompt: "sunset" });
    const tree = Render({
      children: [
        Clip({ duration: 3, children: vid }),
        Captions({ src: vid.audio, style: "tiktok" }),
      ],
    });
    const plan = compile(tree);
    expect(plan.steps.some((s) => s.kind === "extract-audio")).toBe(true);
  });

  test("clip paths carry indices", () => {
    const tree = Render({
      children: [
        Clip({ duration: 3, children: Image({ prompt: "one" }) }),
        Clip({ duration: 3, children: Image({ prompt: "two" }) }),
      ],
    });
    const plan = compile(tree);
    const imageSteps = plan.steps.filter((s) => s.kind === "generate-image");
    expect(imageSteps[0]?.path).toEqual(["render", "clip[0]", "image"]);
    expect(imageSteps[1]?.path).toEqual(["render", "clip[1]", "image"]);
  });
});
