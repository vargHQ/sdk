import { renderVideo } from "./renderers";
import type { RenderOptions, VargElement } from "./types";

export async function render(
  element: VargElement,
  options: RenderOptions = {},
): Promise<Uint8Array> {
  if (element.type !== "video") {
    throw new Error("Root element must be <Video>");
  }

  return renderVideo(element as VargElement<"video">, options);
}

export const renderStream = {
  async *stream(element: VargElement, options: RenderOptions = {}) {
    yield { type: "start", progress: 0 };
    const result = await render(element, options);
    yield { type: "complete", progress: 100, result };
  },
};
