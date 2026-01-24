import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  BatchProps,
  RenderOptions,
  RenderProps,
  VargElement,
} from "../types";
import { renderRoot } from "./render";

export interface BatchResult {
  name: string;
  path: string;
  buffer: Uint8Array;
}

export async function renderBatch(
  element: VargElement<"batch">,
  options: RenderOptions,
): Promise<BatchResult[]> {
  const props = element.props as BatchProps;
  const parallel = props.parallel ?? 1;
  const outputDir = props.output ?? options.output ?? "output";

  mkdirSync(outputDir, { recursive: true });

  const renderElements: VargElement<"render">[] = [];
  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;
    if (childElement.type === "render") {
      renderElements.push(childElement as VargElement<"render">);
    }
  }

  if (renderElements.length === 0) {
    throw new Error("Batch requires at least one <Render> child");
  }

  const results: BatchResult[] = [];
  const total = renderElements.length;

  const renderOne = async (
    renderElement: VargElement<"render">,
    index: number,
  ): Promise<BatchResult> => {
    const renderProps = renderElement.props as RenderProps;
    const name = renderProps.name ?? `video-${index}`;
    const outputPath = join(outputDir, `${name}.mp4`);

    if (!options.quiet) {
      console.log(`[${index + 1}/${total}] rendering ${name}...`);
    }

    const buffer = await renderRoot(renderElement, {
      ...options,
      output: outputPath,
    });

    if (!options.quiet) {
      console.log(`[${index + 1}/${total}] done: ${outputPath}`);
    }

    return { name, path: outputPath, buffer };
  };

  for (let i = 0; i < renderElements.length; i += parallel) {
    const batch = renderElements.slice(i, i + parallel);
    const batchResults = await Promise.all(
      batch.map((el, j) => renderOne(el, i + j)),
    );
    results.push(...batchResults);
  }

  return results;
}
