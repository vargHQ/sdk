/**
 * Deduplication + progress tracking helpers for per-element renderers.
 *
 * Every generable renderer (image, video, speech, music, audio) follows
 * the same pattern: check pre-resolved, compute cache key, check
 * pendingFiles, track progress, generate, push to generatedFiles.
 * These helpers eliminate that boilerplate.
 */

import type { File } from "../../ai-sdk/file";
import { ResolvedElement } from "../resolved-element";
import type { VargElement } from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";
import { computeCacheKey } from "./utils";

/** GenerationType for progress tracking. */
type GenType = "image" | "video" | "speech" | "music";

/**
 * Run a generation function with deduplication and progress tracking.
 *
 * - Pre-resolved elements (awaited) short-circuit immediately.
 * - Concurrent calls for the same element share a single promise via
 *   `ctx.pendingFiles` (dedup by cache key).
 * - Progress task is created/completed around the generation call.
 *
 * @param element  The VargElement being rendered.
 * @param ctx      The render context.
 * @param genType  Progress tracker type ("image" | "video" | "speech" | "music").
 * @param modelId  Model ID for the progress label.
 * @param fn       The generation function — receives nothing, returns a File.
 */
export function withDedup(
  element: VargElement,
  ctx: RenderContext,
  genType: GenType,
  modelId: string,
  fn: () => Promise<File>,
): Promise<File> {
  // Pre-resolved (awaited) — reuse the pre-generated file.
  if (element instanceof ResolvedElement) {
    ctx.generatedFiles.push(element.meta.file);
    return Promise.resolve(element.meta.file);
  }

  // Dedup concurrent renders of the same element.
  const cacheKeyStr = JSON.stringify(computeCacheKey(element));
  const pending = ctx.pendingFiles.get(cacheKeyStr);
  if (pending) return pending;

  const promise = (async () => {
    const taskId = ctx.progress
      ? addTask(ctx.progress, genType, modelId)
      : null;
    if (taskId && ctx.progress) startTask(ctx.progress, taskId);

    try {
      const file = await fn();
      ctx.generatedFiles.push(file);
      return file;
    } finally {
      if (taskId && ctx.progress) completeTask(ctx.progress, taskId);
    }
  })();

  ctx.pendingFiles.set(cacheKeyStr, promise);
  return promise;
}
