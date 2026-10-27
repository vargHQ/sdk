/**
 * Ambient context for standalone element resolution (`await Speech({...})`).
 *
 * When `render()` is called with a backend/cache/storage, it sets up a
 * ResolveContext via AsyncLocalStorage before resolving lazy elements.
 * This allows `await Speech()` inside async components to use the same
 * backend (local or cloud) and cache as the render pipeline.
 *
 * When called outside of `render()` (top-level await), no context exists
 * and resolve functions fall back to local defaults.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import pLimit, { type LimitFunction } from "p-limit";
import type { CacheStorage } from "../ai-sdk/cache";
import type { FFmpegBackend } from "../ai-sdk/providers/editly/backends";
import type { StorageProvider } from "../ai-sdk/storage/types";
import type { DefaultModels } from "./types";

/** Context available to standalone resolve functions during rendering. */
export interface ResolveContext {
  /** FFmpeg backend for ffprobe and file resolution (local or cloud). */
  backend: FFmpegBackend;
  /** Cache storage for generated assets. */
  cache?: CacheStorage;
  /** Storage provider for uploading files (cloud backends). */
  storage?: StorageProvider;
  /** Default models from RenderOptions — used for transcription fallback. */
  defaults?: DefaultModels;
  /**
   * Concurrency limiter for the resolveLazy phase — the counterpart of
   * `executePlan`'s `concurrency` option.
   *
   * Async components generate during `resolveLazy`, which runs BEFORE
   * `executePlan`, so the executor's cap never applies to them. Without
   * this, N async components fan out N unbounded parallel API calls
   * (the ep5 incident: ~36-42 simultaneous requests against a 60/min
   * window, then a self-sustaining 429 retry storm).
   *
   * Only leaf network calls are wrapped — never whole resolvers. A
   * resolver holding a slot while awaiting a nested dependency that is
   * itself queued behind it would deadlock. See sdk#225.
   */
  limit?: LimitFunction;
}

const resolveContextStorage = new AsyncLocalStorage<ResolveContext>();

/** Get the current resolve context, if running inside render(). Returns undefined at top level. */
export function getResolveContext(): ResolveContext | undefined {
  return resolveContextStorage.getStore();
}

/** Run a function with a resolve context available via getResolveContext(). */
export function withResolveContext<T>(ctx: ResolveContext, fn: () => T): T {
  return resolveContextStorage.run(ctx, fn);
}

/** Matches executePlan's default `concurrency`. */
const DEFAULT_RESOLVE_CONCURRENCY = 3;

/**
 * Fallback limiter for top-level `await Image()` / `await Video()` outside
 * render(), where no ResolveContext (and therefore no `concurrency` option)
 * exists. A script doing `Promise.all([...100 images])` at top level has the
 * same fan-out problem as an async component, just without a render around it.
 */
let localLimit: LimitFunction | undefined;

/**
 * The limiter guarding real generation calls in the standalone resolve path.
 *
 * From the ResolveContext when running inside render() (sharing the render's
 * `concurrency` budget), otherwise a lazily-created module-level fallback.
 */
export function getActiveLimit(): LimitFunction {
  const ctxLimit = getResolveContext()?.limit;
  if (ctxLimit) return ctxLimit;
  if (!localLimit) {
    localLimit = pLimit(DEFAULT_RESOLVE_CONCURRENCY);
  }
  return localLimit;
}
