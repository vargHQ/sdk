/**
 * Render context builder — sets up cached+wrapped generators, progress
 * tracking, preview mode, and pricing emission for a composition.
 *
 * Extracted from render.ts so renderRoot stays a thin orchestrator.
 */

import type { ImageModelV3 } from "@ai-sdk/provider";
import {
  generateImage,
  experimental_generateSpeech as generateSpeech,
  wrapImageModel,
} from "ai";
import { type CacheStorage, withCache } from "../../ai-sdk/cache";
import type { File } from "../../ai-sdk/file";
import { fileCache } from "../../ai-sdk/file-cache";
import { generateMusic } from "../../ai-sdk/generate-music";
import { generateVideo } from "../../ai-sdk/generate-video";
import {
  imagePlaceholderFallbackMiddleware,
  placeholderFallbackMiddleware,
  wrapVideoModel,
} from "../../ai-sdk/middleware";
import { localBackend } from "../../ai-sdk/providers/editly";
import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends";
import type { VideoModelV3 } from "../../ai-sdk/video-model";
import type {
  RenderMode,
  RenderOptions,
  RenderProps,
  VargElement,
} from "../types";
import type { RenderContext } from "./context";
import { createProgressTracker, type ProgressTracker } from "./progress";

export function resolveCacheStorage(
  cache: string | CacheStorage | undefined,
): CacheStorage | undefined {
  if (!cache) return undefined;
  if (typeof cache === "string") {
    return fileCache({ dir: cache });
  }
  return cache;
}

function toImageModelV3(
  model: Parameters<typeof generateImage>[0]["model"],
): ImageModelV3 {
  if (typeof model === "object" && model.specificationVersion === "v3") {
    return model;
  }
  const modelId = typeof model === "string" ? model : model.modelId;
  return {
    specificationVersion: "v3",
    provider: "placeholder",
    modelId,
    maxImagesPerCall: 1,
    doGenerate: async () => {
      throw new Error(
        `toImageModelV3 shell: doGenerate should not be called in preview mode (model: ${modelId})`,
      );
    },
  };
}

function toVideoModelV3(
  model: Parameters<typeof generateVideo>[0]["model"],
): VideoModelV3 {
  if (typeof model === "object" && model.specificationVersion === "v3") {
    return model;
  }
  const modelId = typeof model === "string" ? model : model.modelId;
  return {
    specificationVersion: "v3",
    provider: "placeholder",
    modelId,
    maxVideosPerCall: 1,
    doGenerate: async () => {
      throw new Error(
        `toVideoModelV3 shell: doGenerate should not be called in preview mode (model: ${modelId})`,
      );
    },
  };
}

/** RenderContext plus the render-scoped state renderRoot needs alongside it. */
export interface PreparedRender {
  ctx: RenderContext;
  progress: ProgressTracker;
  mode: RenderMode;
  placeholderCount: { images: number; videos: number; total: number };
}

/**
 * Build the RenderContext (cached+wrapped generators, backend, progress)
 * for a composition. Shared by the plan executor and the compose phase so
 * both see the same pendingFiles dedup map, progress tracker, and
 * generatedFiles list.
 */
export function createRenderContext(
  element: VargElement<"render">,
  options: RenderOptions,
): PreparedRender {
  const props = element.props as RenderProps;
  const progress = createProgressTracker(options.quiet ?? false);

  const mode: RenderMode = options.mode ?? "strict";
  const placeholderCount = { images: 0, videos: 0, total: 0 };

  const trackPlaceholder = (type: "image" | "video") => {
    placeholderCount[type === "image" ? "images" : "videos"]++;
    placeholderCount.total++;
  };

  const cacheStorage = resolveCacheStorage(options.cache);

  const cachedGenerateImage = cacheStorage
    ? withCache(generateImage, { storage: cacheStorage })
    : generateImage;

  const cachedGenerateVideo = cacheStorage
    ? withCache(generateVideo, { storage: cacheStorage })
    : generateVideo;

  const cachedGenerateSpeech = cacheStorage
    ? withCache(generateSpeech, { storage: cacheStorage })
    : generateSpeech;

  const cachedGenerateMusic = cacheStorage
    ? withCache(generateMusic, { storage: cacheStorage })
    : generateMusic;

  const onGeneration = options.onGeneration;

  /** Extract pricing metadata from provider response and emit via callback. */
  // biome-ignore lint/suspicious/noExplicitAny: result shapes vary across AI SDK model types
  const emitPricing = (
    type: "image" | "video" | "speech" | "music",
    modelId: string,
    result: any,
  ) => {
    if (!onGeneration) return;
    const vargMeta = result?.providerMetadata?.varg as
      | { pricing?: Record<string, unknown>; jobId?: string }
      | undefined;
    if (vargMeta?.pricing) {
      const p = vargMeta.pricing;
      onGeneration({
        type,
        model: modelId,
        estimated: p.estimated as number | undefined,
        actual: p.actual as number | undefined,
        billing: p.billing as "metered" | "byok" | "x402" | undefined,
        cached: p.cached as boolean | undefined,
        jobId: vargMeta.jobId,
      });
    }
  };

  const wrapGenerateImage: typeof generateImage = async (opts) => {
    if (mode === "preview") {
      trackPlaceholder("image");
      return cachedGenerateImage({
        ...opts,
        model: wrapImageModel({
          model: toImageModelV3(opts.model),
          middleware: imagePlaceholderFallbackMiddleware({
            mode: "preview",
            onFallback: () => {},
          }),
        }),
        skipCacheWrite: true,
      } as Parameters<typeof cachedGenerateImage>[0]);
    }

    const result = await cachedGenerateImage(opts);
    const imgModelId =
      typeof opts.model === "string" ? opts.model : opts.model.modelId;
    emitPricing("image", imgModelId, result);
    return result;
  };

  const wrapGenerateVideo: typeof generateVideo = async (opts) => {
    if (mode === "preview") {
      trackPlaceholder("video");
      return cachedGenerateVideo({
        ...opts,
        model: wrapVideoModel({
          model: toVideoModelV3(opts.model),
          middleware: placeholderFallbackMiddleware({
            mode: "preview",
            onFallback: () => {},
          }),
        }),
        skipCacheWrite: true,
      } as Parameters<typeof cachedGenerateVideo>[0]);
    }

    const result = await cachedGenerateVideo(opts);
    const videoModelId =
      typeof opts.model === "string" ? opts.model : opts.model.modelId;
    emitPricing("video", videoModelId, result);
    return result;
  };

  const wrapGenerateSpeech: typeof generateSpeech = async (opts) => {
    const result = await cachedGenerateSpeech(opts);
    const speechModelId =
      typeof opts.model === "string" ? opts.model : opts.model.modelId;
    emitPricing("speech", speechModelId, result);
    return result;
  };

  const wrapGenerateMusic: typeof generateMusic = async (opts) => {
    const result = await cachedGenerateMusic(opts);
    const musicModelId =
      typeof opts.model === "string" ? opts.model : opts.model.modelId;
    emitPricing("music", musicModelId, result);
    return result;
  };

  const backend: FFmpegBackend = options.backend ?? localBackend;
  const tempFiles: string[] = [];
  const generatedFiles: File[] = [];
  const ctx: RenderContext = {
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    cache: cacheStorage,
    storage: options.storage,
    generateImage: wrapGenerateImage,
    generateVideo: wrapGenerateVideo,
    generateSpeech: onGeneration ? wrapGenerateSpeech : cachedGenerateSpeech,
    generateMusic: onGeneration ? wrapGenerateMusic : cachedGenerateMusic,
    tempFiles,
    progress,
    pendingFiles: new Map<string, Promise<File>>(),
    defaults: options.defaults,
    backend,
    generatedFiles,
  };

  return { ctx, progress, mode, placeholderCount };
}
