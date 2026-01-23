/**
 * FFmpeg provider for local video editing operations
 * This is a special provider that runs locally rather than through an API
 */

import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import type { JobStatusUpdate, ProviderConfig } from "../core/schema/types";
import { BaseProvider } from "./base";

export class FFmpegProvider extends BaseProvider {
  readonly name = "ffmpeg";

  async submit(
    _model: string,
    _inputs: Record<string, unknown>,
    _config?: ProviderConfig,
  ): Promise<string> {
    const jobId = `ffmpeg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(`[ffmpeg] starting local job: ${jobId}`);
    return jobId;
  }

  async getStatus(_jobId: string): Promise<JobStatusUpdate> {
    return { status: "completed" };
  }

  async getResult(_jobId: string): Promise<unknown> {
    return null;
  }

  // ============================================================================
  // Video Operations
  // ============================================================================

  async probe(input: string): Promise<ProbeResult> {
    if (!existsSync(input)) {
      throw new Error(`input file not found: ${input}`);
    }

    console.log(`[ffmpeg] probing ${input}...`);

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(input, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video",
        );
        if (!videoStream) {
          reject(new Error("no video stream found"));
          return;
        }

        const result: ProbeResult = {
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: Number(videoStream.r_frame_rate || "0") || 0,
          codec: videoStream.codec_name || "",
          format: metadata.format.format_name || "",
        };

        console.log(
          `[ffmpeg] ${result.width}x${result.height} @ ${result.fps}fps, ${result.duration}s`,
        );
        resolve(result);
      });
    });
  }

  async getVideoDuration(input: string): Promise<number> {
    const result = await this.probe(input);
    return result.duration;
  }

  async concatVideos(options: {
    inputs: string[];
    output: string;
  }): Promise<string> {
    const { inputs, output } = options;

    for (const input of inputs) {
      if (!existsSync(input)) {
        throw new Error(`input file not found: ${input}`);
      }
    }

    console.log(`[ffmpeg] concatenating ${inputs.length} videos...`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      for (const input of inputs) {
        command.input(input);
      }

      const filterComplex =
        inputs.map((_, i) => `[${i}:v][${i}:a]`).join("") +
        `concat=n=${inputs.length}:v=1:a=1[outv][outa]`;

      command
        .complexFilter(filterComplex)
        .outputOptions(["-map", "[outv]", "-map", "[outa]"])
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async addAudio(options: {
    videoPath: string;
    audioPath: string;
    output: string;
  }): Promise<string> {
    const { videoPath, audioPath, output } = options;

    console.log(`[ffmpeg] adding audio to video...`);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions([
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
        ])
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async resizeVideo(options: {
    input: string;
    output: string;
    width?: number;
    height?: number;
    aspectRatio?: string;
  }): Promise<string> {
    const { input, output, width, height, aspectRatio } = options;

    console.log(`[ffmpeg] resizing video...`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(input);

      if (width && height) {
        command.size(`${width}x${height}`);
      } else if (aspectRatio) {
        command.aspect(aspectRatio);
      }

      command
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async trimVideo(options: {
    input: string;
    output: string;
    start: number;
    duration?: number;
  }): Promise<string> {
    const { input, output, start, duration } = options;

    console.log(`[ffmpeg] trimming video...`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(input).setStartTime(start);

      if (duration) {
        command.setDuration(duration);
      }

      command
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async convertFormat(options: {
    input: string;
    output: string;
    format?: string;
  }): Promise<string> {
    const { input, output, format } = options;

    console.log(`[ffmpeg] converting format...`);

    return new Promise((resolve, reject) => {
      const command = ffmpeg(input);

      if (format) {
        command.format(format);
      }

      command
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async extractAudio(input: string, output: string): Promise<string> {
    console.log(`[ffmpeg] extracting audio...`);

    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .outputOptions(["-vn", "-acodec", "copy"])
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async fadeVideo(options: {
    input: string;
    output: string;
    type: "in" | "out" | "both";
    duration: number;
  }): Promise<string> {
    const { input, output, type, duration } = options;

    if (!existsSync(input)) {
      throw new Error(`input file not found: ${input}`);
    }

    console.log(`[ffmpeg] applying fade ${type} effect...`);

    const videoDuration = await this.getVideoDuration(input);
    const videoFilters: string[] = [];
    const audioFilters: string[] = [];

    if (type === "in" || type === "both") {
      videoFilters.push(`fade=t=in:st=0:d=${duration}`);
      audioFilters.push(`afade=t=in:st=0:d=${duration}`);
    }

    if (type === "out" || type === "both") {
      const fadeOutStart = videoDuration - duration;
      videoFilters.push(`fade=t=out:st=${fadeOutStart}:d=${duration}`);
      audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${duration}`);
    }

    return new Promise((resolve, reject) => {
      const command = ffmpeg(input);

      if (videoFilters.length > 0) {
        command.videoFilters(videoFilters);
      }
      if (audioFilters.length > 0) {
        command.audioFilters(audioFilters);
      }

      command
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async xfadeVideos(options: {
    input1: string;
    input2: string;
    output: string;
    transition:
      | "crossfade"
      | "dissolve"
      | "wipeleft"
      | "wiperight"
      | "slideup"
      | "slidedown";
    duration: number;
    fit?: "pad" | "crop" | "blur" | "stretch";
  }): Promise<string> {
    const {
      input1,
      input2,
      output,
      transition,
      duration,
      fit = "pad",
    } = options;

    if (!existsSync(input1) || !existsSync(input2)) {
      throw new Error("input file not found");
    }

    console.log(`[ffmpeg] applying ${transition} transition...`);

    const [info1, info2] = await Promise.all([
      this.probe(input1),
      this.probe(input2),
    ]);

    const video1Duration = info1.duration;
    const offset = video1Duration - duration;
    const needsScale =
      info1.width !== info2.width || info1.height !== info2.height;

    const transitionMap: Record<string, string> = {
      crossfade: "fade",
      dissolve: "dissolve",
      wipeleft: "wipeleft",
      wiperight: "wiperight",
      slideup: "slideup",
      slidedown: "slidedown",
    };

    const xfadeTransition = transitionMap[transition] || "fade";
    const filters: string[] = [];

    if (needsScale) {
      filters.push(
        buildScaleFilter(fit, info1.width, info1.height, "1:v", "v1scaled"),
      );
      filters.push(
        `[0:v][v1scaled]xfade=transition=${xfadeTransition}:duration=${duration}:offset=${offset}[vout]`,
      );
    } else {
      filters.push(
        `[0:v][1:v]xfade=transition=${xfadeTransition}:duration=${duration}:offset=${offset}[vout]`,
      );
    }

    const hasAudio1 = await this.hasAudioTrack(input1);
    const hasAudio2 = await this.hasAudioTrack(input2);
    const hasAudio = hasAudio1 && hasAudio2;

    return new Promise((resolve, reject) => {
      const command = ffmpeg().input(input1).input(input2);

      const codecOptions = [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "22",
        "-pix_fmt",
        "yuv420p",
      ];

      if (hasAudio) {
        filters.push(`[0:a][1:a]acrossfade=d=${duration}[aout]`);
        command
          .complexFilter(filters)
          .outputOptions([
            "-map",
            "[vout]",
            "-map",
            "[aout]",
            ...codecOptions,
            "-c:a",
            "aac",
            "-b:a",
            "192k",
          ]);
      } else {
        command
          .complexFilter(filters)
          .outputOptions(["-map", "[vout]", ...codecOptions]);
      }

      command
        .output(output)
        .on("end", () => {
          console.log(`[ffmpeg] saved to ${output}`);
          resolve(output);
        })
        .on("error", reject)
        .run();
    });
  }

  async splitAtTimestamps(options: {
    input: string;
    timestamps: number[];
    outputPrefix: string;
  }): Promise<string[]> {
    const { input, timestamps, outputPrefix } = options;

    if (!existsSync(input)) {
      throw new Error(`input file not found: ${input}`);
    }

    console.log(
      `[ffmpeg] splitting video at ${timestamps.length} timestamps...`,
    );

    const videoDuration = await this.getVideoDuration(input);
    const sortedTimestamps = [0, ...timestamps.sort((a, b) => a - b)];

    const lastTimestamp = sortedTimestamps[sortedTimestamps.length - 1];
    if (lastTimestamp !== undefined && lastTimestamp < videoDuration) {
      sortedTimestamps.push(videoDuration);
    }

    const outputs: string[] = [];

    for (let i = 0; i < sortedTimestamps.length - 1; i++) {
      const start = sortedTimestamps[i];
      const end = sortedTimestamps[i + 1];
      if (start === undefined || end === undefined) continue;

      const duration = end - start;
      const partNumber = String(i + 1).padStart(3, "0");
      const outputPath = `${outputPrefix}_${partNumber}.mp4`;

      console.log(`[ffmpeg] extracting part ${i + 1}: ${start}s - ${end}s`);

      await this.trimVideo({
        input,
        output: outputPath,
        start,
        duration,
      });

      outputs.push(outputPath);
    }

    console.log(`[ffmpeg] created ${outputs.length} parts`);
    return outputs;
  }

  private async hasAudioTrack(input: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(input, (err, metadata) => {
        if (err) {
          resolve(false);
          return;
        }
        const audioStream = metadata.streams.find(
          (s) => s.codec_type === "audio",
        );
        resolve(!!audioStream);
      });
    });
  }
}

// Types
export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
}

// Helper function for scale filter
function buildScaleFilter(
  fit: "pad" | "crop" | "blur" | "stretch",
  targetW: number,
  targetH: number,
  inputLabel: string,
  outputLabel: string,
): string {
  switch (fit) {
    case "crop":
      return `[${inputLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}[${outputLabel}]`;
    case "stretch":
      return `[${inputLabel}]scale=${targetW}:${targetH}[${outputLabel}]`;
    case "blur":
      return `[${inputLabel}]split[bg][fg];[bg]scale=${targetW}:${targetH},boxblur=20:20[bgblur];[fg]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fgscaled];[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2[${outputLabel}]`;
    default:
      return `[${inputLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2[${outputLabel}]`;
  }
}

// Export singleton instance
export const ffmpegProvider = new FFmpegProvider();

// Re-export convenience functions for backward compatibility
export const probe = (input: string) => ffmpegProvider.probe(input);
export const getVideoDuration = (input: string) =>
  ffmpegProvider.getVideoDuration(input);
export const concatVideos = (
  options: Parameters<FFmpegProvider["concatVideos"]>[0],
) => ffmpegProvider.concatVideos(options);
export const addAudio = (options: Parameters<FFmpegProvider["addAudio"]>[0]) =>
  ffmpegProvider.addAudio(options);
export const resizeVideo = (
  options: Parameters<FFmpegProvider["resizeVideo"]>[0],
) => ffmpegProvider.resizeVideo(options);
export const trimVideo = (
  options: Parameters<FFmpegProvider["trimVideo"]>[0],
) => ffmpegProvider.trimVideo(options);
export const convertFormat = (
  options: Parameters<FFmpegProvider["convertFormat"]>[0],
) => ffmpegProvider.convertFormat(options);
export const extractAudio = (input: string, output: string) =>
  ffmpegProvider.extractAudio(input, output);
export const fadeVideo = (
  options: Parameters<FFmpegProvider["fadeVideo"]>[0],
) => ffmpegProvider.fadeVideo(options);
export const xfadeVideos = (
  options: Parameters<FFmpegProvider["xfadeVideos"]>[0],
) => ffmpegProvider.xfadeVideos(options);
export const splitAtTimestamps = (
  options: Parameters<FFmpegProvider["splitAtTimestamps"]>[0],
) => ffmpegProvider.splitAtTimestamps(options);
