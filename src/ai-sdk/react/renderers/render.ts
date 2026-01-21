import { generateImage } from "ai";
import { withCache } from "../../cache";
import { fileCache } from "../../file-cache";
import { generateVideo } from "../../generate-video";
import { editly } from "../../providers/editly";
import type {
  AudioTrack,
  Clip,
  Layer,
  VideoLayer,
} from "../../providers/editly/types";
import type {
  CaptionsProps,
  ClipProps,
  MusicProps,
  OverlayProps,
  RenderOptions,
  RenderProps,
  SpeechProps,
  VargElement,
} from "../types";
import { renderAnimate } from "./animate";
import { renderCaptions } from "./captions";
import { renderClip } from "./clip";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { renderMusic } from "./music";
import {
  addTask,
  completeTask,
  createProgressTracker,
  startTask,
} from "./progress";
import { renderSpeech } from "./speech";
import { resolvePath } from "./utils";
import { renderVideo } from "./video";

interface RenderedOverlay {
  path: string;
  props: OverlayProps;
  isVideo: boolean;
}

export async function renderRoot(
  element: VargElement<"render">,
  options: RenderOptions,
): Promise<Uint8Array> {
  const props = element.props as RenderProps;
  const progress = createProgressTracker(options.quiet ?? false);

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
    progress,
    pending: new Map(),
  };

  const clipElements: VargElement<"clip">[] = [];
  const overlayElements: VargElement<"overlay">[] = [];
  const captionsElements: VargElement<"captions">[] = [];
  const audioTracks: AudioTrack[] = [];

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      clipElements.push(childElement as VargElement<"clip">);
    } else if (childElement.type === "overlay") {
      overlayElements.push(childElement as VargElement<"overlay">);
    } else if (childElement.type === "captions") {
      captionsElements.push(childElement as VargElement<"captions">);
    } else if (childElement.type === "speech") {
      const result = await renderSpeech(
        childElement as VargElement<"speech">,
        ctx,
      );
      const speechProps = childElement.props as SpeechProps;
      audioTracks.push({
        path: result.path,
        mixVolume: speechProps.volume ?? 1,
      });
    } else if (childElement.type === "music") {
      const musicProps = childElement.props as MusicProps;
      const cutFrom = musicProps.cutFrom;
      const cutTo =
        musicProps.cutTo ??
        (musicProps.duration !== undefined
          ? (cutFrom ?? 0) + musicProps.duration
          : undefined);

      let path: string;
      if (musicProps.src) {
        path = resolvePath(musicProps.src);
      } else if (musicProps.prompt && musicProps.model) {
        const result = await renderMusic(
          childElement as VargElement<"music">,
          ctx,
        );
        path = result.path;
      } else {
        throw new Error("Music requires either src or prompt+model");
      }

      audioTracks.push({
        path,
        mixVolume: musicProps.volume ?? 1,
        cutFrom,
        cutTo,
      });
    }
  }

  const renderedOverlays: RenderedOverlay[] = [];
  for (const overlay of overlayElements) {
    const overlayProps = overlay.props as OverlayProps;
    for (const child of overlay.children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue;
      const childElement = child as VargElement;

      let path: string | undefined;
      const isVideo =
        childElement.type === "video" || childElement.type === "animate";

      if (childElement.type === "video") {
        path = await renderVideo(childElement as VargElement<"video">, ctx);
      } else if (childElement.type === "animate") {
        path = await renderAnimate(childElement as VargElement<"animate">, ctx);
      } else if (childElement.type === "image") {
        path = await renderImage(childElement as VargElement<"image">, ctx);
      }

      if (path) {
        renderedOverlays.push({ path, props: overlayProps, isVideo });

        if (isVideo && overlayProps.keepAudio) {
          audioTracks.push({
            path,
            mixVolume: overlayProps.volume ?? 1,
          });
        }
      }
    }
  }

  const renderedClips = await Promise.all(
    clipElements.map((clipElement) => renderClip(clipElement, ctx)),
  );

  const clips: Clip[] = [];
  let currentTime = 0;

  for (let i = 0; i < clipElements.length; i++) {
    const clipElement = clipElements[i];
    const clip = renderedClips[i];
    if (!clipElement || !clip) {
      throw new Error(`Missing clip data at index ${i}`);
    }
    const clipProps = clipElement.props as ClipProps;
    const clipDuration =
      typeof clipProps.duration === "number" ? clipProps.duration : 3;

    for (const overlay of renderedOverlays) {
      const overlayLayer: VideoLayer = {
        type: "video",
        path: overlay.path,
        cutFrom: currentTime,
        cutTo: currentTime + clipDuration,
        left: overlay.props.left,
        top: overlay.props.top,
        width: overlay.props.width,
        height: overlay.props.height,
      };
      clip.layers.push(overlayLayer as Layer);
    }

    clips.push(clip);

    currentTime += clipDuration;
    if (i < clipElements.length - 1 && clip.transition) {
      currentTime -= clip.transition.duration ?? 0;
    }
  }

  const hasCaptions = captionsElements.length > 0;
  const tempOutPath = hasCaptions
    ? `/tmp/varg-pre-captions-${Date.now()}.mp4`
    : (options.output ?? `output/varg-${Date.now()}.mp4`);
  const finalOutPath = options.output ?? `output/varg-${Date.now()}.mp4`;

  const editlyTaskId = addTask(progress, "editly", "ffmpeg");
  startTask(progress, editlyTaskId);

  await editly({
    outPath: tempOutPath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips,
    audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
  });

  completeTask(progress, editlyTaskId);

  if (hasCaptions) {
    const captionsTaskId = addTask(progress, "captions", "ffmpeg");
    startTask(progress, captionsTaskId);

    const captionsElement = captionsElements[0]!;
    const captionsResult = await renderCaptions(captionsElement, ctx);

    const { $ } = await import("bun");
    await $`ffmpeg -y -i ${tempOutPath} -vf "ass=${captionsResult.assPath}" -c:a copy ${finalOutPath}`.quiet();

    ctx.tempFiles.push(tempOutPath);
    completeTask(progress, captionsTaskId);
  }

  const result = await Bun.file(finalOutPath).arrayBuffer();
  return new Uint8Array(result);
}
