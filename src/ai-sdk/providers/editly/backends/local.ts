import { $ } from "bun";
import type {
  FFmpegBackend,
  FFmpegRunOptions,
  FFmpegRunResult,
  VideoInfo,
} from "./types";

const FFMPEG_COMMON_ARGS = ["-hide_banner", "-loglevel", "error"];

export class LocalBackend implements FFmpegBackend {
  readonly name = "local";

  async ffprobe(input: string): Promise<VideoInfo> {
    const result =
      await $`ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_type -show_entries format=duration -of json ${input}`.json();

    const videoStream = result.streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    );
    const duration = parseFloat(result.format?.duration ?? "0");

    let fps: number | undefined;
    const framerateStr: string | undefined = videoStream?.r_frame_rate;
    if (framerateStr) {
      const parts = framerateStr.split("/").map(Number);
      const num = parts[0];
      const den = parts[1];
      if (den && den > 0 && num) fps = num / den;
    }

    return {
      duration,
      width: videoStream?.width,
      height: videoStream?.height,
      fps,
      framerateStr,
    };
  }

  async run(options: FFmpegRunOptions): Promise<FFmpegRunResult> {
    const { args, outputPath, verbose } = options;

    const ffmpegArgs = [
      ...FFMPEG_COMMON_ARGS.slice(0, 2),
      verbose ? "info" : "error",
      ...args,
    ];

    if (verbose) {
      console.log("ffmpeg", ffmpegArgs.join(" "));
    }

    const result = await $`ffmpeg ${ffmpegArgs}`.quiet();

    if (result.exitCode !== 0) {
      throw new Error(`ffmpeg failed with exit code ${result.exitCode}`);
    }

    return { output: { type: "file", path: outputPath } };
  }
}

export const localBackend = new LocalBackend();
