import { editly } from "../../providers/editly";
import type { Clip } from "../../providers/editly/types";
import type { SwipeProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderVideo } from "./video";

const SWIPE_TRANSITION_MAP = {
  left: "slideleft",
  right: "slideright",
  up: "slideup",
  down: "slidedown",
} as const;

export async function renderSwipe(
  element: VargElement<"swipe">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as SwipeProps;
  const direction = props.direction ?? "left";
  const interval = props.interval ?? 3;

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
    throw new Error("Swipe element requires at least one image or video child");
  }

  if (childPaths.length === 1) {
    return childPaths[0]!;
  }

  const transitionName = SWIPE_TRANSITION_MAP[direction];

  const clips: Clip[] = childPaths.map((path, i) => {
    const isVideo = path.endsWith(".mp4") || path.endsWith(".webm");
    const isLast = i === childPaths.length - 1;

    return {
      layers: [
        isVideo
          ? { type: "video" as const, path, resizeMode: "cover" as const }
          : { type: "image" as const, path, resizeMode: "cover" as const },
      ],
      duration: interval,
      transition: isLast ? null : { name: transitionName, duration: 0.5 },
    };
  });

  const outPath = `/tmp/varg-swipe-${Date.now()}.mp4`;

  await editly({
    outPath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips,
  });

  ctx.tempFiles.push(outPath);
  return outPath;
}
