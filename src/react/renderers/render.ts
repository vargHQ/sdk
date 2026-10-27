/**
 * Compose phase: walk the (already materialized) tree, assemble the
 * timeline, and run editly + captions burn-in.
 *
 * When called via `render()`, every generable element has been executed by
 * the plan executor and carries `meta` — the per-element renderers inside
 * only short-circuit on pre-resolved files. Calling renderRoot directly
 * (without a prepared context) still works: renderers generate on demand,
 * preserving the legacy recursive behavior.
 */

import pMap from "p-map";
import { editly } from "../../ai-sdk/providers/editly";
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
  RenderOptions,
  RenderProps,
  RenderResult,
  SpeechProps,
  VargElement,
} from "../types";
import { audioMixVolume, renderAudio, resolveVideoMixVolume } from "./audio";
import { burnCaptions } from "./burn-captions";
import { type CaptionsResult, renderCaptions } from "./captions";
import { renderClip } from "./clip";
import { createRenderContext, type PreparedRender } from "./context-builder";
import type { EmojiOverlay } from "./emoji";
import { type FlattenResult, flattenClips } from "./flatten";
import { renderImage } from "./image";
import { mergeAssFiles, shiftAssTimestamps, transformCue } from "./merge-ass";
import { renderMusic } from "./music";
import { addTask, completeTask, startTask } from "./progress";
import { renderSpeech } from "./speech";
import { resolveConcurrency, resolvePath } from "./utils";
import { renderVideo } from "./video";

interface RenderedOverlay {
  path: string;
  props: OverlayProps;
  isVideo: boolean;
}

/**
 * Walk <Render> children, flatten clips, collect overlays/music/audio.
 */
async function collectTopLevel(
  element: VargElement<"render">,
  ctx: ReturnType<typeof createRenderContext>["ctx"],
): Promise<{
  flatten: FlattenResult;
  overlayElements: VargElement<"overlay">[];
  musicElements: VargElement<"music">[];
  audioTracks: AudioTrack[];
  hoistedCaptions: FlattenResult["hoistedCaptions"];
}> {
  const overlayElements: VargElement<"overlay">[] = [];
  const musicElements: VargElement<"music">[] = [];
  const audioTracks: AudioTrack[] = [];

  // Collect non-clip top-level children
  const clipChildren: VargElement<"clip">[] = [];
  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;

    if (childElement.type === "clip") {
      clipChildren.push(childElement as VargElement<"clip">);
    } else if (childElement.type === "overlay") {
      overlayElements.push(childElement as VargElement<"overlay">);
    } else if (childElement.type === "captions") {
      // Render-level captions — hoist with clipIndex 0
      // (handled in flatten result, but we need to add it manually)
    } else if (childElement.type === "speech") {
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
    } else if (childElement.type === "audio") {
      const file = await renderAudio(childElement as VargElement<"audio">, ctx);
      const path = await ctx.backend.resolvePath(file);
      audioTracks.push({
        path,
        mixVolume: audioMixVolume(childElement as VargElement<"audio">),
      });
    } else if (childElement.type === "music") {
      musicElements.push(childElement as VargElement<"music">);
    }
  }

  // Flatten clip tree
  const flatten = flattenClips(clipChildren);

  // Add render-level captions (clipIndex 0)
  for (const child of element.children) {
    if (!child || typeof child !== "object" || !("type" in child)) continue;
    const childElement = child as VargElement;
    if (childElement.type === "captions") {
      flatten.hoistedCaptions.push({
        element: childElement as VargElement<"captions">,
        clipIndex: 0,
      });
    }
  }

  return {
    flatten,
    overlayElements,
    musicElements,
    audioTracks,
    hoistedCaptions: flatten.hoistedCaptions,
  };
}

async function renderOverlays(
  overlayElements: VargElement<"overlay">[],
  ctx: ReturnType<typeof createRenderContext>["ctx"],
): Promise<{ renderedOverlays: RenderedOverlay[]; audioTracks: AudioTrack[] }> {
  const renderedOverlays: RenderedOverlay[] = [];
  const audioTracks: AudioTrack[] = [];

  for (const overlay of overlayElements) {
    const overlayProps = overlay.props as OverlayProps;
    for (const child of overlay.children) {
      if (!child || typeof child !== "object" || !("type" in child)) continue;
      const childElement = child as VargElement;

      let file: import("../../ai-sdk/file").File | undefined;
      const isVideo = childElement.type === "video";

      if (childElement.type === "video") {
        file = await renderVideo(childElement as VargElement<"video">, ctx);
      } else if (childElement.type === "image") {
        file = await renderImage(childElement as VargElement<"image">, ctx);
      }

      if (file) {
        const path = await ctx.backend.resolvePath(file);
        renderedOverlays.push({ path, props: overlayProps, isVideo });

        if (isVideo) {
          const mixVolume = await resolveVideoMixVolume({
            backend: ctx.backend,
            keepAudio: overlayProps.keepAudio,
            path,
            volume: overlayProps.volume,
          });
          if (mixVolume === 0) continue;
          audioTracks.push({
            path,
            mixVolume,
          });
        }
      }
    }
  }

  return { renderedOverlays, audioTracks };
}

export async function renderRoot(
  element: VargElement<"render">,
  options: RenderOptions,
  prepared?: PreparedRender,
): Promise<RenderResult> {
  const props = element.props as RenderProps;
  const { ctx, progress, mode, placeholderCount } =
    prepared ?? createRenderContext(element, options);
  const generatedFiles = ctx.generatedFiles;

  // 1. Collect top-level children + flatten clip tree
  const { flatten, overlayElements, musicElements, audioTracks } =
    await collectTopLevel(element, ctx);

  // 2. Render overlays
  const { renderedOverlays, audioTracks: overlayAudio } = await renderOverlays(
    overlayElements,
    ctx,
  );
  audioTracks.push(...overlayAudio);

  // 3. Render clips in parallel
  const concurrency = resolveConcurrency(options.concurrency);

  const clipResults = await pMap(
    flatten.clipElements,
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

  // 4. Assemble timeline with clip start offsets + overlay layers
  const clips: Clip[] = [];
  const clipStartOffsets: number[] = [];
  let currentTime = 0;

  for (let i = 0; i < flatten.clipElements.length; i++) {
    const clipElement = flatten.clipElements[i];
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
    if (i < flatten.clipElements.length - 1 && clip.transition) {
      currentTime -= clip.transition.duration ?? 0;
    }
  }

  const totalDuration = currentTime;

  // 5. Process deferred audio from container clips
  for (const {
    element: audioElement,
    clipIndex,
  } of flatten.deferredAudioElements) {
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
    } else if (audioElement.type === "audio") {
      const file = await renderAudio(audioElement as VargElement<"audio">, ctx);
      const path = await ctx.backend.resolvePath(file);
      audioTracks.push({
        path,
        start: offset,
        mixVolume: audioMixVolume(audioElement as VargElement<"audio">),
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

  // 6. Process hoisted captions
  const hoistedCaptionsResults: CaptionsResult[] = [];
  let mergedAssPath: string | undefined;

  if (flatten.hoistedCaptions.length > 0) {
    for (const {
      element: captionsElement,
      clipIndex,
      window,
    } of flatten.hoistedCaptions) {
      const result = await renderCaptions(captionsElement, ctx);
      hoistedCaptionsResults.push(result);

      if (result.audioPath) {
        // The audio file covers the RAW (untrimmed) clip — apply the same
        // trim window so the mixed track matches what's on screen.
        audioTracks.push({
          path: result.audioPath,
          start: clipStartOffsets[clipIndex] ?? 0,
          mixVolume: 1,
          cutFrom: window?.cutFrom,
          cutTo:
            window?.cutTo ??
            (window && window.duration !== undefined
              ? window.cutFrom + window.duration
              : undefined),
        });
      }
    }

    // Merge ASS files: re-base cue timestamps from raw-clip time to the
    // timeline (shift by clip offset minus cutFrom, drop/clamp cues
    // outside the clip's trim window — see transformCue).
    if (hoistedCaptionsResults.length === 1) {
      const { clipIndex, window } = flatten.hoistedCaptions[0]!;
      const offset = clipStartOffsets[clipIndex] ?? 0;
      const assPath = hoistedCaptionsResults[0]!.assPath;
      mergedAssPath =
        offset > 0 || window
          ? shiftAssTimestamps(assPath, offset, window)
          : assPath;
      if (mergedAssPath !== assPath) {
        ctx.tempFiles.push(mergedAssPath);
      }
    } else if (hoistedCaptionsResults.length > 1) {
      const segments = hoistedCaptionsResults.map((result, i) => ({
        assPath: result.assPath,
        timeOffset:
          clipStartOffsets[flatten.hoistedCaptions[i]!.clipIndex] ?? 0,
        styleSuffix: `_${i}`,
        window: flatten.hoistedCaptions[i]!.window,
      }));
      mergedAssPath = mergeAssFiles(segments, ctx.width, ctx.height);
      ctx.tempFiles.push(mergedAssPath);
    }
  }

  // 7. Process music after clips (need total duration for auto-trim)
  for (const musicElement of musicElements) {
    const musicProps = musicElement.props as MusicProps;
    const cutFrom = musicProps.cutFrom ?? 0;
    const cutTo =
      musicProps.cutTo ??
      (musicProps.duration !== undefined
        ? cutFrom + musicProps.duration
        : totalDuration);

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

  // 8. Run editly
  const hasCaptions = mergedAssPath !== undefined;
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

  // 9. Burn captions
  if (hasCaptions && mergedAssPath) {
    const captionsTaskId = addTask(progress, "captions", "ffmpeg");
    startTask(progress, captionsTaskId);

    // Collect font files from all caption results (deduplicated by URL)
    const fontFileMap = new Map<string, { url: string; fileName: string }>();
    for (const result of hoistedCaptionsResults) {
      for (const font of result.fontFiles ?? []) {
        fontFileMap.set(font.url, font);
      }
    }
    const allFontFiles = [...fontFileMap.values()];

    // Collect emoji overlays from all caption results, re-basing timing
    // from raw-clip time to the timeline (same shift/drop/clamp as cues).
    const allEmojiOverlays: EmojiOverlay[] = [];
    for (let i = 0; i < hoistedCaptionsResults.length; i++) {
      const result = hoistedCaptionsResults[i]!;
      const { clipIndex, window } = flatten.hoistedCaptions[i]!;
      const offset = clipStartOffsets[clipIndex] ?? 0;
      for (const overlay of result.emojiOverlays ?? []) {
        const cue = transformCue(
          overlay.startTime,
          overlay.endTime,
          offset,
          window,
        );
        if (!cue) continue;
        allEmojiOverlays.push(
          cue.start !== overlay.startTime || cue.end !== overlay.endTime
            ? { ...overlay, startTime: cue.start, endTime: cue.end }
            : overlay,
        );
      }
    }

    output = await burnCaptions({
      video: output,
      assPath: mergedAssPath,
      outputPath: finalOutPath,
      backend: options.backend,
      verbose: options.verbose,
      fontFiles: allFontFiles.length > 0 ? allFontFiles : undefined,
      emojiOverlays: allEmojiOverlays.length > 0 ? allEmojiOverlays : undefined,
    });

    if (!options.backend) {
      ctx.tempFiles.push(tempOutPath);
    }

    completeTask(progress, captionsTaskId);
  }

  // 10. Read final output
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

  return {
    video: new Uint8Array(finalBuffer),
    files: generatedFiles,
  };
}
