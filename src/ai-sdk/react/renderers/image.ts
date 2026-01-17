import type { generateImage } from "ai";
import { File } from "../../file";
import type {
  ImageInput,
  ImagePrompt,
  ImageProps,
  VargElement,
} from "../types";
import type { RenderContext } from "./context";
import { addTask, completeTask, startTask } from "./progress";
import { computeCacheKey, toFileUrl } from "./utils";

async function resolveImageInput(
  input: ImageInput,
  ctx: RenderContext,
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  const path = await renderImage(input, ctx);
  const response = await fetch(toFileUrl(path));
  return new Uint8Array(await response.arrayBuffer());
}

async function resolvePrompt(
  prompt: ImagePrompt,
  ctx: RenderContext,
): Promise<string | { text?: string; images: Uint8Array[] }> {
  if (typeof prompt === "string") {
    return prompt;
  }
  const resolvedImages = await Promise.all(
    prompt.images.map((img) => resolveImageInput(img, ctx)),
  );
  return { text: prompt.text, images: resolvedImages };
}

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
  const resolvedPrompt = await resolvePrompt(props.prompt, ctx);

  const modelId = typeof model === "string" ? model : model.modelId;
  const taskId = ctx.progress ? addTask(ctx.progress, "image", modelId) : null;
  if (taskId && ctx.progress) startTask(ctx.progress, taskId);

  const { images } = await ctx.generateImage({
    model,
    prompt: resolvedPrompt,
    aspectRatio: props.aspectRatio,
    n: 1,
    cacheKey,
  } as Parameters<typeof generateImage>[0]);

  if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

  const imageData = images[0]!.uint8Array;
  const tempPath = await File.toTemp({
    uint8Array: imageData,
    mimeType: "image/png",
  });
  ctx.tempFiles.push(tempPath);

  return tempPath;
}
