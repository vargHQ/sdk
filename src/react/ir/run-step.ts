import type { File } from "../../ai-sdk/file";
import { renderAudio } from "../renderers/audio";
import type { RenderContext } from "../renderers/context";
import { renderImage } from "../renderers/image";
import { renderMusic } from "../renderers/music";
import { renderSpeech } from "../renderers/speech";
import { renderTalkingHead } from "../renderers/talking-head";
import { renderVideo } from "../renderers/video";
import {
  resolveFFmpegElement,
  resolveProbeElement,
  resolveSliceElement,
} from "../resolve";
import type { VargElement } from "../types";
import type { Step } from "./types";

/** Probe duration for a media file so meta.duration is populated. */
async function probeStepDuration(
  file: File,
  ctx: RenderContext,
): Promise<number> {
  if (file.duration) return file.duration;
  try {
    const path = await ctx.backend.resolvePath(file);
    const info = await ctx.backend.ffprobe(path);
    return info.duration ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Execute a single step by dispatching to the renderer for its element
 * type, then write the result into `element.meta`.
 *
 * The compose step is a no-op here — it is executed by renderRoot after
 * the plan finishes.
 */
export async function runStep(step: Step, ctx: RenderContext): Promise<void> {
  const element = step.element;

  switch (step.kind) {
    case "generate-image": {
      const file = await renderImage(element as VargElement<"image">, ctx);
      element.meta = { file, duration: 0 };
      return;
    }
    case "generate-video": {
      const file = await renderVideo(element as VargElement<"video">, ctx);
      element.meta = {
        file,
        duration: await probeStepDuration(file, ctx),
      };
      return;
    }
    case "generate-speech": {
      const file = await renderSpeech(element as VargElement<"speech">, ctx);
      element.meta = {
        file,
        duration: await probeStepDuration(file, ctx),
      };
      return;
    }
    case "generate-music": {
      const file = await renderMusic(element as VargElement<"music">, ctx);
      element.meta = {
        file,
        duration: await probeStepDuration(file, ctx),
      };
      return;
    }
    case "talking-head": {
      const file = await renderTalkingHead(
        element as VargElement<"talking-head">,
        ctx,
      );
      element.meta = {
        file,
        duration: await probeStepDuration(file, ctx),
      };
      return;
    }
    case "extract-audio": {
      const file = await renderAudio(element as VargElement<"audio">, ctx);
      element.meta = {
        file,
        duration: await probeStepDuration(file, ctx),
        // Inherit word timings from a resolved speech parent, if any.
        words: (element.props.parent as VargElement | undefined)?.meta?.words,
      };
      return;
    }
    case "slice": {
      const resolved = await resolveSliceElement(
        element as VargElement<"slice">,
        element.props as unknown as Parameters<typeof resolveSliceElement>[1],
      );
      element.meta = resolved.meta;
      return;
    }
    case "ffmpeg": {
      const resolved = await resolveFFmpegElement(
        element as VargElement<"ffmpeg">,
        element.props as unknown as Parameters<typeof resolveFFmpegElement>[1],
      );
      element.meta = resolved.meta;
      return;
    }
    case "probe": {
      const resolved = await resolveProbeElement(
        element as VargElement<"probe">,
        element.props as unknown as Parameters<typeof resolveProbeElement>[1],
      );
      element.meta = resolved.meta;
      return;
    }
    case "compose":
      // The compose step is executed by renderRoot after the plan finishes.
      return;
  }
}
