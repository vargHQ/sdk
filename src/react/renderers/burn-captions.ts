import type {
  FFmpegBackend,
  FFmpegOutput,
} from "../../ai-sdk/providers/editly/backends/types";
import { uploadBuffer } from "../../providers/storage";

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
  const { video, assPath, outputPath, backend, verbose } = options;

  if (backend) {
    const videoInput = video.type === "url" ? video.url : video.path;

    let assInput = assPath;
    if (video.type === "url") {
      const assBuffer = await Bun.file(assPath).arrayBuffer();
      const assKey = `tmp/captions-${Date.now()}.ass`;
      assInput = await uploadBuffer(assBuffer, assKey, "text/plain");
    }

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
        "output.mp4",
      ],
      inputs: [videoInput, assInput],
      outputPath: "output.mp4",
      verbose,
    });

    return result.output;
  }

  let localPath: string;
  let tempFile: string | null = null;

  if (video.type === "url") {
    const res = await fetch(video.url);
    if (!res.ok) throw new Error(`Failed to download render: ${res.status}`);
    tempFile = `/tmp/varg-caption-input-${Date.now()}.mp4`;
    await Bun.write(tempFile, await res.arrayBuffer());
    localPath = tempFile;
  } else {
    localPath = video.path;
  }

  try {
    const { $ } = await import("bun");
    await $`ffmpeg -y -i ${localPath} -vf "ass=${assPath}" -crf 18 -preset slow -c:a copy ${outputPath}`.quiet();

    return { type: "file", path: outputPath };
  } finally {
    if (tempFile) {
      await Bun.file(tempFile)
        .unlink()
        .catch(() => {});
    }
  }
}
