import { resolve } from "node:path";
import { generatePlaceholder } from "../../ai-sdk/middleware/placeholder";
import type {
  ClipProps,
  ImageProps,
  MusicProps,
  RenderProps,
  SpeechProps,
  SubtitleProps,
  TitleProps,
  VargElement,
  VargNode,
  VideoProps,
} from "../types";
import type {
  ExportMode,
  Timeline,
  TimelineAsset,
  TimelineClipItem,
  TimelineTextItem,
  TimelineTrack,
  TimelineTransition,
} from "./types";

interface WalkerContext {
  mode: ExportMode;
  width: number;
  height: number;
  fps: number;
  cacheDir: string;
  assets: Map<string, TimelineAsset>;
  assetCounter: number;
}

function generateAssetId(ctx: WalkerContext): string {
  return `asset_${++ctx.assetCounter}`;
}

function resolveSrcPath(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  return `file://${resolve(src)}`;
}

async function createPlaceholderAsset(
  ctx: WalkerContext,
  type: "video" | "image" | "audio",
  prompt: string,
  duration?: number,
): Promise<TimelineAsset> {
  const id = generateAssetId(ctx);
  const ext = type === "audio" ? "mp3" : type === "image" ? "png" : "mp4";
  const placeholderPath = `${ctx.cacheDir}/placeholder_${id}.${ext}`;

  const result = await generatePlaceholder({
    type,
    prompt,
    duration: duration ?? 3,
    width: ctx.width,
    height: ctx.height,
  });

  await Bun.write(placeholderPath, result.data);

  return {
    id,
    type,
    path: `file://${resolve(placeholderPath)}`,
    prompt,
    isPlaceholder: true,
    duration,
    width: type !== "audio" ? ctx.width : undefined,
    height: type !== "audio" ? ctx.height : undefined,
  };
}

function extractPrompt(
  props: ImageProps | VideoProps | MusicProps | SpeechProps,
): string | undefined {
  if ("prompt" in props && props.prompt) {
    if (typeof props.prompt === "string") return props.prompt;
    if (typeof props.prompt === "object" && "text" in props.prompt) {
      return props.prompt.text;
    }
  }
  if ("children" in props && typeof props.children === "string") {
    return props.children;
  }
  return undefined;
}

async function processMediaElement(
  ctx: WalkerContext,
  element: VargElement,
  defaultDuration?: number,
): Promise<TimelineAsset | null> {
  const props = element.props as
    | ImageProps
    | VideoProps
    | MusicProps
    | SpeechProps;

  if ("src" in props && props.src) {
    const id = generateAssetId(ctx);
    const type =
      element.type === "music" || element.type === "speech"
        ? "audio"
        : (element.type as "video" | "image");
    const asset: TimelineAsset = {
      id,
      type,
      path: resolveSrcPath(props.src),
      isPlaceholder: false,
      duration: defaultDuration,
    };
    ctx.assets.set(id, asset);
    return asset;
  }

  const prompt = extractPrompt(props);
  if (prompt) {
    const type =
      element.type === "music" || element.type === "speech"
        ? "audio"
        : (element.type as "video" | "image");
    const asset = await createPlaceholderAsset(
      ctx,
      type,
      prompt,
      defaultDuration,
    );
    ctx.assets.set(asset.id, asset);
    return asset;
  }

  return null;
}

function processTextElement(
  element: VargElement<"title" | "subtitle">,
  startTime: number,
  duration: number,
): TimelineTextItem {
  const props = element.props as TitleProps | SubtitleProps;
  const text = Array.isArray(element.children)
    ? element.children.filter((c) => typeof c === "string").join("")
    : typeof element.children === "string"
      ? element.children
      : "";

  return {
    id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: element.type as "title" | "subtitle",
    text,
    startTime,
    duration,
    position:
      "position" in props && typeof props.position === "string"
        ? props.position
        : undefined,
    color: "color" in props ? props.color : undefined,
    backgroundColor:
      "backgroundColor" in props
        ? (props as SubtitleProps).backgroundColor
        : undefined,
  };
}

async function processClip(
  ctx: WalkerContext,
  clipElement: VargElement<"clip">,
  startTime: number,
): Promise<{
  videoItems: TimelineClipItem[];
  audioItems: TimelineClipItem[];
  textItems: TimelineTextItem[];
  duration: number;
  transition?: TimelineTransition;
}> {
  const props = clipElement.props as ClipProps;
  const duration = typeof props.duration === "number" ? props.duration : 3;

  const videoItems: TimelineClipItem[] = [];
  const audioItems: TimelineClipItem[] = [];
  const textItems: TimelineTextItem[] = [];

  for (const child of clipElement.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    switch (childElement.type) {
      case "image":
      case "video": {
        const asset = await processMediaElement(ctx, childElement, duration);
        if (asset) {
          const childProps = childElement.props as ImageProps | VideoProps;
          videoItems.push({
            id: `clip_${asset.id}`,
            assetId: asset.id,
            startTime,
            duration,
            trimStart: "cutFrom" in childProps ? childProps.cutFrom : undefined,
            trimEnd: "cutTo" in childProps ? childProps.cutTo : undefined,
            volume: "volume" in childProps ? childProps.volume : undefined,
            zoom: "zoom" in childProps ? childProps.zoom : undefined,
            resizeMode: "resize" in childProps ? childProps.resize : undefined,
          });
        }
        break;
      }

      case "speech":
      case "music": {
        const asset = await processMediaElement(ctx, childElement, duration);
        if (asset) {
          const childProps = childElement.props as SpeechProps | MusicProps;
          audioItems.push({
            id: `clip_${asset.id}`,
            assetId: asset.id,
            startTime,
            duration,
            trimStart: "cutFrom" in childProps ? childProps.cutFrom : undefined,
            trimEnd: "cutTo" in childProps ? childProps.cutTo : undefined,
            volume: childProps.volume,
          });
        }
        break;
      }

      case "title":
      case "subtitle": {
        textItems.push(
          processTextElement(
            childElement as VargElement<"title" | "subtitle">,
            startTime,
            duration,
          ),
        );
        break;
      }
    }
  }

  let transition: TimelineTransition | undefined;
  if (props.transition) {
    transition = {
      type: props.transition.name ?? "fade",
      duration: props.transition.duration ?? 0.5,
      afterClipIndex: -1,
    };
  }

  return { videoItems, audioItems, textItems, duration, transition };
}

export async function walkTree(
  element: VargElement<"render">,
  mode: ExportMode,
  cacheDir: string,
): Promise<Timeline> {
  const props = element.props as RenderProps;

  const ctx: WalkerContext = {
    mode,
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    cacheDir,
    assets: new Map(),
    assetCounter: 0,
  };

  const videoTrack: TimelineTrack = {
    id: "V1",
    name: "Video 1",
    type: "video",
    items: [],
  };

  const audioTrack: TimelineTrack = {
    id: "A1",
    name: "Audio 1",
    type: "audio",
    items: [],
  };

  const musicTrack: TimelineTrack = {
    id: "A2",
    name: "Music",
    type: "audio",
    items: [],
  };

  const textItems: TimelineTextItem[] = [];
  const transitions: TimelineTransition[] = [];

  let currentTime = 0;
  let clipIndex = 0;

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      const result = await processClip(
        ctx,
        childElement as VargElement<"clip">,
        currentTime,
      );

      videoTrack.items.push(...result.videoItems);
      audioTrack.items.push(...result.audioItems);
      textItems.push(...result.textItems);

      if (result.transition) {
        result.transition.afterClipIndex = clipIndex + 1;
        transitions.push(result.transition);
        currentTime += result.duration - result.transition.duration;
      } else {
        currentTime += result.duration;
      }

      clipIndex++;
    } else if (childElement.type === "music") {
      const musicProps = childElement.props as MusicProps;
      const asset = await processMediaElement(ctx, childElement);
      if (asset) {
        musicTrack.items.push({
          id: `music_${asset.id}`,
          assetId: asset.id,
          startTime: musicProps.start ?? 0,
          duration: currentTime,
          trimStart: musicProps.cutFrom,
          trimEnd: musicProps.cutTo,
          volume: musicProps.volume,
        });
      }
    } else if (childElement.type === "speech") {
      const asset = await processMediaElement(ctx, childElement);
      if (asset) {
        const speechProps = childElement.props as SpeechProps;
        audioTrack.items.push({
          id: `speech_${asset.id}`,
          assetId: asset.id,
          startTime: 0,
          duration: currentTime,
          volume: speechProps.volume,
        });
      }
    }
  }

  const audioTracks = [audioTrack];
  if (musicTrack.items.length > 0) {
    audioTracks.push(musicTrack);
  }

  return {
    name: "Varg Export",
    fps: ctx.fps,
    width: ctx.width,
    height: ctx.height,
    duration: currentTime,
    videoTracks: [videoTrack],
    audioTracks,
    textItems,
    transitions,
    assets: Array.from(ctx.assets.values()),
    metadata: {
      exportMode: mode,
      exportedAt: new Date().toISOString(),
    },
  };
}
