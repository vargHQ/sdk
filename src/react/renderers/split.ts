import { editly } from "../../ai-sdk/providers/editly";
import type {
  Clip,
  CropPosition,
  Layer,
  ResizeMode,
} from "../../ai-sdk/providers/editly/types";
import type { SplitProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderVideo } from "./video";

interface SplitCell {
  path: string;
  resizeMode?: ResizeMode;
  cropPosition?: CropPosition;
}

export async function renderSplit(
  element: VargElement<"split">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as SplitProps;
  const direction = props.direction ?? "horizontal";

  const cells: SplitCell[] = [];

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;
    const childProps = childElement.props as Record<string, unknown>;

    if (childElement.type === "image") {
      const path = await renderImage(childElement as VargElement<"image">, ctx);
      cells.push({
        path,
        resizeMode: childProps.resize as ResizeMode | undefined,
        cropPosition: childProps.cropPosition as CropPosition | undefined,
      });
    } else if (childElement.type === "video") {
      const path = await renderVideo(childElement as VargElement<"video">, ctx);
      cells.push({
        path,
        resizeMode: childProps.resize as ResizeMode | undefined,
        cropPosition: childProps.cropPosition as CropPosition | undefined,
      });
    }
  }

  if (cells.length === 0) {
    throw new Error("Split element requires at least one image or video child");
  }

  if (cells.length === 1) {
    return cells[0]!.path;
  }

  const numChildren = cells.length;
  const cellWidth =
    direction === "horizontal"
      ? Math.floor(ctx.width / numChildren)
      : ctx.width;
  const cellHeight =
    direction === "vertical"
      ? Math.floor(ctx.height / numChildren)
      : ctx.height;

  const layers: Layer[] = cells.map((cell, i) => {
    const isVideo = cell.path.endsWith(".mp4") || cell.path.endsWith(".webm");
    const left = direction === "horizontal" ? cellWidth * i : 0;
    const top = direction === "vertical" ? cellHeight * i : 0;

    if (isVideo) {
      return {
        type: "video" as const,
        path: cell.path,
        left,
        top,
        width: cellWidth,
        height: cellHeight,
        resizeMode: cell.resizeMode,
        cropPosition: cell.cropPosition,
      };
    }
    return {
      type: "image-overlay" as const,
      path: cell.path,
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
