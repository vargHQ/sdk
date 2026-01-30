import { $ } from "bun";
import type {
  FFmpegBackend,
  FFmpegInput,
  FFmpegRunOptions,
  FFmpegRunResult,
  VideoInfo,
} from "./types";

export class LocalBackend implements FFmpegBackend {
  readonly name = "local";

  async ffprobe(input: string): Promise<VideoInfo> {
    const result =
      await $`ffprobe -v error -show_entries stream=width,height,r_frame_rate,codec_type -show_entries format=duration -of json ${input}`.json();

    const videoStream = result.streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    );
    const parsedDuration = parseFloat(result.format?.duration ?? "0");
    const duration = Number.isFinite(parsedDuration) ? parsedDuration : 0;

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

  private buildInputArgs(inputs: FFmpegInput[]): string[] {
    const args: string[] = [];
    for (const input of inputs) {
      if (typeof input === "string") {
        args.push("-i", input);
      } else if ("raw" in input) {
        args.push(...input.raw);
      } else {
        if (input.options) args.push(...input.options);
        args.push("-i", input.path);
      }
    }
    return args;
  }

  async run(options: FFmpegRunOptions): Promise<FFmpegRunResult> {
    const {
      inputs,
      filterComplex,
      videoFilter,
      outputArgs = [],
      outputPath,
      verbose,
    } = options;

    const inputArgs = this.buildInputArgs(inputs);

    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel",
      verbose ? "info" : "error",
      ...inputArgs,
      ...(filterComplex ? ["-filter_complex", filterComplex] : []),
      ...(videoFilter ? ["-vf", videoFilter] : []),
      ...outputArgs,
      "-y",
      outputPath,
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
