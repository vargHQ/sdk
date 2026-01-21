import { File } from "../../file";
import type { generateVideo } from "../../generate-video";
import type {
  ImageInput,
  VargElement,
  VideoPrompt,
  VideoProps,
} from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
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

async function resolveMediaInput(
  input: Uint8Array | string | undefined,
): Promise<Uint8Array | undefined> {
  if (!input) return undefined;
  if (input instanceof Uint8Array) return input;
  const response = await fetch(toFileUrl(input));
  return new Uint8Array(await response.arrayBuffer());
}

async function resolvePrompt(
  prompt: VideoPrompt,
  ctx: RenderContext,
): Promise<
  | string
  | {
      text?: string;
      images?: Uint8Array[];
      audio?: Uint8Array;
      video?: Uint8Array;
    }
> {
  if (typeof prompt === "string") {
    return prompt;
  }
  const [resolvedImages, resolvedAudio, resolvedVideo] = await Promise.all([
    prompt.images
      ? Promise.all(prompt.images.map((img) => resolveImageInput(img, ctx)))
      : undefined,
    resolveMediaInput(prompt.audio),
    resolveMediaInput(prompt.video),
  ]);
  return {
    text: prompt.text,
    images: resolvedImages,
    audio: resolvedAudio,
    video: resolvedVideo,
  };
}

export async function renderVideo(
  element: VargElement<"video">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as VideoProps;

  if (props.src && !props.prompt) {
    return props.src;
  }

  const prompt = props.prompt;
  if (!prompt) {
    throw new Error("Video element requires either 'prompt' or 'src'");
  }

  const model = props.model;
  if (!model) {
    throw new Error("Video element requires 'model' prop when using prompt");
  }

  // Compute cache key for deduplication
  const cacheKey = computeCacheKey(element);
  const cacheKeyStr = JSON.stringify(cacheKey);

  // Check if this element is already being rendered (deduplication)
  const pendingRender = ctx.pending.get(cacheKeyStr);
  if (pendingRender) {
    return pendingRender;
  }

  // Create the render promise and store it for deduplication
  const renderPromise = (async () => {
    const resolvedPrompt = await resolvePrompt(prompt, ctx);

    const modelId = typeof model === "string" ? model : model.modelId;
    const taskId = ctx.progress
      ? addTask(ctx.progress, "video", modelId)
      : null;
    if (taskId && ctx.progress) startTask(ctx.progress, taskId);

    const { video } = await ctx.generateVideo({
      model,
      prompt: resolvedPrompt,
      duration: 5,
      cacheKey,
    } as Parameters<typeof generateVideo>[0]);

    if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

    const tempPath = await File.toTemp(video);
    ctx.tempFiles.push(tempPath);

    return tempPath;
  })();

  ctx.pending.set(cacheKeyStr, renderPromise);

  return renderPromise;
}
