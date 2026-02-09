import { renderRoot } from "./renderers";
import type { RenderOptions, RenderResult, VargElement } from "./types";

export async function render(
  element: VargElement,
  options: RenderOptions = {},
): Promise<RenderResult> {
  if (element.type !== "render") {
    throw new Error("Root element must be <Render>");
  }

  return renderRoot(element as VargElement<"render">, options);
}

export const renderStream = {
  async *stream(element: VargElement, options: RenderOptions = {}) {
    yield { type: "start" as const, progress: 0 };
    const result = await render(element, options);
    yield { type: "complete" as const, progress: 100, result };
  },
};
