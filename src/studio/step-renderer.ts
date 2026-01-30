import { generateImage } from "ai";
import { type CacheStorage, withCache } from "../ai-sdk/cache";
import { fileCache } from "../ai-sdk/file-cache";
import { generateVideo } from "../ai-sdk/generate-video";
import type { RenderContext } from "../react/renderers/context";
import { renderImage } from "../react/renderers/image";
import { renderMusic } from "../react/renderers/music";
import { createProgressTracker } from "../react/renderers/progress";
import { renderSpeech } from "../react/renderers/speech";
import { renderVideo } from "../react/renderers/video";
import type { RenderProps, VargElement } from "../react/types";
import type { ExtractedStages, RenderStage, StageResult } from "./stages";
import { extractStages } from "./stages";

export interface StepSession {
  id: string;
  code: string;
  rootElement: VargElement;
  extracted: ExtractedStages;
  ctx: RenderContext;
  results: Map<string, StageResult>;
  currentStageIndex: number;
}

const sessions = new Map<string, StepSession>();

export function createStepSession(
  code: string,
  rootElement: VargElement,
  cache?: string | CacheStorage,
): StepSession {
  const props = rootElement.props as RenderProps;
  const cacheStorage =
    cache === undefined
      ? undefined
      : typeof cache === "string"
        ? fileCache({ dir: cache })
        : cache;

  const ctx: RenderContext = {
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    cache: cacheStorage,
    generateImage: cacheStorage
      ? withCache(generateImage, { storage: cacheStorage })
      : generateImage,
    generateVideo: cacheStorage
      ? withCache(generateVideo, { storage: cacheStorage })
      : generateVideo,
    tempFiles: [],
    progress: createProgressTracker(false),
    pendingFiles: new Map(),
  };

  const extracted = extractStages(rootElement);
  const sessionId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const session: StepSession = {
    id: sessionId,
    code,
    rootElement,
    extracted,
    ctx,
    results: new Map(),
    currentStageIndex: 0,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): StepSession | undefined {
  return sessions.get(sessionId);
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export async function executeStage(
  session: StepSession,
  stageId: string,
): Promise<StageResult> {
  const stage = session.extracted.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new Error(`Stage ${stageId} not found`);
  }

  for (const depId of stage.dependsOn) {
    if (!session.results.has(depId)) {
      throw new Error(`Dependency ${depId} not yet executed`);
    }
  }

  stage.status = "running";
  console.log(`[step] executing stage ${stageId}: ${stage.label}`);

  try {
    let result: StageResult;

    switch (stage.type) {
      case "image": {
        const imageFile = await renderImage(
          stage.element as VargElement<"image">,
          session.ctx,
        );
        const path = await imageFile.getPath();
        result = {
          type: "image",
          path,
          previewUrl: `/api/step/preview/${session.id}/${stageId}`,
          mimeType: "image/png",
        };
        break;
      }

      case "video": {
        const videoFile = await renderVideo(
          stage.element as VargElement<"video">,
          session.ctx,
        );
        const path = await videoFile.getPath();
        result = {
          type: "video",
          path,
          previewUrl: `/api/step/preview/${session.id}/${stageId}`,
          mimeType: "video/mp4",
        };
        break;
      }

      case "speech": {
        const speechFile = await renderSpeech(
          stage.element as VargElement<"speech">,
          session.ctx,
        );
        const path = await speechFile.getPath();
        result = {
          type: "audio",
          path,
          previewUrl: `/api/step/preview/${session.id}/${stageId}`,
          mimeType: "audio/mp3",
        };
        break;
      }

      case "music": {
        const musicFile = await renderMusic(
          stage.element as VargElement<"music">,
          session.ctx,
        );
        const path = await musicFile.getPath();
        result = {
          type: "audio",
          path,
          previewUrl: `/api/step/preview/${session.id}/${stageId}`,
          mimeType: "audio/mp3",
        };
        break;
      }

      default:
        throw new Error(`Unknown stage type: ${stage.type}`);
    }

    stage.status = "complete";
    stage.result = result;
    session.results.set(stageId, result);
    console.log(`[step] stage ${stageId} complete: ${result.path}`);

    return result;
  } catch (error) {
    stage.status = "error";
    console.error(`[step] stage ${stageId} failed:`, error);
    throw error;
  }
}

export async function executeNextStage(session: StepSession): Promise<{
  stage: RenderStage;
  result: StageResult;
  isLast: boolean;
} | null> {
  const { order } = session.extracted;

  if (session.currentStageIndex >= order.length) {
    return null;
  }

  const stageId = order[session.currentStageIndex];
  if (!stageId) {
    return null;
  }

  const stage = session.extracted.stages.find((s) => s.id === stageId);
  if (!stage) {
    return null;
  }

  const result = await executeStage(session, stageId);
  session.currentStageIndex++;

  return {
    stage,
    result,
    isLast: session.currentStageIndex >= order.length,
  };
}

export function getStagePreviewPath(
  session: StepSession,
  stageId: string,
): string | null {
  const result = session.results.get(stageId);
  return result?.path ?? null;
}

export async function finalizeRender(
  session: StepSession,
  outputDir: string,
): Promise<string> {
  const allComplete = session.extracted.stages.every(
    (s) => s.status === "complete",
  );
  if (!allComplete) {
    throw new Error("Not all stages are complete");
  }

  const { render } = await import("../react/render");
  const outputPath = `${outputDir}/render-${session.id}.mp4`;

  await render(session.rootElement, {
    output: outputPath,
    cache: session.ctx.cache,
    quiet: true,
  });

  return outputPath;
}

export function getSessionStatus(session: StepSession): {
  sessionId: string;
  totalStages: number;
  completedStages: number;
  currentStageIndex: number;
  stages: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    hasResult: boolean;
    dependsOn: string[];
  }>;
} {
  return {
    sessionId: session.id,
    totalStages: session.extracted.stages.length,
    completedStages: session.results.size,
    currentStageIndex: session.currentStageIndex,
    stages: session.extracted.order.map((id) => {
      const stage = session.extracted.stages.find((s) => s.id === id);
      if (!stage) throw new Error(`Stage not found: ${id}`);
      return {
        id: stage.id,
        type: stage.type,
        label: stage.label,
        status: stage.status,
        hasResult: session.results.has(id),
        dependsOn: stage.dependsOn,
      };
    }),
  };
}
