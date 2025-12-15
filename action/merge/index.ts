#!/usr/bin/env bun

/**
 * merge action
 * join multiple videos into one, optionally with transitions
 */

import { existsSync } from "node:fs";
import type { ActionMeta } from "../../cli/types";
import { concatWithFileList, xfadeVideos } from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "merge",
  type: "action",
  description: "join multiple videos into one with optional transitions",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["videos", "output"],
      properties: {
        videos: {
          type: "string",
          description: "comma-separated video paths to merge",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output video path",
        },
        transition: {
          type: "string",
          enum: ["cut", "crossfade", "dissolve"],
          default: "cut",
          description: "transition type between clips",
        },
        duration: {
          type: "number",
          default: 1,
          description: "transition duration in seconds",
        },
        fit: {
          type: "string",
          enum: ["pad", "crop", "blur", "stretch"],
          default: "pad",
          description:
            "how to handle different resolutions: pad (black bars), crop (center), blur (TikTok style), stretch",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { videos, output, transition, duration, fit } = options as {
      videos: string;
      output: string;
      transition?: "cut" | "crossfade" | "dissolve";
      duration?: number;
      fit?: "pad" | "crop" | "blur" | "stretch";
    };
    return merge({ videos, output, transition, duration, fit });
  },
};

export interface MergeOptions {
  videos: string;
  output: string;
  transition?: "cut" | "crossfade" | "dissolve";
  duration?: number;
  fit?: "pad" | "crop" | "blur" | "stretch";
}

export interface MergeResult {
  output: string;
  inputCount: number;
}

/**
 * merge multiple videos with optional transitions
 */
export async function merge(options: MergeOptions): Promise<MergeResult> {
  const {
    videos,
    output,
    transition = "cut",
    duration = 1,
    fit = "pad",
  } = options;

  if (!videos) {
    throw new Error("videos are required");
  }
  if (!output) {
    throw new Error("output is required");
  }

  // Parse video paths from comma-separated string
  const videoPaths = videos.split(",").map((v) => v.trim());

  if (videoPaths.length < 2) {
    throw new Error("at least 2 videos are required");
  }

  // Validate all inputs exist
  for (const video of videoPaths) {
    if (!existsSync(video)) {
      throw new Error(`video file not found: ${video}`);
    }
  }

  console.log(
    `[merge] joining ${videoPaths.length} videos with ${transition} transition`,
  );

  if (transition === "cut") {
    // Simple concatenation without transitions
    await concatWithFileList(videoPaths, output);
  } else {
    // Apply transitions between each pair of videos
    const firstVideo = videoPaths[0] as string;
    const secondVideo = videoPaths[1] as string;

    if (videoPaths.length === 2) {
      // Simple case: just two videos
      await xfadeVideos({
        input1: firstVideo,
        input2: secondVideo,
        output,
        transition: transition as "crossfade" | "dissolve",
        duration,
        fit,
      });
    } else {
      // Multiple videos: chain transitions
      let currentInput: string = firstVideo;

      for (let i = 1; i < videoPaths.length; i++) {
        const nextVideo = videoPaths[i] as string;
        const isLast = i === videoPaths.length - 1;
        const tempOutput = isLast ? output : `/tmp/merge-temp-${i}.mp4`;

        await xfadeVideos({
          input1: currentInput,
          input2: nextVideo,
          output: tempOutput,
          transition: transition as "crossfade" | "dissolve",
          duration,
          fit,
        });

        // Clean up previous temp file if not the original input
        if (i > 1 && currentInput.startsWith("/tmp/merge-temp-")) {
          try {
            const { unlinkSync } = await import("node:fs");
            unlinkSync(currentInput);
          } catch {
            // ignore cleanup errors
          }
        }

        currentInput = tempOutput;
      }
    }
  }

  return {
    output,
    inputCount: videoPaths.length,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
