#!/usr/bin/env bun

/**
 * video editing service
 * combines multiple ffmpeg operations into common workflows
 */

import { existsSync } from "node:fs";
import { extname } from "node:path";
import {
  type AddAudioOptions,
  addAudio,
  type ConcatVideosOptions,
  type ConvertFormatOptions,
  concatVideos,
  convertFormat,
  extractAudio,
  type ResizeVideoOptions,
  resizeVideo,
  type TrimVideoOptions,
  trimVideo,
} from "../../lib/ffmpeg";

// types
export interface EditPipelineStep {
  operation:
    | "concat"
    | "add_audio"
    | "resize"
    | "trim"
    | "convert"
    | "extract_audio";
  // options should contain all parameters except 'output' which is added by the pipeline
  // biome-ignore lint/suspicious/noExplicitAny: pipeline options are validated at runtime by underlying ffmpeg functions
  options: Record<string, any>;
}

export interface EditPipelineOptions {
  steps: EditPipelineStep[];
  finalOutput: string;
}

export interface PrepareForSocialOptions {
  input: string;
  output: string;
  platform: "tiktok" | "instagram" | "youtube-shorts" | "youtube" | "twitter";
  withAudio?: string;
}

export interface CreateMontageOptions {
  clips: string[];
  output: string;
  maxClipDuration?: number;
  targetResolution?: { width: number; height: number };
}

// core functions

/**
 * run a series of editing operations in sequence
 * each step uses output from previous step as input
 */
export async function editPipeline(
  options: EditPipelineOptions,
): Promise<string> {
  const { steps, finalOutput } = options;

  if (!steps || steps.length === 0) {
    throw new Error("at least one step is required");
  }

  console.log(`[edit] running ${steps.length} editing steps...`);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) {
      throw new Error(`step ${i} is undefined`);
    }

    const isLastStep = i === steps.length - 1;
    const output = isLastStep
      ? finalOutput
      : `/tmp/edit-step-${i}${extname(finalOutput)}`;

    console.log(`[edit] step ${i + 1}/${steps.length}: ${step.operation}`);

    switch (step.operation) {
      case "concat":
        await concatVideos({
          ...step.options,
          output,
        } as ConcatVideosOptions);
        break;

      case "add_audio":
        await addAudio({
          ...step.options,
          output,
        } as AddAudioOptions);
        break;

      case "resize":
        await resizeVideo({
          ...step.options,
          output,
        } as ResizeVideoOptions);
        break;

      case "trim":
        await trimVideo({
          ...step.options,
          output,
        } as TrimVideoOptions);
        break;

      case "convert":
        await convertFormat({
          ...step.options,
          output,
        } as ConvertFormatOptions);
        break;

      case "extract_audio":
        await extractAudio((step.options as { input: string }).input, output);
        break;

      default:
        throw new Error(`unknown operation: ${step.operation}`);
    }
  }

  console.log(`[edit] pipeline complete: ${finalOutput}`);
  return finalOutput;
}

/**
 * prepare video for social media platform
 * automatically sets correct aspect ratio and resolution
 */
export async function prepareForSocial(
  options: PrepareForSocialOptions,
): Promise<string> {
  const { input, output, platform, withAudio } = options;

  if (!input || !output || !platform) {
    throw new Error("input, output, and platform are required");
  }

  if (!existsSync(input)) {
    throw new Error(`input file not found: ${input}`);
  }

  console.log(`[edit] preparing video for ${platform}...`);

  const platformSpecs: Record<
    string,
    { width: number; height: number; aspectRatio: string }
  > = {
    tiktok: { width: 1080, height: 1920, aspectRatio: "9:16" },
    instagram: { width: 1080, height: 1920, aspectRatio: "9:16" },
    "youtube-shorts": { width: 1080, height: 1920, aspectRatio: "9:16" },
    youtube: { width: 1920, height: 1080, aspectRatio: "16:9" },
    twitter: { width: 1280, height: 720, aspectRatio: "16:9" },
  };

  const spec = platformSpecs[platform];
  if (!spec) {
    throw new Error(`unknown platform: ${platform}`);
  }

  const steps: EditPipelineStep[] = [];

  // resize to platform specs
  steps.push({
    operation: "resize",
    options: {
      input,
      width: spec.width,
      height: spec.height,
    },
  });

  // add audio if provided
  if (withAudio) {
    if (!existsSync(withAudio)) {
      throw new Error(`audio file not found: ${withAudio}`);
    }
    steps.push({
      operation: "add_audio",
      options: {
        videoPath: input,
        audioPath: withAudio,
      },
    });
  }

  return editPipeline({ steps, finalOutput: output });
}

/**
 * create a montage from multiple video clips
 * optionally trim clips and resize to consistent resolution
 */
export async function createMontage(
  options: CreateMontageOptions,
): Promise<string> {
  const { clips, output, maxClipDuration, targetResolution } = options;

  if (!clips || clips.length === 0) {
    throw new Error("at least one clip is required");
  }
  if (!output) {
    throw new Error("output is required");
  }

  console.log(`[edit] creating montage from ${clips.length} clips...`);

  // validate all clips exist
  for (const clip of clips) {
    if (!existsSync(clip)) {
      throw new Error(`clip not found: ${clip}`);
    }
  }

  let processedClips = clips;

  // trim clips if max duration specified
  if (maxClipDuration) {
    console.log(`[edit] trimming clips to ${maxClipDuration}s...`);
    processedClips = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      if (!clip) {
        throw new Error(`clip ${i} is undefined`);
      }
      const trimmedPath = `/tmp/montage-clip-${i}${extname(clip)}`;
      await trimVideo({
        input: clip,
        output: trimmedPath,
        start: 0,
        duration: maxClipDuration,
      });
      processedClips.push(trimmedPath);
    }
  }

  // resize clips if target resolution specified
  if (targetResolution) {
    console.log(
      `[edit] resizing clips to ${targetResolution.width}x${targetResolution.height}...`,
    );
    const resizedClips = [];

    for (let i = 0; i < processedClips.length; i++) {
      const clip = processedClips[i];
      if (!clip) {
        throw new Error(`clip ${i} is undefined`);
      }
      const resizedPath = `/tmp/montage-resized-${i}${extname(clip)}`;
      await resizeVideo({
        input: clip,
        output: resizedPath,
        width: targetResolution.width,
        height: targetResolution.height,
      });
      resizedClips.push(resizedPath);
    }

    processedClips = resizedClips;
  }

  // concatenate all clips
  return concatVideos({
    inputs: processedClips,
    output,
  });
}

/**
 * quick trim: trim video to specific segment
 */
export async function quickTrim(
  input: string,
  output: string,
  start: number,
  end?: number,
): Promise<string> {
  if (!input || !output) {
    throw new Error("input and output are required");
  }

  const duration = end ? end - start : undefined;

  console.log(
    `[edit] trimming video from ${start}s${duration ? ` for ${duration}s` : ""}...`,
  );

  return trimVideo({ input, output, start, duration });
}

/**
 * quick resize: resize video to common aspect ratios
 */
export async function quickResize(
  input: string,
  output: string,
  preset: "vertical" | "square" | "landscape" | "4k",
): Promise<string> {
  if (!input || !output) {
    throw new Error("input and output are required");
  }

  const presets: Record<
    string,
    { width: number; height: number; label: string }
  > = {
    vertical: { width: 1080, height: 1920, label: "9:16 (1080x1920)" },
    square: { width: 1080, height: 1080, label: "1:1 (1080x1080)" },
    landscape: { width: 1920, height: 1080, label: "16:9 (1920x1080)" },
    "4k": { width: 3840, height: 2160, label: "4K (3840x2160)" },
  };

  const spec = presets[preset];
  if (!spec) {
    throw new Error(`unknown preset: ${preset}`);
  }

  console.log(`[edit] resizing to ${spec.label}...`);

  return resizeVideo({
    input,
    output,
    width: spec.width,
    height: spec.height,
  });
}

/**
 * merge multiple videos with optional audio overlay
 */
export async function mergeWithAudio(
  videos: string[],
  audio: string,
  output: string,
): Promise<string> {
  if (!videos || videos.length === 0) {
    throw new Error("at least one video is required");
  }
  if (!audio || !output) {
    throw new Error("audio and output are required");
  }

  console.log(`[edit] merging ${videos.length} videos with audio...`);

  // first concatenate videos
  const tempVideo = `/tmp/merged-video${extname(output)}`;
  await concatVideos({
    inputs: videos,
    output: tempVideo,
  });

  // then add audio
  return addAudio({
    videoPath: tempVideo,
    audioPath: audio,
    output,
  });
}

// cli
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run service/edit.ts <command> [args]

commands:
  social <input> <output> <platform> [audioPath]   prepare for social media
  montage <output> <clip1> <clip2> [clip3...]      create montage from clips
  trim <input> <output> <start> [end]              quick trim
  resize <input> <output> <preset>                 quick resize
  merge_audio <audio> <output> <video1> [video2...]  merge videos with audio

platforms:
  tiktok, instagram, youtube-shorts, youtube, twitter

resize presets:
  vertical (9:16), square (1:1), landscape (16:9), 4k

examples:
  bun run service/edit.ts social raw.mp4 tiktok.mp4 tiktok
  bun run service/edit.ts social raw.mp4 ig.mp4 instagram audio.mp3
  bun run service/edit.ts montage output.mp4 clip1.mp4 clip2.mp4 clip3.mp4
  bun run service/edit.ts trim long.mp4 short.mp4 10 30
  bun run service/edit.ts resize raw.mp4 vertical.mp4 vertical
  bun run service/edit.ts merge_audio song.mp3 final.mp4 clip1.mp4 clip2.mp4
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "social": {
        const input = args[1];
        const output = args[2];
        const platform = args[3] as PrepareForSocialOptions["platform"];
        const withAudio = args[4];

        if (!input || !output || !platform) {
          throw new Error("input, output, and platform are required");
        }

        await prepareForSocial({ input, output, platform, withAudio });
        break;
      }

      case "montage": {
        const output = args[1];
        const clips = args.slice(2);

        if (!output || clips.length === 0) {
          throw new Error("output and at least one clip are required");
        }

        await createMontage({ clips, output });
        break;
      }

      case "trim": {
        const input = args[1];
        const output = args[2];
        const startArg = args[3];
        const endArg = args[4];

        if (!input || !output || !startArg) {
          throw new Error("input, output, and start are required");
        }

        const start = Number.parseFloat(startArg);
        const end = endArg ? Number.parseFloat(endArg) : undefined;

        if (Number.isNaN(start) || (endArg && Number.isNaN(end))) {
          throw new Error("start and end must be valid numbers");
        }

        await quickTrim(input, output, start, end);
        break;
      }

      case "resize": {
        const input = args[1];
        const output = args[2];
        const preset = args[3] as "vertical" | "square" | "landscape" | "4k";

        if (!input || !output || !preset) {
          throw new Error("input, output, and preset are required");
        }

        await quickResize(input, output, preset);
        break;
      }

      case "merge_audio": {
        const audio = args[1];
        const output = args[2];
        const videos = args.slice(3);

        if (!audio || !output || videos.length === 0) {
          throw new Error("audio, output, and at least one video are required");
        }

        await mergeWithAudio(videos, audio, output);
        break;
      }

      default:
        console.error(`unknown command: ${command}`);
        console.log("run 'bun run service/edit.ts help' for usage");
        process.exit(1);
    }
  } catch (error) {
    console.error("[edit] error:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
