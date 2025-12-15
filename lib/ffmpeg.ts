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

export interface FadeVideoOptions {
  input: string;
  output: string;
  type: "in" | "out" | "both";
  duration: number;
}

export interface XfadeOptions {
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
}

export interface SplitAtTimestampsOptions {
  input: string;
  timestamps: number[];
  outputPrefix: string;
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
        fps: Number(videoStream.r_frame_rate || "0") || 0,
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

/**
 * get video duration in seconds
 */
export async function getVideoDuration(input: string): Promise<number> {
  const result = await probe(input);
  return result.duration;
}

/**
 * apply fade in/out effects to video
 */
export async function fadeVideo(options: FadeVideoOptions): Promise<string> {
  const { input, output, type, duration } = options;

  if (!input || !output) {
    throw new Error("input and output are required");
  }

  if (!existsSync(input)) {
    throw new Error(`input file not found: ${input}`);
  }

  console.log(`[ffmpeg] applying fade ${type} effect...`);

  const videoDuration = await getVideoDuration(input);
  const filters: string[] = [];

  if (type === "in" || type === "both") {
    filters.push(`fade=t=in:st=0:d=${duration}`);
  }

  if (type === "out" || type === "both") {
    const fadeOutStart = videoDuration - duration;
    filters.push(`fade=t=out:st=${fadeOutStart}:d=${duration}`);
  }

  // Also fade audio
  const audioFilters: string[] = [];
  if (type === "in" || type === "both") {
    audioFilters.push(`afade=t=in:st=0:d=${duration}`);
  }
  if (type === "out" || type === "both") {
    const fadeOutStart = videoDuration - duration;
    audioFilters.push(`afade=t=out:st=${fadeOutStart}:d=${duration}`);
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg(input);

    if (filters.length > 0) {
      command.videoFilters(filters);
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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

/**
 * check if video has audio track
 */
async function hasAudioTrack(input: string): Promise<boolean> {
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

/**
 * Build scale filter for fitting video to target resolution
 * @param fit - how to handle aspect ratio differences
 * @param targetW - target width
 * @param targetH - target height
 * @param inputLabel - input stream label (e.g., "1:v")
 * @param outputLabel - output stream label (e.g., "v1scaled")
 */
function buildScaleFilter(
  fit: "pad" | "crop" | "blur" | "stretch",
  targetW: number,
  targetH: number,
  inputLabel: string,
  outputLabel: string,
): string {
  switch (fit) {
    case "crop":
      // Scale up to cover, then crop center
      return `[${inputLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH}[${outputLabel}]`;

    case "stretch":
      // Simple stretch (distorts aspect ratio)
      return `[${inputLabel}]scale=${targetW}:${targetH}[${outputLabel}]`;

    case "blur":
      // Blur background fill (like TikTok/Instagram)
      // 1. Create blurred scaled background
      // 2. Overlay scaled video on top
      return `[${inputLabel}]split[bg][fg];[bg]scale=${targetW}:${targetH},boxblur=20:20[bgblur];[fg]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fgscaled];[bgblur][fgscaled]overlay=(W-w)/2:(H-h)/2[${outputLabel}]`;

    case "pad":
    default:
      // Add black bars (letterbox/pillarbox)
      return `[${inputLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2[${outputLabel}]`;
  }
}

/**
 * crossfade transition between two videos using xfade filter
 * automatically scales second video to match first if resolutions differ
 * @param fit - how to handle resolution differences: pad (black bars), crop, blur (TikTok style), stretch
 */
export async function xfadeVideos(options: XfadeOptions): Promise<string> {
  const { input1, input2, output, transition, duration, fit = "pad" } = options;

  if (!input1 || !input2 || !output) {
    throw new Error("input1, input2, and output are required");
  }

  if (!existsSync(input1)) {
    throw new Error(`input file not found: ${input1}`);
  }
  if (!existsSync(input2)) {
    throw new Error(`input file not found: ${input2}`);
  }

  console.log(`[ffmpeg] applying ${transition} transition...`);

  // Get info for both videos
  const [info1, info2] = await Promise.all([probe(input1), probe(input2)]);

  const video1Duration = info1.duration;
  const offset = video1Duration - duration;

  // Check if videos have audio
  const [hasAudio1, hasAudio2] = await Promise.all([
    hasAudioTrack(input1),
    hasAudioTrack(input2),
  ]);
  const hasAudio = hasAudio1 && hasAudio2;

  // Check if resolutions differ
  const needsScale =
    info1.width !== info2.width || info1.height !== info2.height;

  if (needsScale) {
    console.log(
      `[ffmpeg] fitting video2 (${info2.width}x${info2.height}) to (${info1.width}x${info1.height}) using "${fit}" mode`,
    );
  }

  // Map transition names to ffmpeg xfade transition names
  const transitionMap: Record<string, string> = {
    crossfade: "fade",
    dissolve: "dissolve",
    wipeleft: "wipeleft",
    wiperight: "wiperight",
    slideup: "slideup",
    slidedown: "slidedown",
  };

  const xfadeTransition = transitionMap[transition] || "fade";

  return new Promise((resolve, reject) => {
    const command = ffmpeg().input(input1).input(input2);

    // Build filter complex based on audio and scale requirements
    const filters: string[] = [];

    if (needsScale) {
      // Scale second video to match first using specified fit mode
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

    // Common output options for proper codec compatibility
    const codecOptions = [
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "22",
      "-pix_fmt",
      "yuv420p", // Ensures compatibility with most players
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
      .on("error", (err) => {
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
  });
}

/**
 * split video at specific timestamps into multiple files
 */
export async function splitAtTimestamps(
  options: SplitAtTimestampsOptions,
): Promise<string[]> {
  const { input, timestamps, outputPrefix } = options;

  if (!input || !outputPrefix) {
    throw new Error("input and outputPrefix are required");
  }

  if (!existsSync(input)) {
    throw new Error(`input file not found: ${input}`);
  }

  if (!timestamps || timestamps.length === 0) {
    throw new Error("at least one timestamp is required");
  }

  console.log(`[ffmpeg] splitting video at ${timestamps.length} timestamps...`);

  const videoDuration = await getVideoDuration(input);
  const sortedTimestamps = [0, ...timestamps.sort((a, b) => a - b)];

  // Add video duration as the last point if not already included
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

    console.log(
      `[ffmpeg] extracting part ${i + 1}: ${start}s - ${end}s (${duration}s)`,
    );

    await trimVideo({
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

/**
 * concatenate videos using a file list (safer for many files)
 */
export async function concatWithFileList(
  inputs: string[],
  output: string,
): Promise<string> {
  if (!inputs || inputs.length === 0) {
    throw new Error("at least one input is required");
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

  console.log(
    `[ffmpeg] concatenating ${inputs.length} videos with file list...`,
  );

  // Create a temporary file list
  const { writeFileSync, unlinkSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");

  const listPath = join(tmpdir(), `concat-list-${Date.now()}.txt`);
  const listContent = inputs.map((f) => `file '${f}'`).join("\n");
  writeFileSync(listPath, listContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(["-f", "concat", "-safe", "0"])
      .outputOptions(["-c", "copy"])
      .output(output)
      .on("end", () => {
        // Cleanup temp file
        try {
          unlinkSync(listPath);
        } catch {
          // ignore cleanup errors
        }
        console.log(`[ffmpeg] saved to ${output}`);
        resolve(output);
      })
      .on("error", (err) => {
        // Cleanup temp file
        try {
          unlinkSync(listPath);
        } catch {
          // ignore cleanup errors
        }
        console.error(`[ffmpeg] error:`, err);
        reject(err);
      })
      .run();
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
