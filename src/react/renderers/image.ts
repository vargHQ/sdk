import type { generateImage } from "ai";
import { File } from "../../ai-sdk/file";
import { ResolvedElement } from "../resolved-element";
import type { ImagePrompt, ImageProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { withDedup } from "./dedup";
import { resolveImageInput } from "./inputs";
import { computeCacheKey } from "./utils";

async function resolvePrompt(
  prompt: ImagePrompt,
  ctx: RenderContext,
): Promise<string | { text?: string; images: Uint8Array[] }> {
  if (typeof prompt === "string") {
    return prompt;
  }
  const resolvedImages = prompt.images
    ? await Promise.all(prompt.images.map((img) => resolveImageInput(img, ctx)))
    : [];
  return { text: prompt.text, images: resolvedImages };
}

export async function renderImage(
  element: VargElement<"image">,
  ctx: RenderContext,
): Promise<File> {
  if (element instanceof ResolvedElement) {
    ctx.generatedFiles.push(element.meta.file);
    return element.meta.file;
  }

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

  const modelId = typeof model === "string" ? model : model.modelId;
  const cacheKey = computeCacheKey(element);

  return withDedup(element, ctx, "image", modelId, async () => {
    const resolvedPrompt = await resolvePrompt(prompt, ctx);

    const { images } = await ctx.generateImage({
      model,
      prompt: resolvedPrompt,
      aspectRatio: props.aspectRatio,
      providerOptions: props.providerOptions,
      n: 1,
      cacheKey,
    } as Parameters<typeof generateImage>[0]);

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

    if (!file.url && ctx.storage) {
      await file.upload(ctx.storage);
    }

    return file;
  });
}
