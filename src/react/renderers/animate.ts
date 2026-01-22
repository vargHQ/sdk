import { File } from "../../ai-sdk/file";
import type { generateVideo } from "../../ai-sdk/generate-video";
import type { AnimateProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { addTask, completeTask, startTask } from "./progress";
import { computeCacheKey, resolvePath } from "./utils";

export async function renderAnimate(
  element: VargElement<"animate">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as AnimateProps;

  let imagePath: string;
  if (props.src) {
    // src can be a string path or an Image element
    if (typeof props.src === "string") {
      imagePath = props.src;
    } else if (props.src.type === "image") {
      imagePath = await renderImage(props.src as VargElement<"image">, ctx);
    } else {
      throw new Error(
        `Animate 'src' prop must be a string or <Image /> element, got <${props.src.type} />`,
      );
    }
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

  const modelId = typeof model === "string" ? model : model.modelId;
  const taskId = ctx.progress
    ? addTask(ctx.progress, "animate", modelId)
    : null;
  if (taskId && ctx.progress) startTask(ctx.progress, taskId);

  const { video } = await ctx.generateVideo({
    model,
    prompt: {
      text: props.motion ?? "",
      images: [new Uint8Array(imageData)],
    },
    duration: props.duration ?? 5,
    cacheKey,
  } as Parameters<typeof generateVideo>[0]);

  if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

  const tempPath = await File.toTemp(video);
  ctx.tempFiles.push(tempPath);

  return tempPath;
}
