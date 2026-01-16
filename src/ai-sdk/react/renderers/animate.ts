import { File } from "../../file";
import type { generateVideo } from "../../generate-video";
import type { AnimateProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { computeCacheKey, resolvePath } from "./utils";

export async function renderAnimate(
  element: VargElement<"animate">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as AnimateProps;

  let imagePath: string;
  if (props.src) {
    imagePath = props.src;
  } else if (props.image) {
    if (props.image.type !== "image") {
      throw new Error(
        `Animate 'image' prop must be an <Image /> element, got <${props.image.type} />`,
      );
    }
    imagePath = await renderImage(props.image as VargElement<"image">, ctx);
  } else {
    throw new Error("Animate element requires either 'src' or 'image' prop");
  }

  const model = props.model;
  if (!model) {
    throw new Error("Animate element requires 'model' prop");
  }

  const imageData = await Bun.file(resolvePath(imagePath)).arrayBuffer();
  const cacheKey = computeCacheKey(element);

  console.log("[animate] imagePath:", imagePath, "size:", imageData.byteLength);

  const { video } = await ctx.generateVideo({
    model,
    prompt: {
      text: props.motion ?? "",
      images: [new Uint8Array(imageData)],
    },
    duration: props.duration ?? 5,
    cacheKey,
  } as Parameters<typeof generateVideo>[0]);

  const tempPath = await File.toTemp(video);
  ctx.tempFiles.push(tempPath);

  return tempPath;
}
