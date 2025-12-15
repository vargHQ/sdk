#!/usr/bin/env bun

/**
 * transition action
 * join two videos with a transition effect
 */

import { existsSync } from "node:fs";
import type { ActionMeta } from "../../cli/types";
import { xfadeVideos } from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "transition",
  type: "action",
  description: "join two videos with a transition effect",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video1", "video2", "type", "output"],
      properties: {
        video1: {
          type: "string",
          format: "file-path",
          description: "first video file",
        },
        video2: {
          type: "string",
          format: "file-path",
          description: "second video file",
        },
        type: {
          type: "string",
          enum: [
            "crossfade",
            "dissolve",
            "wipeleft",
            "wiperight",
            "slideup",
            "slidedown",
          ],
          description: "transition effect type",
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
        output: {
          type: "string",
          format: "file-path",
          description: "output video path",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { video1, video2, type, duration, fit, output } = options as {
      video1: string;
      video2: string;
      type:
        | "crossfade"
        | "dissolve"
        | "wipeleft"
        | "wiperight"
        | "slideup"
        | "slidedown";
      duration?: number;
      fit?: "pad" | "crop" | "blur" | "stretch";
      output: string;
    };
    return transition({ video1, video2, type, duration, fit, output });
  },
};

export interface TransitionOptions {
  video1: string;
  video2: string;
  type:
    | "crossfade"
    | "dissolve"
    | "wipeleft"
    | "wiperight"
    | "slideup"
    | "slidedown";
  duration?: number;
  fit?: "pad" | "crop" | "blur" | "stretch";
  output: string;
}

export interface TransitionResult {
  output: string;
  transitionType: string;
  transitionDuration: number;
}

/**
 * join two videos with a transition effect
 */
export async function transition(
  options: TransitionOptions,
): Promise<TransitionResult> {
  const { video1, video2, type, duration = 1, fit = "pad", output } = options;

  if (!video1 || !video2) {
    throw new Error("video1 and video2 are required");
  }
  if (!type) {
    throw new Error("type is required");
  }
  if (!output) {
    throw new Error("output is required");
  }
  if (!existsSync(video1)) {
    throw new Error(`video file not found: ${video1}`);
  }
  if (!existsSync(video2)) {
    throw new Error(`video file not found: ${video2}`);
  }

  console.log(
    `[transition] applying ${type} effect (${duration}s, fit: ${fit})`,
  );

  await xfadeVideos({
    input1: video1,
    input2: video2,
    output,
    transition: type,
    duration,
    fit,
  });

  return {
    output,
    transitionType: type,
    transitionDuration: duration,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
