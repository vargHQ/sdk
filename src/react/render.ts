import { renderRoot } from "./renderers";
import { type BatchResult, renderBatch } from "./renderers/batch";
import type { RenderOptions, VargElement } from "./types";

export async function render(
  element: VargElement,
  options: RenderOptions = {},
): Promise<Uint8Array> {
  if (element.type === "batch") {
    throw new Error("Use renderBatch() for <Batch> elements");
  }
  if (element.type !== "render") {
    throw new Error("Root element must be <Render>");
  }

  return renderRoot(element as VargElement<"render">, options);
}

export { renderBatch, type BatchResult };

export const renderStream = {
  async *stream(element: VargElement, options: RenderOptions = {}) {
    yield { type: "start", progress: 0 };
    const result = await render(element, options);
    yield { type: "complete", progress: 100, result };
  },
};
