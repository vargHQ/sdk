#!/usr/bin/env bun

/**
 * fade action
 * add fade in, fade out, or both to a video
 */

import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { ActionMeta } from "../../cli/types";
import { fadeVideo } from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "fade",
  type: "action",
  description: "add fade in, fade out, or both to a video",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "type"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        type: {
          type: "string",
          enum: ["in", "out", "both"],
          description: "fade direction: in, out, or both",
        },
        duration: {
          type: "number",
          default: 1,
          description: "fade duration in seconds",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output video path (auto-generated if not provided)",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { video, type, duration, output } = options as {
      video: string;
      type: "in" | "out" | "both";
      duration?: number;
      output?: string;
    };
    return fade({ video, type, duration, output });
  },
};

export interface FadeOptions {
  video: string;
  type: "in" | "out" | "both";
  duration?: number;
  output?: string;
}

export interface FadeResult {
  output: string;
  fadeType: string;
  fadeDuration: number;
}

/**
 * add fade effects to video
 */
export async function fade(options: FadeOptions): Promise<FadeResult> {
  const { video, type, duration = 1, output } = options;

  if (!video) {
    throw new Error("video is required");
  }
  if (!type) {
    throw new Error("type is required");
  }
  if (!existsSync(video)) {
    throw new Error(`video file not found: ${video}`);
  }

  // Generate output path if not provided
  const outputPath =
    output ||
    join(
      dirname(video),
      `${basename(video, extname(video))}_faded${extname(video)}`,
    );

  console.log(`[fade] applying fade ${type} (${duration}s)`);

  await fadeVideo({
    input: video,
    output: outputPath,
    type,
    duration,
  });

  return {
    output: outputPath,
    fadeType: type,
    fadeDuration: duration,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
