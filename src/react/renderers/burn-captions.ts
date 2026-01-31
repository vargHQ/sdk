import { localBackend } from "@/ai-sdk/providers/editly";
import type {
  FFmpegBackend,
  FFmpegOutput,
} from "../../ai-sdk/providers/editly/backends/types";
import { uploadBuffer } from "../../providers/storage";

/**
 * Resolves an FFmpegOutput to a string path/URL, uploading local files if needed.
 *
 * - URL input → returns URL as-is
 * - File input + shouldUpload=false → returns local path
 * - File input + shouldUpload=true → uploads to storage, returns URL
 */
async function resolveInputPathMaybeUpload(
  input: FFmpegOutput,
  options: { shouldUpload: boolean },
): Promise<string> {
  if (input.type === "url") return input.url;
  if (!options.shouldUpload) return input.path;

  const buffer = await Bun.file(input.path).arrayBuffer();
  return uploadBuffer(
    buffer,
    `tmp/${Date.now()}-${input.path.split("/").pop()}`,
    "application/octet-stream",
  );
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

  // Resolve backend first so we can check if it's cloud or local
  // TODO: This is a hack - we should abstract backend capabilities (e.g., supportsLocalPaths)
  // instead of checking the name directly. For now, we assume "local" is the only local backend.
  const backend = options.backend ?? localBackend;
  const isCloud = backend.name !== "local";

  const videoInput = await resolveInputPathMaybeUpload(video, {
    shouldUpload: isCloud,
  });
  const assInput = await resolveInputPathMaybeUpload(captions, {
    shouldUpload: isCloud,
  });

  // For cloud backends (Rendi): pass raw URL so replaceWithPlaceholders() can match
  // and replace with {{in_X}} placeholder. Rendi downloads inputs and provides local paths.
  // For local backend: escape for FFmpeg filter syntax (backslashes and colons)
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
