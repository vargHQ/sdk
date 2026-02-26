import { localBackend } from "@/ai-sdk/providers/editly";
import type {
  FFmpegBackend,
  FFmpegOutput,
} from "../../ai-sdk/providers/editly/backends/types";

/**
 * Resolves an FFmpegOutput to a string path/URL via the backend.
 * Local backend returns local paths; cloud backends upload and return URLs.
 */
async function resolveInputPathMaybeUpload(
  input: FFmpegOutput,
  backend: FFmpegBackend,
): Promise<string> {
  if (input.type === "url") return input.url;
  return backend.resolvePath(input.path);
}

export interface CaptionOverlayOptions {
  video: FFmpegOutput;
  assPath: string;
  outputPath: string;
  backend?: FFmpegBackend;
  verbose?: boolean;
}

/**
 * Burns ASS subtitle captions onto a video using FFmpeg.
 *
 * {@link burnCaptions} composites the subtitle file directly into the video frames,
 * producing a new video with hardcoded captions. Supports both local and cloud
 * FFmpeg backends - when using a cloud backend, input files are automatically
 * uploaded to storage.
 *
 * @param options - Configuration for the caption burn operation
 * @param options.video - Source video as {@link FFmpegOutput} (file path or URL)
 * @param options.assPath - Path to the ASS subtitle file to burn
 * @param options.outputPath - Destination path for the output video (defaults to "output.mp4")
 * @param options.backend - Optional {@link FFmpegBackend} for cloud processing; uses local FFmpeg if omitted
 * @param options.verbose - Enable verbose FFmpeg logging
 *
 * @returns Promise resolving to {@link FFmpegOutput} containing the path or URL of the captioned video
 *
 * @throws May throw if FFmpeg execution fails, input files are missing, or upload fails for cloud backends
 *
 * @example
 * ```ts
 * const result = await burnCaptions({
 *   video: { type: "file", path: "input.mp4" },
 *   assPath: "captions.ass",
 *   outputPath: "output-with-captions.mp4",
 * });
 * ```
 */
export async function burnCaptions(
  options: CaptionOverlayOptions,
): Promise<FFmpegOutput> {
  const { video, assPath, outputPath = "output.mp4", verbose } = options;
  const captions: FFmpegOutput = { type: "file", path: assPath };

  const backend = options.backend ?? localBackend;

  const videoInput = await resolveInputPathMaybeUpload(video, backend);
  const assInput = await resolveInputPathMaybeUpload(captions, backend);

  // For cloud backends (Rendi): pass raw URL so replaceWithPlaceholders() can match
  // and replace with {{in_X}} placeholder. Rendi downloads inputs and provides local paths.
  // For local backend: escape for FFmpeg filter syntax (backslashes and colons)
  const isCloud = backend.name !== "local";
  const subtitlesPath = isCloud
    ? assInput
    : assInput.replace(/\\/g, "\\\\").replace(/:/g, "\\:");

  const result = await backend.run({
    inputs: [videoInput, assInput],
    videoFilter: `subtitles=${subtitlesPath}`,
    outputArgs: ["-crf", "18", "-preset", "fast", "-c:a", "copy"],
    outputPath,
    verbose,
  });

  return result.output;
}
