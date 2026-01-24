import { editly } from "../../ai-sdk/providers/editly";
import type { Clip, Layer } from "../../ai-sdk/providers/editly/types";
import type { SplitProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderVideo } from "./video";

export async function renderSplit(
  element: VargElement<"split">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as SplitProps;
  const direction = props.direction ?? "horizontal";

  const childPaths: string[] = [];

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    if (childElement.type === "image") {
      const path = await renderImage(childElement as VargElement<"image">, ctx);
      childPaths.push(path);
    } else if (childElement.type === "video") {
      const path = await renderVideo(childElement as VargElement<"video">, ctx);
      childPaths.push(path);
    }
  }

  if (childPaths.length === 0) {
    throw new Error("Split element requires at least one image or video child");
  }

  if (childPaths.length === 1) {
    return childPaths[0]!;
  }

  const numChildren = childPaths.length;
  const cellWidth =
    direction === "horizontal"
      ? Math.floor(ctx.width / numChildren)
      : ctx.width;
  const cellHeight =
    direction === "vertical"
      ? Math.floor(ctx.height / numChildren)
      : ctx.height;

  const layers: Layer[] = childPaths.map((path, i) => {
    const isVideo = path.endsWith(".mp4") || path.endsWith(".webm");
    const left = direction === "horizontal" ? cellWidth * i : 0;
    const top = direction === "vertical" ? cellHeight * i : 0;

    if (isVideo) {
      return {
        type: "video" as const,
        path,
        left,
        top,
        width: cellWidth,
        height: cellHeight,
        resizeMode: "cover" as const,
      };
    }
    return {
      type: "image-overlay" as const,
      path,
      position: { x: left, y: top },
      width: cellWidth,
      height: cellHeight,
    };
  });

  layers.unshift({ type: "fill-color" as const, color: "#000000" });

  const clip: Clip = {
    layers,
    duration: 5,
  };

  const outPath = `/tmp/varg-split-${Date.now()}.mp4`;

  await editly({
    outPath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips: [clip],
  });

  ctx.tempFiles.push(outPath);
  return outPath;
}
