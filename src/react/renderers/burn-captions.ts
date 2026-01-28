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

export async function burnCaptions(
  options: CaptionOverlayOptions,
): Promise<FFmpegOutput> {
  const { video, assPath, outputPath = "output.mp4", verbose } = options;
  const captions: FFmpegOutput = { type: "file", path: assPath };

  const isCloud = options.backend !== undefined;

  const videoInput = await resolveInputPathMaybeUpload(video, {
    shouldUpload: isCloud,
  });
  const assInput = await resolveInputPathMaybeUpload(captions, {
    shouldUpload: isCloud,
  });

  const backend = options.backend ?? localBackend;

  const result = await backend.run({
    args: [
      "-i",
      videoInput,
      "-vf",
      `subtitles=${assInput}`,
      "-crf",
      "18",
      "-preset",
      "fast",
      "-c:a",
      "copy",
      "-y",
      outputPath,
    ],
    inputs: [videoInput, assInput],
    outputPath,
    verbose,
  });

  return result.output;
}
