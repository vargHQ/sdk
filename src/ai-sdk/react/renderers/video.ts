import { File } from "../../file";
import type { generateVideo } from "../../generate-video";
import type { VargElement, VideoProps } from "../types";
import type { RenderContext } from "./context";
import { computeCacheKey } from "./utils";

export async function renderVideo(
  element: VargElement<"video">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as VideoProps;

  if (props.src) {
    return props.src;
  }

  if (!props.prompt) {
    throw new Error("Video element requires either 'prompt' or 'src'");
  }

  const model = props.model;
  if (!model) {
    throw new Error("Video element requires 'model' prop when using prompt");
  }

  const cacheKey = computeCacheKey(element);

  const { video } = await ctx.generateVideo({
    model,
    prompt: props.prompt,
    cacheKey,
  } as Parameters<typeof generateVideo>[0]);

  const tempPath = await File.toTemp(video);
  ctx.tempFiles.push(tempPath);

  return tempPath;
}
