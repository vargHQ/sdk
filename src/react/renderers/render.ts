import { generateImage, wrapImageModel } from "ai";
import { type CacheStorage, withCache } from "../../ai-sdk/cache";
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
import {
  createUsageTracker,
  formatCost,
  type GenerationMetrics,
  type UsageTrackerOptions,
} from "../../ai-sdk/usage";
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

  // Parse usage options
  const usageOpts: UsageTrackerOptions = {};
  if (options.usage === false) {
    usageOpts.enabled = false;
  } else if (typeof options.usage === "object") {
    usageOpts.enabled = options.usage.enabled;
    usageOpts.usageDir = options.usage.dir;
  }

  // Initialize usage tracker for cost estimation and daily limits
  const usage = await createUsageTracker(usageOpts);

  const mode: RenderMode = options.mode ?? "strict";
  const placeholderCount = { images: 0, videos: 0, total: 0 };

  const trackPlaceholder = (type: "image" | "video") => {
    placeholderCount[type === "image" ? "images" : "videos"]++;
    placeholderCount.total++;
  };

  // Set up cache storage for cache hit detection
  const cacheStorage: CacheStorage | undefined = options.cache
    ? fileCache({ dir: options.cache })
    : undefined;

  const cachedGenerateImage = cacheStorage
    ? withCache(generateImage, { storage: cacheStorage })
    : generateImage;

  const cachedGenerateVideo = cacheStorage
    ? withCache(generateVideo, { storage: cacheStorage })
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

    // Check limits before generation
    usage.assertLimits("image");

    // Detect cache hit by checking cache before calling
    // Note: cacheKey is added by withCache wrapper, not in base generateImage type
    const optsWithCache = opts as typeof opts & {
      cacheKey?: (string | number | boolean | null | undefined)[];
    };
    let cached = false;
    if (cacheStorage && optsWithCache.cacheKey) {
      const cacheKeyStr = `generateImage:${optsWithCache.cacheKey.map((d: unknown) => String(d ?? "")).join(":")}`;
      const existing = await cacheStorage.get(cacheKeyStr);
      cached = existing !== undefined;
    }

    const result = await cachedGenerateImage(opts);

    // Record usage with estimated metrics (async - fetches pricing from API)
    // Note: The ai SDK's generateImage doesn't expose provider usage metrics
    const metrics: GenerationMetrics = {
      provider: "fal",
      modelId: typeof opts.model === "string" ? opts.model : opts.model.modelId,
      resourceType: "image",
      count: result.images.length,
    };
    await usage.record({
      ...metrics,
      cached,
    });

    return result;
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

    // Check limits before generation
    usage.assertLimits("video", 0, opts.duration ?? 5);

    // Detect cache hit by checking cache before calling
    // Note: cacheKey is added by withCache wrapper, not in base generateVideo type
    const optsWithCache = opts as typeof opts & {
      cacheKey?: (string | number | boolean | null | undefined)[];
    };
    let cached = false;
    if (cacheStorage && optsWithCache.cacheKey) {
      const cacheKeyStr = `generateVideo:${optsWithCache.cacheKey.map((d: unknown) => String(d ?? "")).join(":")}`;
      const existing = await cacheStorage.get(cacheKeyStr);
      cached = existing !== undefined;
    }

    const result = await cachedGenerateVideo(opts);

    // Record usage if metrics are available (async - fetches pricing from API)
    if (result.usage) {
      await usage.record({
        ...result.usage,
        cached,
      });
    } else {
      // Fallback: record with estimated metrics
      await usage.record({
        provider: "fal",
        modelId:
          typeof opts.model === "string" ? opts.model : opts.model.modelId,
        resourceType: "video",
        durationSeconds: opts.duration ?? 5,
        cached,
      });
    }

    return result;
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
    usage,
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

  // Save usage data and print summary
  await usage.save();

  if (!options.quiet && usage.isEnabled()) {
    // Display pricing warnings if any
    if (usage.hasPricingErrors()) {
      const warningMsg = usage.getPricingWarningMessage();
      if (warningMsg) {
        console.log(`\n\x1b[33m${warningMsg}\x1b[0m\n`);
      }
      usage.markPricingErrorsShown();
    }

    const summary = await usage.getSessionSummary();
    const hasActivity =
      summary.images.generated > 0 ||
      summary.videos.generated > 0 ||
      summary.images.cached > 0 ||
      summary.videos.cached > 0;

    // Only show cost summary if we have pricing data (no errors)
    const hasPricingData = !usage.hasPricingErrors() || summary.totalCost > 0;

    if (hasActivity) {
      console.log("\n\x1b[36m─────────────────────────────────────\x1b[0m");
      console.log("\x1b[36m Usage Summary\x1b[0m");
      console.log("\x1b[36m─────────────────────────────────────\x1b[0m");

      if (summary.images.generated > 0 || summary.images.cached > 0) {
        const imageStr =
          summary.images.cached > 0
            ? `${summary.images.generated} generated, ${summary.images.cached} cached`
            : `${summary.images.generated} generated`;
        const costStr = hasPricingData
          ? formatCost(summary.images.cost)
          : "N/A";
        console.log(`  Images:  ${imageStr.padEnd(28)} ${costStr}`);
      }

      if (summary.videos.generated > 0 || summary.videos.cached > 0) {
        const videoStr =
          summary.videos.cached > 0
            ? `${summary.videos.generated} generated, ${summary.videos.cached} cached`
            : `${summary.videos.generated} generated (${Math.round(summary.videos.duration ?? 0)}s)`;
        const costStr = hasPricingData
          ? formatCost(summary.videos.cost)
          : "N/A";
        console.log(`  Videos:  ${videoStr.padEnd(28)} ${costStr}`);
      }

      console.log("\x1b[36m─────────────────────────────────────\x1b[0m");
      const totalCostStr = hasPricingData
        ? formatCost(summary.totalCost)
        : "N/A (pricing unavailable)";
      console.log(`  Session total                      ${totalCostStr}`);

      if (summary.savedFromCache > 0 && hasPricingData) {
        console.log(
          `  \x1b[32m💰 Saved ${formatCost(summary.savedFromCache)} from cache\x1b[0m`,
        );
      }

      console.log("\x1b[36m─────────────────────────────────────\x1b[0m\n");
    }
  }

  return new Uint8Array(finalBuffer);
}
