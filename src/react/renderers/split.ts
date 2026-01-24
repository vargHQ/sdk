import { editly } from "../../ai-sdk/providers/editly";
import type {
  Clip,
  Layer,
  ResizeMode,
} from "../../ai-sdk/providers/editly/types";
import type { SlotProps, SplitProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { type ParsedSlotOptions, resolveSlotOptions } from "./slot-parser";
import { renderVideo } from "./video";

interface SlotChild {
  path: string;
  isVideo: boolean;
  options: ParsedSlotOptions;
}

/**
 * Convert SlotFit to editly ResizeMode
 */
function slotFitToResizeMode(
  fit: ParsedSlotOptions["fit"],
  options: ParsedSlotOptions,
): ResizeMode {
  switch (fit) {
    case "cover":
      return "cover";
    case "contain":
      // Use contain-blur if blur options are set
      if (options.bgBlur !== undefined) {
        return "contain-blur";
      }
      return "contain";
    case "fill":
      return "stretch";
    case "none":
      return "contain"; // No scaling, but we need a valid mode
    default:
      return "cover";
  }
}

export async function renderSplit(
  element: VargElement<"split">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as SplitProps;
  const direction = props.direction ?? "horizontal";

  const slotChildren: SlotChild[] = [];

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    // Handle Slot wrapper
    if (childElement.type === "slot") {
      const slotProps = childElement.props as SlotProps;
      const options = resolveSlotOptions(slotProps);

      // Get the actual content from Slot's children
      for (const slotChild of childElement.children) {
        if (
          !slotChild ||
          typeof slotChild !== "object" ||
          !("type" in slotChild)
        )
          continue;
        const contentElement = slotChild as VargElement;

        if (contentElement.type === "image") {
          const path = await renderImage(
            contentElement as VargElement<"image">,
            ctx,
          );
          slotChildren.push({ path, isVideo: false, options });
        } else if (contentElement.type === "video") {
          const path = await renderVideo(
            contentElement as VargElement<"video">,
            ctx,
          );
          slotChildren.push({ path, isVideo: true, options });
        }
      }
    }
    // Handle direct image/video children (backwards compatible)
    else if (childElement.type === "image") {
      const path = await renderImage(childElement as VargElement<"image">, ctx);
      slotChildren.push({
        path,
        isVideo: false,
        options: { fit: "cover", position: "center" },
      });
    } else if (childElement.type === "video") {
      const path = await renderVideo(childElement as VargElement<"video">, ctx);
      slotChildren.push({
        path,
        isVideo: true,
        options: { fit: "cover", position: "center" },
      });
    }
  }

  if (slotChildren.length === 0) {
    throw new Error("Split element requires at least one image or video child");
  }

  if (slotChildren.length === 1) {
    return slotChildren[0]!.path;
  }

  const numChildren = slotChildren.length;
  const cellWidth =
    direction === "horizontal"
      ? Math.floor(ctx.width / numChildren)
      : ctx.width;
  const cellHeight =
    direction === "vertical"
      ? Math.floor(ctx.height / numChildren)
      : ctx.height;

  const layers: Layer[] = slotChildren.map(({ path, isVideo, options }, i) => {
    const left = direction === "horizontal" ? cellWidth * i : 0;
    const top = direction === "vertical" ? cellHeight * i : 0;
    const resizeMode = slotFitToResizeMode(options.fit, options);

    if (isVideo) {
      return {
        type: "video" as const,
        path,
        left,
        top,
        width: cellWidth,
        height: cellHeight,
        resizeMode,
        // Pass cropPosition for cover mode positioning
        cropPosition: options.position,
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
