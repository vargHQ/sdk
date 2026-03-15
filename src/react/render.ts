import { renderRoot } from "./renderers";
import { resolveLazy } from "./renderers/resolve-lazy";
import type { RenderOptions, RenderResult, VargElement } from "./types";

export async function render(
  element: VargElement,
  options: RenderOptions = {},
): Promise<RenderResult> {
  // Resolve any lazy elements (from async components) before rendering.
  // This turns the tree into a fully static VargElement tree that
  // renderRoot() can process without async surprises.
  const resolved = (await resolveLazy(element)) as VargElement;

  if (resolved.type !== "render") {
    throw new Error("Root element must be <Render>");
  }

  return renderRoot(resolved as VargElement<"render">, options);
}

export const renderStream = {
  async *stream(element: VargElement, options: RenderOptions = {}) {
    yield { type: "start" as const, progress: 0 };
    const result = await render(element, options);
    yield { type: "complete" as const, progress: 100, result };
  },
};
