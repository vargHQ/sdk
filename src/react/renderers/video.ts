import { File } from "../../ai-sdk/file";
import type { generateVideo } from "../../ai-sdk/generate-video";
import type {
  ImageInput,
  VargElement,
  VideoPrompt,
  VideoProps,
} from "../types";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { addTask, completeTask, startTask } from "./progress";
import { renderSpeech } from "./speech";
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
  const file = await renderImage(input, ctx);
  return file.arrayBuffer();
}

async function resolveAudioInput(
  input: Uint8Array | string | VargElement<"speech"> | undefined,
  ctx: RenderContext,
): Promise<Uint8Array | undefined> {
  if (!input) return undefined;
  if (input instanceof Uint8Array) return input;
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  // It's a Speech element - render it first
  if (input.type === "speech") {
    const { path } = await renderSpeech(input, ctx);
    const response = await fetch(toFileUrl(path));
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(
    `Unsupported audio input type: ${(input as VargElement).type}`,
  );
}

async function resolveVideoInput(
  input: Uint8Array | string | VargElement<"video"> | undefined,
  ctx: RenderContext,
): Promise<Uint8Array | undefined> {
  if (!input) return undefined;
  if (input instanceof Uint8Array) return input;
  if (typeof input === "string") {
    const response = await fetch(toFileUrl(input));
    return new Uint8Array(await response.arrayBuffer());
  }
  if (input.type === "video") {
    const file = await renderVideo(input, ctx);
    return file.arrayBuffer();
  }
  throw new Error(
    `Unsupported video input type: ${(input as VargElement).type}`,
  );
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
    resolveAudioInput(prompt.audio, ctx),
    resolveVideoInput(prompt.video, ctx),
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
): Promise<File> {
  const props = element.props as VideoProps;

  if (props.src && !props.prompt) {
    return typeof props.src === "string" && props.src.startsWith("http")
      ? File.fromUrl(props.src)
      : File.fromPath(props.src);
  }

  const prompt = props.prompt;
  if (!prompt) {
    throw new Error("Video element requires either 'prompt' or 'src'");
  }

  const model = props.model ?? ctx.defaults?.video;
  if (!model) {
    throw new Error(
      "Video element requires 'model' prop (or set defaults.video in render options)",
    );
  }

  const cacheKey = computeCacheKey(element);
  const cacheKeyStr = JSON.stringify(cacheKey);

  const pendingRender = ctx.pendingFiles.get(cacheKeyStr);
  if (pendingRender) {
    return pendingRender;
  }

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
      duration: props.duration ?? 5,
      aspectRatio: props.aspectRatio,
      providerOptions: props.providerOptions,
      cacheKey,
    } as Parameters<typeof generateVideo>[0]);

    if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

    return File.fromGenerated({
      uint8Array: video.uint8Array,
      mediaType: video.mimeType,
      url: video.url,
    });
  })();

  ctx.pendingFiles.set(cacheKeyStr, renderPromise);

  return renderPromise;
}
