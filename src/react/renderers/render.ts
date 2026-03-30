import type { ImageModelV3 } from "@ai-sdk/provider";
import { generateImage, wrapImageModel } from "ai";
import pMap from "p-map";
import { type CacheStorage, withCache } from "../../ai-sdk/cache";
import type { File, File as VargFile } from "../../ai-sdk/file";
import { fileCache } from "../../ai-sdk/file-cache";
import { generateVideo } from "../../ai-sdk/generate-video";
import {
  imagePlaceholderFallbackMiddleware,
  placeholderFallbackMiddleware,
  prerenderFallbackMiddleware,
  wrapVideoModel,
} from "../../ai-sdk/middleware";
import { editly, localBackend } from "../../ai-sdk/providers/editly";
import type {
  AudioTrack,
  Clip,
  Layer,
  VideoLayer,
} from "../../ai-sdk/providers/editly/types";
import { ResolvedElement } from "../resolved-element";
import type {
  ClipProps,
  MusicProps,
  OverlayProps,
  RenderMode,
  RenderOptions,
  RenderProps,
  RenderResult,
  SpeechProps,
  VargElement,
} from "../types";
import { burnCaptions } from "./burn-captions";
import { type CaptionsResult, renderCaptions } from "./captions";
import { renderClip } from "./clip";
import type { RenderContext } from "./context";
import { renderImage } from "./image";
import { mergeAssFiles, shiftAssTimestamps } from "./merge-ass";
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

function resolveCacheStorage(
  cache: string | CacheStorage | undefined,
): CacheStorage | undefined {
  if (!cache) return undefined;
  if (typeof cache === "string") {
    return fileCache({ dir: cache });
  }
  return cache;
}

function toImageModelV3(
  model: Parameters<typeof generateImage>[0]["model"],
): ImageModelV3 {
  if (typeof model === "object" && model.specificationVersion === "v3") {
    return model;
  }
  // for string IDs and v2 models, create a shell that satisfies the type.
  // in preview mode the middleware intercepts before doGenerate is called.
  const modelId = typeof model === "string" ? model : model.modelId;
  return {
    specificationVersion: "v3",
    provider: "placeholder",
    modelId,
    maxImagesPerCall: 1,
    doGenerate: async () => {
      throw new Error(
        `toImageModelV3 shell: doGenerate should not be called in preview mode (model: ${modelId})`,
      );
    },
  };
}

export async function renderRoot(
  element: VargElement<"render">,
  options: RenderOptions,
): Promise<RenderResult> {
  const props = element.props as RenderProps;
  const progress = createProgressTracker(options.quiet ?? false);

  const mode: RenderMode = options.mode ?? "strict";
  const placeholderCount = { images: 0, videos: 0, total: 0 };

  const trackPlaceholder = (type: "image" | "video") => {
    placeholderCount[type === "image" ? "images" : "videos"]++;
    placeholderCount.total++;
  };

  const cacheStorage = resolveCacheStorage(options.cache);

  const cachedGenerateImage = cacheStorage
    ? withCache(generateImage, { storage: cacheStorage })
    : generateImage;

  const cachedGenerateVideo = cacheStorage
    ? withCache(generateVideo, { storage: cacheStorage })
    : generateVideo;

  const wrapGenerateImage: typeof generateImage = async (opts) => {
    if (mode === "preview") {
      trackPlaceholder("image");
      return cachedGenerateImage({
        ...opts,
        model: wrapImageModel({
          model: toImageModelV3(opts.model),
          middleware: imagePlaceholderFallbackMiddleware({
            mode: "preview",
            onFallback: () => {},
          }),
        }),
        skipCacheWrite: true,
      } as Parameters<typeof cachedGenerateImage>[0]);
    }

    return cachedGenerateImage(opts);
  };

  const wrapGenerateVideo: typeof generateVideo = async (opts) => {
    if (mode === "prerender") {
      const prerenderImageModel = options.defaults?.prerenderImage;
      if (!prerenderImageModel) {
        throw new Error(
          "prerender mode requires defaults.prerenderImage model (e.g., varg.imageModel('nano-banana-2'))",
        );
      }
      // Use uncached generateVideo so we bypass any cached Kling/Wan results
      // and always run the prerender middleware (which generates still frames).
      // Image generation inside the middleware still uses cachedGenerateImage.
      return generateVideo({
        ...opts,
        model: wrapVideoModel({
          model: opts.model,
          middleware: prerenderFallbackMiddleware({
            imageModel: prerenderImageModel,
            generateImageFn: cachedGenerateImage,
          }),
        }),
      } as Parameters<typeof generateVideo>[0]);
    }

    if (mode === "preview") {
      trackPlaceholder("video");
      return cachedGenerateVideo({
        ...opts,
        model: wrapVideoModel({
          model: opts.model,
          middleware: placeholderFallbackMiddleware({
            mode: "preview",
            onFallback: () => {},
          }),
        }),
        skipCacheWrite: true,
      } as Parameters<typeof cachedGenerateVideo>[0]);
    }

    return cachedGenerateVideo(opts);
  };

  const backend = options.backend ?? localBackend;
  const tempFiles: string[] = [];
  const generatedFiles: VargFile[] = [];
  const ctx: RenderContext = {
    width: props.width ?? 1920,
    height: props.height ?? 1080,
    fps: props.fps ?? 30,
    cache: cacheStorage,
    storage: options.storage,
    generateImage: wrapGenerateImage,
    generateVideo: wrapGenerateVideo,
    tempFiles,
    progress,
    pendingFiles: new Map<string, Promise<File>>(),
    defaults: options.defaults,
    backend,
    generatedFiles,
  };

  const clipElements: VargElement<"clip">[] = [];
  const overlayElements: VargElement<"overlay">[] = [];
  const musicElements: VargElement<"music">[] = [];
  const audioTracks: AudioTrack[] = [];

  // ---------------------------------------------------------------------------
  // Hoisted captions: track which clip each caption came from so we can apply
  // the correct timeline offset when stitching audio and ASS files.
  // ---------------------------------------------------------------------------
  interface HoistedCaption {
    element: VargElement<"captions">;
    clipIndex: number;
  }
  const hoistedCaptions: HoistedCaption[] = [];

  // ---------------------------------------------------------------------------
  // Deferred audio: speech/music at a container-clip level that needs to be
  // offset to the container's start position in the timeline.
  // We don't know the offset yet (clips haven't been laid out), so we record
  // the clipIndex of the first leaf clip inside the container and resolve the
  // offset later, after clipStartOffsets are computed.
  // ---------------------------------------------------------------------------
  interface DeferredAudio {
    element: VargElement<"speech"> | VargElement<"music">;
    clipIndex: number; // first leaf clip of the container
  }
  const deferredAudioElements: DeferredAudio[] = [];

  // ---------------------------------------------------------------------------
  // flattenClip: recursively flatten nested clips into leaf clips.
  //
  // A "container clip" has child <Clip> elements. Its non-clip children
  // (Speech, Music, Captions) are hoisted/deferred to span the container's
  // time region, which starts at the first leaf clip's timeline position.
  //
  // A "leaf clip" has no child <Clip> elements — it contains visual/audio
  // layers and is rendered directly by editly.
  // ---------------------------------------------------------------------------
  let clipIndexCounter = 0;

  function flattenClip(clipElement: VargElement<"clip">): void {
    const childClips: VargElement<"clip">[] = [];
    const nonClipChildren: VargElement[] = [];

    for (const child of clipElement.children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue;
      const el = child as VargElement;
      if (el.type === "clip") {
        childClips.push(el as VargElement<"clip">);
      } else {
        nonClipChildren.push(el);
      }
    }

    if (childClips.length === 0) {
      // Leaf clip — hoist captions, keep everything else
      const currentClipIndex = clipIndexCounter++;
      const kept: typeof clipElement.children = [];
      for (const el of nonClipChildren) {
        if (el.type === "captions") {
          hoistedCaptions.push({
            element: el as VargElement<"captions">,
            clipIndex: currentClipIndex,
          });
        } else {
          kept.push(el);
        }
      }
      clipElements.push({
        ...clipElement,
        children: kept,
      } as VargElement<"clip">);
      return;
    }

    // Container clip — has child clips.
    // The first leaf clip's index is used as the anchor for audio/captions
    // offsets (they all start at the container's position in the timeline).
    const firstLeafClipIndex = clipIndexCounter; // before recursion increments it

    // Collect overlays from container level — these get injected into each
    // child clip so the overlay appears across all inner clips.
    const containerOverlays: VargElement[] = [];
    for (const el of nonClipChildren) {
      if (el.type === "overlay") {
        containerOverlays.push(el);
      }
    }

    // Recurse into child clips, injecting container-level overlays
    for (const childClip of childClips) {
      if (containerOverlays.length > 0) {
        childClip.children = [...childClip.children, ...containerOverlays];
      }
      flattenClip(childClip);
    }

    // Process remaining non-clip children at the container level
    for (const el of nonClipChildren) {
      if (el.type === "captions") {
        hoistedCaptions.push({
          element: el as VargElement<"captions">,
          clipIndex: firstLeafClipIndex,
        });
      } else if (el.type === "speech" || el.type === "music") {
        deferredAudioElements.push({
          element: el as VargElement<"speech"> | VargElement<"music">,
          clipIndex: firstLeafClipIndex,
        });
      }
      // overlay: already handled above (distributed to child clips)
      // Image/Video at container level: not supported yet (would need
      // background layer spanning all child clips — a future feature)
    }
  }

  // ---------------------------------------------------------------------------
  // Process all children of <Render>
  // ---------------------------------------------------------------------------
  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      flattenClip(childElement as VargElement<"clip">);
    } else if (childElement.type === "overlay") {
      overlayElements.push(childElement as VargElement<"overlay">);
    } else if (childElement.type === "captions") {
      // Render-level captions — hoist with clipIndex 0 (start of timeline)
      hoistedCaptions.push({
        element: childElement as VargElement<"captions">,
        clipIndex: 0,
      });
    } else if (childElement.type === "speech") {
      // Render-level speech — immediate audio track (no offset needed)
      const file =
        childElement instanceof ResolvedElement
          ? childElement.meta.file
          : await renderSpeech(childElement as VargElement<"speech">, ctx);
      const path = await ctx.backend.resolvePath(file);
      const speechProps = childElement.props as SpeechProps;
      audioTracks.push({
        path,
        mixVolume: speechProps.volume ?? 1,
      });
    } else if (childElement.type === "music") {
      musicElements.push(childElement as VargElement<"music">);
    }
  }

  // Hoisted captions are processed AFTER clip timeline offsets are computed
  // (see below) so that each caption's audio can be delayed to the correct
  // clip start time and ASS timestamps can be shifted accordingly.

  const renderedOverlays: RenderedOverlay[] = [];
  for (const overlay of overlayElements) {
    const overlayProps = overlay.props as OverlayProps;
    for (const child of overlay.children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue;
      const childElement = child as VargElement;

      let file: File | undefined;
      const isVideo = childElement.type === "video";

      if (childElement.type === "video") {
        file = await renderVideo(childElement as VargElement<"video">, ctx);
      } else if (childElement.type === "image") {
        file = await renderImage(childElement as VargElement<"image">, ctx);
      }

      if (file) {
        const path = await ctx.backend.resolvePath(file);
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

  const concurrency =
    options.concurrency === undefined ? 3 : options.concurrency;

  if (
    concurrency !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(concurrency) || concurrency < 1)
  ) {
    throw new Error("render option `concurrency` must be a positive integer");
  }

  const clipResults = await pMap(
    clipElements,
    async (clipElement, i) => {
      try {
        return {
          status: "fulfilled" as const,
          value: await renderClip(clipElement, ctx),
          index: i,
        };
      } catch (reason) {
        return {
          status: "rejected" as const,
          reason: reason as Error,
          index: i,
        };
      }
    },
    { concurrency },
  );

  const failures = clipResults.filter(
    (r): r is Extract<typeof r, { status: "rejected" }> =>
      r.status === "rejected",
  );

  if (failures.length > 0) {
    const successCount = clipResults.length - failures.length;
    if (successCount > 0) {
      console.log(
        `\x1b[33mℹ ${successCount} clip(s) cached, ${failures.length} failed\x1b[0m`,
      );
    }
    const errorCounts = new Map<string, number>();
    for (const f of failures) {
      const msg = f.reason?.message || "Unknown error";
      errorCounts.set(msg, (errorCounts.get(msg) || 0) + 1);
    }
    const errors = [...errorCounts.entries()]
      .map(([msg, count]) => (count > 1 ? `${msg} (x${count})` : msg))
      .join("; ");
    throw new Error(
      `${failures.length} of ${clipResults.length} clips failed: ${errors}`,
    );
  }

  const renderedClips = clipResults.map((r) => {
    if (r.status !== "fulfilled") throw new Error("unexpected");
    return r.value;
  });

  const clips: Clip[] = [];
  const clipStartOffsets: number[] = [];
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

    clipStartOffsets.push(currentTime);

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

  // ---------------------------------------------------------------------------
  // Process deferred audio from container clips.
  // Now that clipStartOffsets are known, we can resolve the audio elements
  // and set the correct start offset in the timeline.
  // ---------------------------------------------------------------------------
  for (const { element: audioElement, clipIndex } of deferredAudioElements) {
    const offset = clipStartOffsets[clipIndex] ?? 0;
    if (audioElement.type === "speech") {
      const file =
        audioElement instanceof ResolvedElement
          ? audioElement.meta.file
          : await renderSpeech(audioElement as VargElement<"speech">, ctx);
      const path = await ctx.backend.resolvePath(file);
      const speechProps = audioElement.props as SpeechProps;
      audioTracks.push({
        path,
        start: offset,
        mixVolume: speechProps.volume ?? 1,
      });
    } else if (audioElement.type === "music") {
      const musicProps = audioElement.props as MusicProps;
      let path: string;
      if (musicProps.src) {
        path = resolvePath(musicProps.src);
      } else if (musicProps.prompt) {
        const file = await renderMusic(
          audioElement as VargElement<"music">,
          ctx,
        );
        path = await ctx.backend.resolvePath(file);
      } else {
        throw new Error("Music requires either src or prompt");
      }
      audioTracks.push({
        path,
        start: offset,
        mixVolume: musicProps.volume ?? 1,
        cutFrom: musicProps.cutFrom,
        cutTo: musicProps.cutTo,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Process hoisted captions (from leaf clips, container clips, and Render
  // level). Now that clipStartOffsets are known, each caption's audio can be
  // delayed and ASS timestamps shifted to the correct timeline position.
  // ---------------------------------------------------------------------------
  const hoistedCaptionsResults: CaptionsResult[] = [];
  let mergedAssPath: string | undefined;

  if (hoistedCaptions.length > 0) {
    for (const { element: captionsElement, clipIndex } of hoistedCaptions) {
      const result = await renderCaptions(captionsElement, ctx);
      hoistedCaptionsResults.push(result);

      if (result.audioPath) {
        audioTracks.push({
          path: result.audioPath,
          start: clipStartOffsets[clipIndex] ?? 0,
          mixVolume: 1,
        });
      }
    }

    // Merge ASS files: shift timestamps by each clip's start offset
    if (hoistedCaptionsResults.length === 1) {
      const offset = clipStartOffsets[hoistedCaptions[0]!.clipIndex] ?? 0;
      const assPath = hoistedCaptionsResults[0]!.assPath;
      mergedAssPath =
        offset > 0 ? shiftAssTimestamps(assPath, offset) : assPath;
      if (mergedAssPath !== assPath) {
        ctx.tempFiles.push(mergedAssPath);
      }
    } else if (hoistedCaptionsResults.length > 1) {
      const segments = hoistedCaptionsResults.map((result, i) => ({
        assPath: result.assPath,
        timeOffset: clipStartOffsets[hoistedCaptions[i]!.clipIndex] ?? 0,
        styleSuffix: `_${i}`,
      }));
      mergedAssPath = mergeAssFiles(segments, ctx.width, ctx.height);
      ctx.tempFiles.push(mergedAssPath);
    }
  }

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
      const file = await renderMusic(musicElement, ctx);
      path = await ctx.backend.resolvePath(file);
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

  // Determine the ASS path to burn from merged hoisted captions.
  const finalAssPath = mergedAssPath;
  const hasCaptions = finalAssPath !== undefined;

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

  if (hasCaptions && finalAssPath) {
    const captionsTaskId = addTask(progress, "captions", "ffmpeg");
    startTask(progress, captionsTaskId);

    output = await burnCaptions({
      video: output,
      assPath: finalAssPath,
      outputPath: finalOutPath,
      backend: options.backend,
      verbose: options.verbose,
    });

    if (!options.backend) {
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
    finalBuffer = await Bun.file(output.path).arrayBuffer();
  }

  if (!options.quiet && mode === "preview" && placeholderCount.total > 0) {
    console.log(
      `\x1b[36mℹ preview mode: ${placeholderCount.total} placeholders used (${placeholderCount.images} images, ${placeholderCount.videos} videos)\x1b[0m`,
    );
  }

  if (!options.quiet && mode === "prerender") {
    const modelId = options.defaults?.prerenderImage?.modelId ?? "unknown";
    console.log(
      `\x1b[36mℹ prerender mode: videos replaced with still frames (image model: ${modelId})\x1b[0m`,
    );
  }

  return {
    video: new Uint8Array(finalBuffer),
    files: generatedFiles,
  };
}
