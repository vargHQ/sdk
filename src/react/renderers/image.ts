import type { generateImage } from "ai";
import { File } from "../../ai-sdk/file";
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
  const file = await renderImage(input, ctx);
  return file.arrayBuffer();
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
): Promise<File> {
  const props = element.props as ImageProps;

  if (props.src) {
    return typeof props.src === "string" && props.src.startsWith("http")
      ? File.fromUrl(props.src)
      : File.fromPath(props.src);
  }

  const prompt = props.prompt;
  if (!prompt) {
    throw new Error("Image element requires either 'prompt' or 'src'");
  }

  const model = props.model ?? ctx.defaults?.image;
  if (!model) {
    throw new Error(
      "Image element requires 'model' prop (or set defaults.image in render options)",
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
      ? addTask(ctx.progress, "image", modelId)
      : null;
    if (taskId && ctx.progress) startTask(ctx.progress, taskId);

    const { images } = await ctx.generateImage({
      model,
      prompt: resolvedPrompt,
      aspectRatio: props.aspectRatio,
      seed: props.seed,
      providerOptions: props.providerOptions,
      n: 1,
      cacheKey,
    } as Parameters<typeof generateImage>[0]);

    if (taskId && ctx.progress) completeTask(ctx.progress, taskId);

    const firstImage = images[0];
    if (!firstImage?.uint8Array) {
      throw new Error("Image generation returned no image data");
    }

    const promptText =
      typeof resolvedPrompt === "string" ? resolvedPrompt : resolvedPrompt.text;

    const file = File.fromGenerated({
      uint8Array: firstImage.uint8Array,
      mediaType: "image/png",
      url: (firstImage as { url?: string }).url,
    }).withMetadata({
      type: "image",
      model: modelId,
      prompt: promptText,
    });

    ctx.generatedFiles.push(file);

    return file;
  })();

  ctx.pendingFiles.set(cacheKeyStr, renderPromise);

  return renderPromise;
}
