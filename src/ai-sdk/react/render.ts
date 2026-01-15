import type { ImageModelV3 } from "@ai-sdk/provider";
import { generateImage } from "ai";
import { withCache } from "../cache";
import { File } from "../file";
import { fileCache } from "../file-cache";
import { generateVideo } from "../generate-video";
import { editly } from "../providers/editly";
import type {
  Clip,
  ImageLayer,
  Layer,
  TitleLayer,
  VideoLayer,
} from "../providers/editly/types";
import type { VideoModelV3 } from "../video-model";
import type {
  AnimateProps,
  ClipProps,
  ImageProps,
  RenderOptions,
  TitleProps,
  VargElement,
  VargNode,
  VideoProps,
} from "./types";

interface RenderContext {
  width: number;
  height: number;
  fps: number;
  cache?: ReturnType<typeof fileCache>;
  generateImage: typeof generateImage;
  generateVideo: typeof generateVideo;
  tempFiles: string[];
}

function computeCacheKey(
  element: VargElement,
): (string | number | boolean | null | undefined)[] {
  const key: (string | number | boolean | null | undefined)[] = [element.type];

  for (const [k, v] of Object.entries(element.props)) {
    if (k === "model" || k === "children") continue;
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      key.push(k, v);
    } else if (v === null || v === undefined) {
      key.push(k, v);
    }
  }

  for (const child of element.children) {
    if (typeof child === "string") {
      key.push("text", child);
    } else if (typeof child === "number") {
      key.push("num", child);
    }
  }

  return key;
}

function getTextContent(node: VargNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node && typeof node === "object" && "children" in node) {
    return node.children.map(getTextContent).join("");
  }
  return "";
}

async function renderImage(
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

async function renderAnimate(
  element: VargElement<"animate">,
  ctx: RenderContext,
): Promise<string> {
  const props = element.props as AnimateProps;

  let imagePath: string;
  if (props.src) {
    imagePath = props.src;
  } else if (props.image) {
    imagePath = await renderImage(props.image, ctx);
  } else {
    throw new Error("Animate element requires either 'src' or 'image' prop");
  }

  const model = props.model;
  if (!model) {
    throw new Error("Animate element requires 'model' prop");
  }

  const imageData = await Bun.file(imagePath).arrayBuffer();
  const cacheKey = computeCacheKey(element);

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

function renderTitle(element: VargElement<"title">): TitleLayer {
  const props = element.props as TitleProps;
  const text = getTextContent(element.children);

  return {
    type: "title",
    text,
    textColor: props.color,
    position: props.position,
    start: props.start,
    stop: props.end,
  };
}

async function renderClipLayers(
  children: VargNode[],
  ctx: RenderContext,
): Promise<Layer[]> {
  const layers: Layer[] = [];

  for (const child of children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const element = child as VargElement;

    switch (element.type) {
      case "image": {
        const path = await renderImage(element as VargElement<"image">, ctx);
        const props = element.props as ImageProps;
        layers.push({
          type: "image",
          path,
          resizeMode: props.resize,
          zoomDirection: props.zoom,
        } as ImageLayer);
        break;
      }

      case "animate": {
        const path = await renderAnimate(
          element as VargElement<"animate">,
          ctx,
        );
        layers.push({
          type: "video",
          path,
        } as VideoLayer);
        break;
      }

      case "title": {
        layers.push(renderTitle(element as VargElement<"title">));
        break;
      }
    }
  }

  return layers;
}

async function renderClip(
  element: VargElement<"clip">,
  ctx: RenderContext,
): Promise<Clip> {
  const props = element.props as ClipProps;
  const layers = await renderClipLayers(element.children, ctx);

  return {
    layers,
    duration: typeof props.duration === "number" ? props.duration : undefined,
    transition: props.transition ?? null,
  };
}

async function renderVideo(
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

export async function render(
  element: VargElement,
  options: RenderOptions = {},
): Promise<Uint8Array> {
  if (element.type !== "video") {
    throw new Error("Root element must be <Video>");
  }

  return renderVideo(element as VargElement<"video">, options);
}

export const renderStream = {
  async *stream(element: VargElement, options: RenderOptions = {}) {
    yield { type: "start", progress: 0 };
    const result = await render(element, options);
    yield { type: "complete", progress: 100, result };
  },
};
