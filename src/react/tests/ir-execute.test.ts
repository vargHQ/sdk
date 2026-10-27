import { describe, expect, mock, test } from "bun:test";
import { File } from "../../ai-sdk/file";
import { Clip, Image, Render, Video } from "../elements";
import { compile } from "../ir/compile";
import { executePlan } from "../ir/execute";
import type { StepEvent } from "../ir/types";
import type { RenderContext } from "../renderers/context";
import type { VargElement } from "../types";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function makeMockImageModel(
  onGenerate?: () => void | Promise<void>,
): NonNullable<import("../types").ImageProps["model"]> {
  return {
    specificationVersion: "v3",
    provider: "mock",
    modelId: "mock-image",
    maxImagesPerCall: 1,
    doGenerate: mock(async () => {
      await onGenerate?.();
      return {
        images: [PNG_BYTES],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "mock-image",
          headers: undefined,
        },
      };
    }),
    // biome-ignore lint/suspicious/noExplicitAny: minimal mock model
  } as any;
}

function makeCtx(overrides: Partial<RenderContext> = {}): RenderContext {
  const { generateImage } = require("ai");
  return {
    width: 720,
    height: 720,
    fps: 30,
    generateImage,
    // biome-ignore lint/suspicious/noExplicitAny: unused in these tests
    generateVideo: (async () => {
      throw new Error("generateVideo not mocked");
    }) as any,
    // biome-ignore lint/suspicious/noExplicitAny: unused in these tests
    generateSpeech: (async () => {
      throw new Error("generateSpeech not mocked");
    }) as any,
    // biome-ignore lint/suspicious/noExplicitAny: unused in these tests
    generateMusic: (async () => {
      throw new Error("generateMusic not mocked");
    }) as any,
    tempFiles: [],
    pendingFiles: new Map(),
    generatedFiles: [],
    // biome-ignore lint/suspicious/noExplicitAny: backend not exercised by image steps
    backend: {
      name: "mock",
      ffprobe: async () => ({ duration: 0 }),
      resolvePath: async () => "/tmp/mock",
      run: async () => ({ output: { type: "file", path: "/tmp/mock" } }),
    } as any,
    ...overrides,
  };
}

describe("executePlan", () => {
  test("executes image steps and writes meta back onto elements", async () => {
    const img = Image({ prompt: "a cat", model: makeMockImageModel() });
    const tree = Render({
      children: Clip({ duration: 2, children: img }),
    });
    const plan = compile(tree);
    const ctx = makeCtx();

    await executePlan(plan, ctx);

    expect(img.meta?.file).toBeInstanceOf(File);
    const step = plan.steps.find((s) => s.kind === "generate-image");
    expect(step?.status).toBe("done");
  });

  test("skips pre-resolved elements without calling the model", async () => {
    let calls = 0;
    const model = makeMockImageModel(() => {
      calls++;
    });
    const img = Image({ prompt: "a cat", model });
    // Simulate prior resolution
    img.meta = {
      file: File.fromBuffer(PNG_BYTES, "image/png"),
      duration: 0,
    };
    const tree = Render({ children: Clip({ duration: 2, children: img }) });
    const plan = compile(tree);

    const events: StepEvent[] = [];
    await executePlan(plan, makeCtx(), { onEvent: (e) => events.push(e) });

    expect(calls).toBe(0);
    expect(events.some((e) => e.type === "step-skipped")).toBe(true);
  });

  test("emits plan/step-start/step-complete events in order", async () => {
    const img = Image({ prompt: "a cat", model: makeMockImageModel() });
    const tree = Render({ children: Clip({ duration: 2, children: img }) });
    const plan = compile(tree);

    const events: StepEvent[] = [];
    await executePlan(plan, makeCtx(), { onEvent: (e) => events.push(e) });

    const types = events.map((e) => e.type);
    expect(types[0]).toBe("plan");
    expect(types).toContain("step-start");
    expect(types).toContain("step-complete");
    expect(types.indexOf("step-start")).toBeLessThan(
      types.indexOf("step-complete"),
    );
    expect(events[0]?.totalSteps).toBe(1);
  });

  test("respects dependency order: image completes before dependent video starts", async () => {
    const order: string[] = [];
    const imgModel = makeMockImageModel(() => {
      order.push("image");
    });
    const img = Image({ prompt: "portrait", model: imgModel });
    const vid = Video({
      prompt: { text: "animate", images: [img] },
      // biome-ignore lint/suspicious/noExplicitAny: minimal mock model
      model: { provider: "mock", modelId: "mock-video" } as any,
    });
    const tree = Render({ children: Clip({ duration: 2, children: vid }) });
    const plan = compile(tree);

    const ctx = makeCtx({
      // biome-ignore lint/suspicious/noExplicitAny: mock generateVideo
      generateVideo: (async () => {
        order.push("video");
        return {
          video: { uint8Array: PNG_BYTES, mimeType: "video/mp4" },
        };
      }) as any,
    });

    await executePlan(plan, ctx);
    expect(order).toEqual(["image", "video"]);
  });

  test("deduplicates shared elements (single generation for shared image)", async () => {
    let calls = 0;
    const model = makeMockImageModel(() => {
      calls++;
    });
    const img = Image({ prompt: "shared portrait", model });
    const tree = Render({
      children: [
        Clip({ duration: 2, children: img }),
        Clip({ duration: 2, children: img }),
      ],
    });
    const plan = compile(tree);
    await executePlan(plan, makeCtx());
    expect(calls).toBe(1);
  });

  test("throwOnError: true (default) rethrows step failures", async () => {
    const model = makeMockImageModel(() => {
      throw new Error("boom");
    });
    const img = Image({ prompt: "failing", model });
    const tree = Render({ children: Clip({ duration: 2, children: img }) });
    const plan = compile(tree);

    await expect(executePlan(plan, makeCtx())).rejects.toThrow("boom");
  });

  test("throwOnError: false records failure in step status without throwing", async () => {
    const model = makeMockImageModel(() => {
      throw new Error("boom");
    });
    const img = Image({ prompt: "failing quietly", model });
    const tree = Render({ children: Clip({ duration: 2, children: img }) });
    const plan = compile(tree);

    const events: StepEvent[] = [];
    await executePlan(plan, makeCtx(), {
      throwOnError: false,
      onEvent: (e) => events.push(e),
    });

    const step = plan.steps.find((s) => s.kind === "generate-image");
    expect(step?.status).toBe("failed");
    expect(events.some((e) => e.type === "step-failed")).toBe(true);
  });

  test("respects concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const model = makeMockImageModel(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 20));
      active--;
    });

    const tree = Render({
      children: [1, 2, 3, 4, 5].map((i) =>
        Clip({
          duration: 1,
          children: Image({ prompt: `img ${i}`, model }),
        }),
      ),
    });
    const plan = compile(tree);
    await executePlan(plan, makeCtx(), { concurrency: 2 });
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});

describe("render = compile + execute integration", () => {
  test("render() fails fast with CompileError before generating", async () => {
    const { render } = await import("../render");
    const { CompileError } = await import("../ir/types");

    let calls = 0;
    const model = makeMockImageModel(() => {
      calls++;
    });
    const tree = Render({
      children: Clip({
        duration: 2,
        children: [
          Image({ prompt: "valid", model }),
          // audio: "native" + keepAudio: false — validation error
          Video({
            prompt: "sunset",
            audio: "native",
            keepAudio: false,
            // biome-ignore lint/suspicious/noExplicitAny: mock model
            model: { provider: "mock", modelId: "mock-video" } as any,
          }),
        ],
      }),
    });

    const error = await render(tree, { quiet: true }).catch((e) => e);
    expect(error).toBeInstanceOf(CompileError);
    expect(error.message).toContain("VARG_AUDIO_CONFLICT");
    // Fail-fast: no generation happened before validation
    expect(calls).toBe(0);
  });

  test("renderStream yields step events with progress", async () => {
    const { renderStream } = await import("../render");
    const img = Image({ prompt: "streamed cat", model: makeMockImageModel() });
    const tree = Render({
      width: 320,
      height: 240,
      children: Clip({ duration: 1, children: img }),
    });

    const eventTypes: string[] = [];
    let sawComplete = false;
    try {
      for await (const event of renderStream.stream(tree, { quiet: true })) {
        eventTypes.push(event.type);
        if (event.type === "complete") {
          sawComplete = true;
          expect(event.result.video).toBeInstanceOf(Uint8Array);
        }
      }
    } catch {
      // editly/ffmpeg may be unavailable in CI — step events must still
      // have been emitted before the compose phase failed.
    }

    expect(eventTypes[0]).toBe("start");
    expect(eventTypes).toContain("step");
    if (sawComplete) {
      expect(eventTypes[eventTypes.length - 1]).toBe("complete");
    }
  });

  test("onStep prop fires for each step event", async () => {
    const { render } = await import("../render");
    const stepTypes: string[] = [];
    const img = Image({ prompt: "hook test", model: makeMockImageModel() });
    const tree = Render({
      width: 320,
      height: 240,
      onStep: (event) => stepTypes.push(event.type),
      children: Clip({ duration: 1, children: img }),
    });

    try {
      await render(tree, { quiet: true });
    } catch {
      // editly may fail in CI — step events fire before compose
    }
    expect(stepTypes).toContain("plan");
    expect(stepTypes).toContain("step-start");
    expect(stepTypes).toContain("step-complete");
  });

  test("onError prop fires on compile validation failure", async () => {
    const { render } = await import("../render");
    let caught: Error | undefined;
    const tree = Render({
      onError: (err) => {
        caught = err;
      },
      children: Clip({
        duration: 2,
        children: Video({
          prompt: "sunset",
          audio: "native",
          keepAudio: false,
          // biome-ignore lint/suspicious/noExplicitAny: mock model
          model: { provider: "mock", modelId: "mock-video" } as any,
        }),
      }),
    });

    await render(tree, { quiet: true }).catch(() => {});
    expect(caught).toBeDefined();
    expect(caught?.message).toContain("VARG_AUDIO_CONFLICT");
  });
});
