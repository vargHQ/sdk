#!/usr/bin/env bun

/**
 * ffmpeg wrapper for video editing operations
 * requires ffmpeg to be installed on the system
 */

import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";

// types
export interface ConcatVideosOptions {
  inputs: string[];
  output: string;
  transition?: boolean;
}

export interface AddAudioOptions {
  videoPath: string;
  audioPath: string;
  output: string;
}

export interface ResizeVideoOptions {
  input: string;
  output: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
}

export interface TrimVideoOptions {
  input: string;
  output: string;
  start: number;
  duration?: number;
}

export interface ConvertFormatOptions {
  input: string;
  output: string;
  format?: string;
}

// core functions
export async function concatVideos(
  options: ConcatVideosOptions,
): Promise<string> {
  const { inputs, output } = options;

  if (!inputs || inputs.length === 0) {
    throw new Error("inputs are required");
  }
  if (!output) {
    throw new Error("output is required");
  }

  // validate all inputs exist
  for (const input of inputs) {
    if (!existsSync(input)) {
      throw new Error(`input file not found: ${input}`);
    }
  }

  console.log(`[ffmpeg] concatenating ${inputs.length} videos...`);

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    // add all inputs
    for (const input of inputs) {
      command.input(input);
    }

    // use concat filter
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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

export async function addAudio(options: AddAudioOptions): Promise<string> {
  const { videoPath, audioPath, output } = options;

  if (!videoPath || !audioPath || !output) {
    throw new Error("videoPath, audioPath, and output are required");
  }

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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

export async function resizeVideo(
  options: ResizeVideoOptions,
): Promise<string> {
  const { input, output, width, height, aspectRatio } = options;

  if (!input || !output) {
    throw new Error("input and output are required");
  }

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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

export async function trimVideo(options: TrimVideoOptions): Promise<string> {
  const { input, output, start, duration } = options;

  if (!input || !output || start === undefined) {
    throw new Error("input, output, and start are required");
  }

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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

export async function convertFormat(
  options: ConvertFormatOptions,
): Promise<string> {
  const { input, output, format } = options;

  if (!input || !output) {
    throw new Error("input and output are required");
  }

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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

export async function extractAudio(
  input: string,
  output: string,
): Promise<string> {
  if (!input || !output) {
    throw new Error("input and output are required");
  }

  console.log(`[ffmpeg] extracting audio...`);

  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions(["-vn", "-acodec", "copy"])
      .output(output)
      .on("end", () => {
        console.log(`[ffmpeg] saved to ${output}`);
        resolve(output);
      })
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

export interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  format: string;
}

export async function probe(input: string): Promise<ProbeResult> {
  if (!input) {
    throw new Error("input is required");
  }

  if (!existsSync(input)) {
    throw new Error(`input file not found: ${input}`);
  }

  console.log(`[ffmpeg] probing ${input}...`);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, metadata) => {
      if (err) {
        console.error(`[ffmpeg] error:`, err);
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
        fps: eval(videoStream.r_frame_rate || "0") || 0,
        codec: videoStream.codec_name || "",
        format: metadata.format.format_name || "",
      };

      console.log(
        `[ffmpeg] ${result.width}x${result.height} @ ${result.fps}fps, ${result.duration}s, codec: ${result.codec}`,
      );
      resolve(result);
    });
  });
}

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run lib/ffmpeg.ts <command> [args]

commands:
  probe <input>                                    get video metadata
  concat <output> <input1> <input2> [input3...]    concatenate videos
  add_audio <video> <audio> <output>               add audio to video
  resize <input> <output> <width> <height>         resize video
  trim <input> <output> <start> [duration]         trim video
  convert <input> <output> [format]                convert format
  extract_audio <input> <output>                   extract audio from video
  help                                             show this help

examples:
  bun run lib/ffmpeg.ts probe input.mp4
  bun run lib/ffmpeg.ts concat output.mp4 video1.mp4 video2.mp4
  bun run lib/ffmpeg.ts add_audio video.mp4 audio.mp3 output.mp4
  bun run lib/ffmpeg.ts resize input.mp4 output.mp4 1920 1080
  bun run lib/ffmpeg.ts trim input.mp4 output.mp4 10 30
  bun run lib/ffmpeg.ts convert input.mov output.mp4
  bun run lib/ffmpeg.ts extract_audio input.mp4 output.mp3

requirements:
  ffmpeg must be installed on your system
  brew install ffmpeg (macos)
  apt-get install ffmpeg (linux)
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "probe": {
        const input = args[1];

        if (!input) {
          throw new Error("input is required");
        }

        const result = await probe(input);
        console.log("\nmetadata:");
        console.log(`  duration: ${result.duration}s`);
        console.log(`  resolution: ${result.width}x${result.height}`);
        console.log(`  fps: ${result.fps}`);
        console.log(`  codec: ${result.codec}`);
        console.log(`  format: ${result.format}`);
        break;
      }

      case "concat": {
        const output = args[1];
        const inputs = args.slice(2);

        if (!output || inputs.length === 0) {
          throw new Error("output and at least one input are required");
        }

        await concatVideos({ inputs, output });
        break;
      }

      case "add_audio": {
        const videoPath = args[1];
        const audioPath = args[2];
        const output = args[3];

        if (!videoPath || !audioPath || !output) {
          throw new Error("videoPath, audioPath, and output are required");
        }

        await addAudio({ videoPath, audioPath, output });
        break;
      }

      case "resize": {
        const input = args[1];
        const output = args[2];
        const widthArg = args[3];
        const heightArg = args[4];

        if (!input || !output || !widthArg || !heightArg) {
          throw new Error("input, output, width, and height are required");
        }

        const width = Number.parseInt(widthArg, 10);
        const height = Number.parseInt(heightArg, 10);

        if (Number.isNaN(width) || Number.isNaN(height)) {
          throw new Error("width and height must be valid numbers");
        }

        await resizeVideo({ input, output, width, height });
        break;
      }

      case "trim": {
        const input = args[1];
        const output = args[2];
        const startArg = args[3];

        if (!input || !output || !startArg) {
          throw new Error("input, output, and start are required");
        }

        const start = Number.parseFloat(startArg);
        if (Number.isNaN(start)) {
          throw new Error("start must be a valid number");
        }

        const duration = args[4] ? parseFloat(args[4]) : undefined;

        await trimVideo({ input, output, start, duration });
        break;
      }

      case "convert": {
        const input = args[1];
        const output = args[2];
        const format = args[3];

        if (!input || !output) {
          throw new Error("input and output are required");
        }

        await convertFormat({ input, output, format });
        break;
      }

      case "extract_audio": {
        const input = args[1];
        const output = args[2];

        if (!input || !output) {
          throw new Error("input and output are required");
        }

        await extractAudio(input, output);
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log(`run 'bun run lib/ffmpeg.ts help' for usage`);
        process.exit(1);
    }
  } catch (error) {
    console.error(`[ffmpeg] error:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
