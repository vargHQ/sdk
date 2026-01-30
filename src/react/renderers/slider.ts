import { editly } from "../../ai-sdk/providers/editly";
import type { Clip } from "../../ai-sdk/providers/editly/types";
import type { SliderProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderVideo } from "./video";

export async function renderSlider(
  element: VargElement<"slider">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as SliderProps;
  const direction = props.direction ?? "horizontal";

  const children: { path: string; isVideo: boolean }[] = [];

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    if (childElement.type === "image") {
      const file = await renderImage(childElement as VargElement<"image">, ctx);
      const path = await ctx.backend.resolvePath(file);
      children.push({ path, isVideo: false });
    } else if (childElement.type === "video") {
      const file = await renderVideo(childElement as VargElement<"video">, ctx);
      const path = await ctx.backend.resolvePath(file);
      children.push({ path, isVideo: true });
    }
  }

  if (children.length === 0) {
    throw new Error(
      "Slider element requires at least one image or video child",
    );
  }

  if (children.length === 1) {
    return children[0]!.path;
  }

  const transitionName = direction === "horizontal" ? "slideleft" : "slideup";

  const clips: Clip[] = children.map((child, i) => {
    const isLast = i === children.length - 1;

    return {
      layers: [
        child.isVideo
          ? {
              type: "video" as const,
              path: child.path,
              resizeMode: "cover" as const,
            }
          : {
              type: "image" as const,
              path: child.path,
              resizeMode: "cover" as const,
            },
      ],
      duration: 3,
      transition: isLast ? null : { name: transitionName, duration: 0.5 },
    };
  });

  const outPath = `/tmp/varg-slider-${Date.now()}.mp4`;

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
