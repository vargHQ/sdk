import type { generateImage } from "ai";
import { File } from "../../file";
import type { ImageProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { computeCacheKey } from "./utils";

export async function renderImage(
  element: VargElement<"image">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as ImageProps;

  if (props.src) {
    return props.src;
  }

  if (!props.prompt) {
    throw new Error("Image element requires either 'prompt' or 'src'");
  }

  const model = props.model;
  if (!model) {
    throw new Error("Image element requires 'model' prop when using prompt");
  }

  const cacheKey = computeCacheKey(element);

  const { images } = await ctx.generateImage({
    model,
    prompt: props.prompt,
    aspectRatio: props.aspectRatio,
    n: 1,
    cacheKey,
  } as Parameters<typeof generateImage>[0]);

  const imageData = images[0]!.uint8Array;
  const tempPath = await File.toTemp({
    uint8Array: imageData,
    mimeType: "image/png",
  });
  ctx.tempFiles.push(tempPath);

  return tempPath;
}
