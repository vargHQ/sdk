import { generateImage } from "ai";
import { withCache } from "../../cache";
import { fileCache } from "../../file-cache";
import { generateVideo } from "../../generate-video";
import { editly } from "../../providers/editly";
import type { Clip } from "../../providers/editly/types";
import type { RenderOptions, VargElement, VideoProps } from "../types";
import { renderClip } from "./clip";
import type { RenderContext } from "./context";

export async function renderVideo(
  element: VargElement<"video">,
  options: RenderOptions,
): Promise<Uint8Array> {
  const props = element.props as VideoProps;

  const ctx: RenderContext = {
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    cache: options.cache ? fileCache({ dir: options.cache }) : undefined,
    generateImage: options.cache
      ? withCache(generateImage, { storage: fileCache({ dir: options.cache }) })
      : generateImage,
    generateVideo: options.cache
      ? withCache(generateVideo, { storage: fileCache({ dir: options.cache }) })
      : generateVideo,
    tempFiles: [],
  };

  const clips: Clip[] = [];

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      clips.push(await renderClip(childElement as VargElement<"clip">, ctx));
    }
  }

  const outPath = options.output ?? `output/varg-${Date.now()}.mp4`;

  await editly({
    outPath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips,
  });

  const result = await Bun.file(outPath).arrayBuffer();
  return new Uint8Array(result);
}
