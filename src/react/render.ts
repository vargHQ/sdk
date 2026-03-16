import { type CacheStorage, withCache } from "../ai-sdk/cache";
import { fileCache } from "../ai-sdk/file-cache";
import { localBackend } from "../ai-sdk/providers/editly";
import { renderRoot } from "./renderers";
import { resolveLazy } from "./renderers/resolve-lazy";
import { withResolveContext } from "./resolve-context";
import type { RenderOptions, RenderResult, VargElement } from "./types";

function resolveCacheStorage(
  cache: string | CacheStorage | undefined,
): CacheStorage | undefined {
  if (!cache) return undefined;
  if (typeof cache === "string") return fileCache({ dir: cache });
  return cache;
}

/**
 * Render a VargElement tree into a video.
 *
 * Resolves any lazy elements (from async components) before passing the
 * fully static tree to the render pipeline. The root element must be `<Render>`.
 *
 * When async components use `await Speech()` / `await Video()` etc., the
 * resolve context provides them with the same backend, cache, and storage
 * as the render pipeline — enabling cloud rendering via Rendi or other backends.
 */
export async function render(
  element: VargElement,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const backend = options.backend ?? localBackend;
  const cache = resolveCacheStorage(options.cache);

  // Resolve lazy elements (from async components) within the resolve context.
  // This makes backend/cache/storage available to `await Speech()` etc. via
  // AsyncLocalStorage, so they use the same infrastructure as the render pipeline.
  const resolved = (await withResolveContext(
    { backend, cache, storage: options.storage },
    () => resolveLazy(element),
  )) as VargElement;

  if (resolved.type !== "render") {
    throw new Error("Root element must be <Render>");
  }

  return renderRoot(resolved as VargElement<"render">, options);
}

/** Streaming render interface that yields progress events. */
export const renderStream = {
  /** Stream render progress, yielding start and complete events. */
  async *stream(element: VargElement, options: RenderOptions = {}) {
    yield { type: "start" as const, progress: 0 };
    const result = await render(element, options);
    yield { type: "complete" as const, progress: 100, result };
  },
};
