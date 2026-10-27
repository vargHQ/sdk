import { File } from "../../ai-sdk/file";
import type { FFmpegBackend } from "../../ai-sdk/providers/editly/backends";
import { extractAudio } from "../primitives/audio";
import { ResolvedElement } from "../resolved-element";
import type { AudioElementProps, SpeechProps, VargElement } from "../types";
import type { RenderContext } from "./context";
import { renderSpeech } from "./speech";
import { renderTalkingHead } from "./talking-head";
import { computeCacheKey } from "./utils";
import { renderVideo } from "./video";

// ---------------------------------------------------------------------------
// resolveVideoMixVolume — decide how loud a video layer's own audio should be
// ---------------------------------------------------------------------------

interface ResolveVideoMixVolumeOptions {
  backend: FFmpegBackend;
  keepAudio?: boolean;
  path: string;
  volume?: number;
}

/** Warn at most once per source, so a 13-clip render emits 13 lines, not 13x N. */
const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/** Trim long signed URLs down to something readable in a log line. */
function shortPath(path: string): string {
  const withoutQuery = path.split("?")[0] ?? path;
  const tail = withoutQuery.split("/").pop();
  return tail && tail.length > 0 ? tail : withoutQuery;
}

/**
 * Decide how loud a video layer's own audio should be in the mix.
 *
 * Source audio is on by default, but only when the input actually has an audio
 * stream — referencing `[n:a]` for a stream that does not exist is a hard
 * ffmpeg failure that would take down the whole render.
 *
 * `keepAudio: true` forces it on without probing, `keepAudio: false` forces it
 * off. When the backend cannot tell us whether audio exists we have to mute,
 * because guessing wrong crashes the render — but we say so out loud rather
 * than silently dropping a track the caller paid to generate.
 */
export async function resolveVideoMixVolume({
  backend,
  keepAudio,
  path,
  volume,
}: ResolveVideoMixVolumeOptions): Promise<number> {
  if (keepAudio === false) return 0;
  if (keepAudio === true) return volume ?? 1;

  let info: Awaited<ReturnType<FFmpegBackend["ffprobe"]>>;
  try {
    info = await backend.ffprobe(path);
  } catch (error) {
    warnOnce(
      `probe-failed:${path}`,
      `[varg] Could not probe "${shortPath(path)}" for an audio track ` +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        "Muting it. Pass keepAudio: true to force its audio into the mix.",
    );
    return 0;
  }

  if (info.hasAudio === true) return volume ?? 1;
  if (info.hasAudio === false) return 0;

  // Backend resolved the file but does not report stream-level metadata.
  warnOnce(
    `no-stream-info:${backend.name}`,
    `[varg] Backend "${backend.name}" does not report whether a video has an ` +
      "audio track, so source audio is being muted " +
      `(first seen on "${shortPath(path)}"). ` +
      "Pass keepAudio: true on the Video to force its audio into the mix.",
  );
  return 0;
}

/** Test-only: clear the warn-once cache between cases. */
export function resetAudioWarnings(): void {
  warned.clear();
}

// ---------------------------------------------------------------------------
// renderAudio — render an audio element to a File inside the render pipeline
// ---------------------------------------------------------------------------

/**
 * Render an audio element to a File inside the render pipeline.
 *
 * Mirrors `resolveAudioElement` (standalone path) but reuses the render
 * context: parent video/speech render through the normal renderers with
 * pendingFiles dedup, and audio extraction goes through ctx.backend.
 */
export async function renderAudio(
  element: VargElement<"audio">,
  ctx: RenderContext,
): Promise<File> {
  // Pre-resolved (awaited, or derived from a resolved speech parent)
  if (element instanceof ResolvedElement || element.meta?.file) {
    const file = (element.meta as { file: File }).file;
    ctx.generatedFiles.push(file);
    return file;
  }

  const props = element.props as AudioElementProps;

  if (props.src) {
    return props.src.startsWith("http")
      ? File.fromUrl(props.src)
      : File.fromPath(props.src);
  }

  const parent = props.parent as VargElement | undefined;
  if (!parent) {
    throw new Error("Audio element requires a 'parent' element or 'src'");
  }

  if (parent.type === "speech") {
    return renderSpeech(parent as VargElement<"speech">, ctx);
  }

  if (parent.type === "video" || parent.type === "talking-head") {
    // Dedup concurrent extractions of the same parent
    const cacheKeyStr = `audio-extract:${JSON.stringify(computeCacheKey(parent))}`;
    const pending = ctx.pendingFiles.get(cacheKeyStr);
    if (pending) return pending;

    const promise = (async () => {
      const videoFile =
        parent.meta?.file ??
        (parent.type === "video"
          ? await renderVideo(parent as VargElement<"video">, ctx)
          : await renderTalkingHead(
              parent as VargElement<"talking-head">,
              ctx,
            ));
      const audioFile = await extractAudio(videoFile, ctx.backend);
      ctx.generatedFiles.push(audioFile);
      return audioFile;
    })();

    ctx.pendingFiles.set(cacheKeyStr, promise);
    return promise;
  }

  throw new Error(
    `Audio element parent must be a video or speech element, got "${parent.type}"`,
  );
}

/** Volume for an audio element in the mix (inherits speech parent volume). */
export function audioMixVolume(element: VargElement<"audio">): number {
  const props = element.props as AudioElementProps;
  if (props.volume !== undefined) return props.volume;
  const parentProps = props.parent?.props as SpeechProps | undefined;
  return parentProps?.volume ?? 1;
}
