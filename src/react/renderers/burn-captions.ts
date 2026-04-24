import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

/** Font file descriptor for caption rendering. */
export interface CaptionFontFile {
  /** Public URL of the font file (e.g. https://s3.varg.ai/fonts/Montserrat-Bold.ttf) */
  url: string;
  /** Filename (e.g. "Montserrat-Bold.ttf") */
  fileName: string;
}

export interface CaptionOverlayOptions {
  video: FFmpegOutput;
  assPath: string;
  outputPath: string;
  backend?: FFmpegBackend;
  verbose?: boolean;
  /** Font files to include for subtitle rendering. When provided, fontsdir is set. */
  fontFiles?: CaptionFontFile[];
}

/** Local font cache directory. */
const LOCAL_FONTS_DIR = "/tmp/varg-caption-fonts";

/**
 * Download font files to a local directory for the local FFmpeg backend.
 * Fonts are cached by filename — only downloaded once per process lifetime.
 */
async function ensureLocalFonts(fontFiles: CaptionFontFile[]): Promise<string> {
  if (!existsSync(LOCAL_FONTS_DIR)) {
    mkdirSync(LOCAL_FONTS_DIR, { recursive: true });
  }
  await Promise.all(
    fontFiles.map(async (font) => {
      const localPath = `${LOCAL_FONTS_DIR}/${font.fileName}`;
      if (existsSync(localPath)) return;
      const res = await fetch(font.url);
      if (!res.ok)
        throw new Error(
          `Failed to download font ${font.fileName}: ${res.status}`,
        );
      writeFileSync(localPath, new Uint8Array(await res.arrayBuffer()));
    }),
  );
  return LOCAL_FONTS_DIR;
}

/**
 * Burns ASS subtitle captions onto a video using FFmpeg.
 *
 * {@link burnCaptions} composites the subtitle file directly into the video frames,
 * producing a new video with hardcoded captions. Supports both local and cloud
 * FFmpeg backends - when using a cloud backend, input files are automatically
 * uploaded to storage.
 *
 * When `fontFiles` are provided:
 * - **Local backend**: fonts are downloaded to a temp directory, and `fontsdir=`
 *   is appended to the subtitles filter so FFmpeg/libass can find them.
 * - **Cloud backend (Rendi)**: font files are passed as `auxiliaryFiles` in the
 *   run options. The backend bundles them into a compressed input folder and
 *   uses `fontsdir=.` so FFmpeg finds them in the working directory.
 *
 * @param options - Configuration for the caption burn operation
 * @returns Promise resolving to {@link FFmpegOutput} containing the path or URL of the captioned video
 */
export async function burnCaptions(
  options: CaptionOverlayOptions,
): Promise<FFmpegOutput> {
  const {
    video,
    assPath,
    outputPath = "output.mp4",
    verbose,
    fontFiles,
  } = options;
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

  // Build the video filter with optional fontsdir
  let videoFilter: string;
  const useCompressedFolder = isCloud && fontFiles && fontFiles.length > 0;
  if (fontFiles && fontFiles.length > 0) {
    if (isCloud) {
      // For Rendi compressed folder: use the bare filename of the ASS file
      // (all files are in the same working directory after ZIP extraction)
      const assFileName =
        assInput.split("/").pop()?.split("?")[0] ?? "captions.ass";
      videoFilter = `subtitles=${assFileName}:fontsdir=.`;
    } else {
      // For local: download fonts and point fontsdir to the local cache
      const fontsDir = await ensureLocalFonts(fontFiles);
      const escapedFontsDir = fontsDir
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:");
      videoFilter = `subtitles=${subtitlesPath}:fontsdir=${escapedFontsDir}`;
    }
  } else {
    videoFilter = `subtitles=${subtitlesPath}`;
  }

  // Build auxiliary files for cloud backends (fonts to bundle in compressed folder)
  const auxiliaryFiles =
    isCloud && fontFiles && fontFiles.length > 0
      ? fontFiles.map((f) => ({ url: f.url, fileName: f.fileName }))
      : undefined;

  const result = await backend.run({
    inputs: [videoInput, assInput],
    videoFilter,
    outputArgs: ["-crf", "18", "-preset", "fast", "-c:a", "copy"],
    outputPath,
    verbose,
    auxiliaryFiles,
  });

  return result.output;
}
