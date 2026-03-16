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
import type { CacheStorage } from "../ai-sdk/cache";
import type { FFmpegBackend } from "../ai-sdk/providers/editly/backends";
import type { StorageProvider } from "../ai-sdk/storage/types";

/** Context available to standalone resolve functions during rendering. */
export interface ResolveContext {
  /** FFmpeg backend for ffprobe and file resolution (local or cloud). */
  backend: FFmpegBackend;
  /** Cache storage for generated assets. */
  cache?: CacheStorage;
  /** Storage provider for uploading files (cloud backends). */
  storage?: StorageProvider;
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
