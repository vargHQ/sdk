import { generateImage, wrapImageModel } from "ai";
import { withCache } from "../../ai-sdk/cache";
import { fileCache } from "../../ai-sdk/file-cache";
import { generateVideo } from "../../ai-sdk/generate-video";
import {
  imagePlaceholderFallbackMiddleware,
  placeholderFallbackMiddleware,
  wrapVideoModel,
} from "../../ai-sdk/middleware";
import { editly } from "../../ai-sdk/providers/editly";
import type {
  AudioTrack,
  Clip,
  Layer,
  VideoLayer,
} from "../../ai-sdk/providers/editly/types";

import type {
  CaptionsProps,
  ClipProps,
  MusicProps,
  OverlayProps,
  RenderMode,
  RenderOptions,
  RenderProps,
  SpeechProps,
  VargElement,
} from "../types";
import { burnCaptions } from "./burn-captions";
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

  const mode: RenderMode = options.mode ?? "strict";
  const placeholderCount = { images: 0, videos: 0, total: 0 };

  const trackPlaceholder = (type: "image" | "video") => {
    placeholderCount[type === "image" ? "images" : "videos"]++;
    placeholderCount.total++;
  };

  const cachedGenerateImage = options.cache
    ? withCache(generateImage, { storage: fileCache({ dir: options.cache }) })
    : generateImage;

  const cachedGenerateVideo = options.cache
    ? withCache(generateVideo, { storage: fileCache({ dir: options.cache }) })
    : generateVideo;

  const wrapGenerateImage: typeof generateImage = async (opts) => {
    if (
      typeof opts.model === "string" ||
      opts.model.specificationVersion !== "v3"
    ) {
      return cachedGenerateImage(opts);
    }

    if (mode === "preview") {
      trackPlaceholder("image");
      const wrappedModel = wrapImageModel({
        model: opts.model,
        middleware: imagePlaceholderFallbackMiddleware({
          mode: "preview",
          onFallback: () => {},
        }),
      });
      return generateImage({ ...opts, model: wrappedModel });
    }

    return cachedGenerateImage(opts);
  };

  const wrapGenerateVideo: typeof generateVideo = async (opts) => {
    if (mode === "preview") {
      trackPlaceholder("video");
      const wrappedModel = wrapVideoModel({
        model: opts.model,
        middleware: placeholderFallbackMiddleware({
          mode: "preview",
          onFallback: () => {},
        }),
      });
      return generateVideo({ ...opts, model: wrappedModel });
    }

    return cachedGenerateVideo(opts);
  };

  const ctx: RenderContext = {
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    cache: options.cache ? fileCache({ dir: options.cache }) : undefined,
    generateImage: wrapGenerateImage,
    generateVideo: wrapGenerateVideo,
    tempFiles: [],
    progress,
    pending: new Map(),
    defaults: options.defaults,
  };

  const clipElements: VargElement<"clip">[] = [];
  const overlayElements: VargElement<"overlay">[] = [];
  const musicElements: VargElement<"music">[] = [];
  const audioTracks: AudioTrack[] = [];
  let captionsResult: Awaited<ReturnType<typeof renderCaptions>> | undefined;

  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;

    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      clipElements.push(childElement as VargElement<"clip">);
    } else if (childElement.type === "overlay") {
      overlayElements.push(childElement as VargElement<"overlay">);
    } else if (childElement.type === "captions") {
      captionsResult = await renderCaptions(
        childElement as VargElement<"captions">,
        ctx,
      );
      if (captionsResult.audioPath) {
        audioTracks.push({
          path: captionsResult.audioPath,
          mixVolume: 1,
        });
      }
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
      musicElements.push(childElement as VargElement<"music">);
    }
  }

  const renderedOverlays: RenderedOverlay[] = [];
  for (const overlay of overlayElements) {
    const overlayProps = overlay.props as OverlayProps;
    for (const child of overlay.children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue;
      const childElement = child as VargElement;

      let path: string | undefined;
      const isVideo = childElement.type === "video";

      if (childElement.type === "video") {
        path = await renderVideo(childElement as VargElement<"video">, ctx);
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

  const totalDuration = currentTime;

  // process music after clips so we know total duration for auto-trim
  for (const musicElement of musicElements) {
    const musicProps = musicElement.props as MusicProps;
    const cutFrom = musicProps.cutFrom ?? 0;
    const cutTo =
      musicProps.cutTo ??
      (musicProps.duration !== undefined
        ? cutFrom + musicProps.duration
        : totalDuration); // auto-trim to video length

    let path: string;
    if (musicProps.src) {
      path = resolvePath(musicProps.src);
    } else if (musicProps.prompt) {
      const result = await renderMusic(musicElement, ctx);
      path = result.path;
    } else {
      throw new Error("Music requires either src or prompt");
    }

    audioTracks.push({
      path,
      mixVolume: musicProps.volume ?? 1,
      cutFrom,
      cutTo,
      start: musicProps.start,
    });
  }

  const hasCaptions = captionsResult !== undefined;

  const tempOutPath = hasCaptions
    ? `/tmp/varg-pre-captions-${Date.now()}.mp4`
    : (options.output ?? `output/varg-${Date.now()}.mp4`);
  const finalOutPath = options.output ?? `output/varg-${Date.now()}.mp4`;

  const editlyTaskId = addTask(progress, "editly", "ffmpeg");
  startTask(progress, editlyTaskId);

  const editlyResult = await editly({
    outPath: tempOutPath,
    width: ctx.width,
    height: ctx.height,
    fps: ctx.fps,
    clips,
    audioTracks: audioTracks.length > 0 ? audioTracks : undefined,
    shortest: props.shortest,
    verbose: options.verbose,
    backend: options.backend,
  });

  completeTask(progress, editlyTaskId);

  let output = editlyResult.output;

  if (hasCaptions && captionsResult) {
    const captionsTaskId = addTask(progress, "captions", "ffmpeg");
    startTask(progress, captionsTaskId);

    output = await burnCaptions({
      video: output,
      assPath: captionsResult.assPath,
      outputPath: finalOutPath,
      backend: options.backend,
      verbose: options.verbose,
    });

    if (
      !options.backend &&
      output.type === "file" &&
      output.path !== finalOutPath
    ) {
      ctx.tempFiles.push(tempOutPath);
    }

    completeTask(progress, captionsTaskId);
  }

  let finalBuffer: ArrayBuffer;
  if (output.type === "url") {
    const res = await fetch(output.url);
    if (!res.ok)
      throw new Error(`Failed to download final render: ${res.status}`);
    finalBuffer = await res.arrayBuffer();
    if (options.output) {
      await Bun.write(options.output, finalBuffer);
    }
  } else {
    if (output.path !== finalOutPath && options.output) {
      const { $ } = await import("bun");
      await $`cp ${output.path} ${finalOutPath}`.quiet();
    }
    finalBuffer = await Bun.file(finalOutPath).arrayBuffer();
  }

  if (!options.quiet && mode === "preview" && placeholderCount.total > 0) {
    console.log(
      `\x1b[36mℹ preview mode: ${placeholderCount.total} placeholders used (${placeholderCount.images} images, ${placeholderCount.videos} videos)\x1b[0m`,
    );
  }

  return new Uint8Array(finalBuffer);
}
