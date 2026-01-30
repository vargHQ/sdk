import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageModelV3 } from "@ai-sdk/provider";
import type { VideoModelV3 } from "../ai-sdk/video-model";
import { Image, Video, Music, Speech, Clip, Render } from "../react/elements";
import type { VargElement } from "../react/types";
import {
  createStepSession,
  getSession,
  deleteSession,
  executeStage,
  executeNextStage,
  getStagePreviewPath,
  finalizeRender,
  getSessionStatus,
  type StepSession,
} from "./step-renderer";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "varg-step-test-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function createTestImageModel(): ImageModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-image",
    maxImagesPerCall: 1,
    async doGenerate() {
      return {
        images: [new Uint8Array([137, 80, 78, 71])],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-image",
          headers: undefined,
        },
      };
    },
  };
}

function createTestVideoModel(): VideoModelV3 {
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "test-video",
    maxVideosPerCall: 1,
    async doGenerate() {
      return {
        videos: [new Uint8Array([0, 0, 0, 32])],
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId: "test-video",
          headers: undefined,
        },
      };
    },
  };
}

describe("createStepSession", () => {
  test("creates session with default render props", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    expect(session).toBeDefined();
    expect(session.id).toMatch(/^step-\d+-[a-z0-9]+$/);
    expect(session.code).toBe("code");
    expect(session.rootElement).toBe(rootElement);
    expect(session.ctx.width).toBe(1920);
    expect(session.ctx.height).toBe(1080);
    expect(session.ctx.fps).toBe(30);
  });

  test("uses custom dimensions from render props", () => {
    const rootElement = Render({ width: 1280, height: 720, fps: 60 });
    const session = createStepSession("code", rootElement);

    expect(session.ctx.width).toBe(1280);
    expect(session.ctx.height).toBe(720);
    expect(session.ctx.fps).toBe(60);
  });

  test("creates context without cache when not provided", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    expect(session.ctx.cache).toBeUndefined();
  });

  test("creates context with string cache path", () => {
    const cacheDir = makeTempDir();
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement, cacheDir);

    expect(session.ctx.cache).toBeDefined();
    cleanupTempDir(cacheDir);
  });

  test("initializes results map as empty", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    expect(session.results.size).toBe(0);
  });

  test("initializes currentStageIndex to 0", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    expect(session.currentStageIndex).toBe(0);
  });

  test("extracts stages from root element", () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    expect(session.extracted.stages.length).toBeGreaterThan(0);
  });

  test("generates unique session ID", () => {
    const rootElement = Render({ children: [] });
    const session1 = createStepSession("code1", rootElement);
    const session2 = createStepSession("code2", rootElement);

    expect(session1.id).not.toBe(session2.id);
  });

  test("stores session in sessions map", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    expect(getSession(session.id)).toBe(session);
  });
});

describe("getSession", () => {
  test("returns existing session by id", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    const retrieved = getSession(session.id);
    expect(retrieved).toBe(session);
  });

  test("returns undefined for non-existent session", () => {
    const retrieved = getSession("non-existent-id");
    expect(retrieved).toBeUndefined();
  });
});

describe("deleteSession", () => {
  test("removes session from sessions map", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    deleteSession(session.id);
    expect(getSession(session.id)).toBeUndefined();
  });

  test("is safe to call with non-existent id", () => {
    expect(() => deleteSession("non-existent-id")).not.toThrow();
  });
});

describe("executeStage", () => {
  let session: StepSession;

  beforeEach(() => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test image", model: imageModel })],
        }),
      ],
    });
    session = createStepSession("code", rootElement);
  });

  afterEach(() => {
    deleteSession(session.id);
  });

  test("throws error for non-existent stage", async () => {
    expect(executeStage(session, "non-existent")).rejects.toThrow(
      "Stage non-existent not found"
    );
  });

  test("throws error when dependency not executed", async () => {
    const imageModel = createTestImageModel();
    const videoModel = createTestVideoModel();
    const img = Image({ prompt: "base", model: imageModel });
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [
            Video({ prompt: { text: "test", images: [img] }, model: videoModel }),
          ],
        }),
      ],
    });
    const sess = createStepSession("code", rootElement);

    // Try to execute video stage before image stage
    const videoStage = sess.extracted.stages.find((s) => s.type === "video");
    if (videoStage && videoStage.dependsOn.length > 0) {
      expect(executeStage(sess, videoStage.id)).rejects.toThrow("not yet executed");
    }
    deleteSession(sess.id);
  });

  test("executes image stage successfully", async () => {
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    const result = await executeStage(session, stage.id);

    expect(result.type).toBe("image");
    expect(result.path).toBeDefined();
    expect(result.mimeType).toBe("image/png");
    expect(stage.status).toBe("complete");
  });

  test("stores result in session results map", async () => {
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    const result = await executeStage(session, stage.id);

    expect(session.results.has(stage.id)).toBe(true);
    expect(session.results.get(stage.id)).toBe(result);
  });

  test("sets stage status to running before execution", async () => {
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    const promise = executeStage(session, stage.id);
    expect(stage.status).toBe("running");
    await promise;
  });

  test("sets stage status to complete after success", async () => {
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    await executeStage(session, stage.id);
    expect(stage.status).toBe("complete");
  });

  test("sets stage status to error on failure", async () => {
    const brokenModel: ImageModelV3 = {
      specificationVersion: "v3",
      provider: "test",
      modelId: "broken",
      maxImagesPerCall: 1,
      async doGenerate() {
        throw new Error("Generation failed");
      },
    };

    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "fail", model: brokenModel })],
        }),
      ],
    });
    const sess = createStepSession("code", rootElement);
    const stage = sess.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    try {
      await executeStage(sess, stage.id);
    } catch {
      expect(stage.status).toBe("error");
    }
    deleteSession(sess.id);
  });

  test("executes video stage", async () => {
    const videoModel = createTestVideoModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Video({ prompt: "test video", model: videoModel })],
        }),
      ],
    });
    const sess = createStepSession("code", rootElement);
    const stage = sess.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    const result = await executeStage(sess, stage.id);

    expect(result.type).toBe("video");
    expect(result.mimeType).toBe("video/mp4");
    deleteSession(sess.id);
  });

  test("includes previewUrl in result", async () => {
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    const result = await executeStage(session, stage.id);

    expect(result.previewUrl).toBeDefined();
    expect(result.previewUrl).toContain(session.id);
    expect(result.previewUrl).toContain(stage.id);
  });
});

describe("executeNextStage", () => {
  test("executes stages in order", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [
            Image({ prompt: "img1", model: imageModel }),
            Image({ prompt: "img2", model: imageModel }),
          ],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    const result1 = await executeNextStage(session);
    expect(result1).not.toBeNull();
    expect(session.currentStageIndex).toBe(1);

    const result2 = await executeNextStage(session);
    expect(result2).not.toBeNull();
    expect(session.currentStageIndex).toBe(2);

    deleteSession(session.id);
  });

  test("returns null when all stages completed", async () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    const result = await executeNextStage(session);
    expect(result).toBeNull();

    deleteSession(session.id);
  });

  test("returns isLast=true for final stage", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "only", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    const result = await executeNextStage(session);
    expect(result?.isLast).toBe(true);

    deleteSession(session.id);
  });

  test("returns isLast=false for non-final stages", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [
            Image({ prompt: "first", model: imageModel }),
            Image({ prompt: "second", model: imageModel }),
          ],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    const result = await executeNextStage(session);
    expect(result?.isLast).toBe(false);

    deleteSession(session.id);
  });

  test("increments currentStageIndex", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    expect(session.currentStageIndex).toBe(0);
    await executeNextStage(session);
    expect(session.currentStageIndex).toBe(1);

    deleteSession(session.id);
  });
});

describe("getStagePreviewPath", () => {
  test("returns path for executed stage", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    await executeStage(session, stage.id);
    const path = getStagePreviewPath(session, stage.id);

    expect(path).not.toBeNull();
    expect(typeof path).toBe("string");

    deleteSession(session.id);
  });

  test("returns null for non-executed stage", () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);
    const stage = session.extracted.stages[0];
    if (!stage) throw new Error("No stages found");

    const path = getStagePreviewPath(session, stage.id);
    expect(path).toBeNull();

    deleteSession(session.id);
  });

  test("returns null for non-existent stage", () => {
    const rootElement = Render({ children: [] });
    const session = createStepSession("code", rootElement);

    const path = getStagePreviewPath(session, "non-existent");
    expect(path).toBeNull();

    deleteSession(session.id);
  });
});

describe("getSessionStatus", () => {
  test("returns complete session status", () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    const status = getSessionStatus(session);

    expect(status.sessionId).toBe(session.id);
    expect(status.totalStages).toBe(session.extracted.stages.length);
    expect(status.completedStages).toBe(0);
    expect(status.currentStageIndex).toBe(0);
    expect(status.stages).toHaveLength(session.extracted.stages.length);

    deleteSession(session.id);
  });

  test("tracks completed stages count", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [
            Image({ prompt: "img1", model: imageModel }),
            Image({ prompt: "img2", model: imageModel }),
          ],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    await executeNextStage(session);
    const status = getSessionStatus(session);

    expect(status.completedStages).toBe(1);

    deleteSession(session.id);
  });

  test("includes stage details", () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    const status = getSessionStatus(session);
    const stageStatus = status.stages[0];

    expect(stageStatus).toBeDefined();
    expect(stageStatus?.id).toBeDefined();
    expect(stageStatus?.type).toBe("image");
    expect(stageStatus?.label).toContain("test");
    expect(stageStatus?.status).toBe("pending");
    expect(stageStatus?.hasResult).toBe(false);
    expect(Array.isArray(stageStatus?.dependsOn)).toBe(true);

    deleteSession(session.id);
  });

  test("reflects stage execution in status", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });
    const session = createStepSession("code", rootElement);

    await executeNextStage(session);
    const status = getSessionStatus(session);
    const stageStatus = status.stages[0];

    expect(stageStatus?.status).toBe("complete");
    expect(stageStatus?.hasResult).toBe(true);

    deleteSession(session.id);
  });
});

describe("session lifecycle", () => {
  test("complete workflow from creation to execution", async () => {
    const imageModel = createTestImageModel();
    const rootElement = Render({
      children: [
        Clip({
          duration: 2,
          children: [Image({ prompt: "test", model: imageModel })],
        }),
      ],
    });

    const session = createStepSession("test code", rootElement);
    expect(session.extracted.stages.length).toBeGreaterThan(0);

    const result = await executeNextStage(session);
    expect(result).not.toBeNull();
    expect(result?.stage.status).toBe("complete");

    const status = getSessionStatus(session);
    expect(status.completedStages).toBe(1);

    deleteSession(session.id);
    expect(getSession(session.id)).toBeUndefined();
  });

  test("handles multiple sessions independently", () => {
    const rootElement1 = Render({ children: [] });
    const rootElement2 = Render({ children: [] });

    const session1 = createStepSession("code1", rootElement1);
    const session2 = createStepSession("code2", rootElement2);

    expect(session1.id).not.toBe(session2.id);
    expect(getSession(session1.id)).toBe(session1);
    expect(getSession(session2.id)).toBe(session2);

    deleteSession(session1.id);
    expect(getSession(session1.id)).toBeUndefined();
    expect(getSession(session2.id)).toBe(session2);

    deleteSession(session2.id);
  });
});