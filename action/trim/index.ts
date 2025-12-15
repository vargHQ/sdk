#!/usr/bin/env bun

/**
 * trim action
 * extract a segment from video (keep only start-end)
 */

import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { ActionMeta } from "../../cli/types";
import { trimVideo } from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "trim",
  type: "action",
  description: "extract a segment from video (keep only start-end)",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "start", "end"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        start: {
          type: "number",
          description: "start time in seconds",
        },
        end: {
          type: "number",
          description: "end time in seconds",
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
    const { video, start, end, output } = options as {
      video: string;
      start: number;
      end: number;
      output?: string;
    };
    return trim({ video, start, end, output });
  },
};

export interface TrimOptions {
  video: string;
  start: number;
  end: number;
  output?: string;
}

export interface TrimResult {
  output: string;
  duration: number;
}

/**
 * extract a segment from video
 */
export async function trim(options: TrimOptions): Promise<TrimResult> {
  const { video, start, end, output } = options;

  if (!video) {
    throw new Error("video is required");
  }
  if (start === undefined || end === undefined) {
    throw new Error("start and end are required");
  }
  if (start >= end) {
    throw new Error("start must be less than end");
  }
  if (!existsSync(video)) {
    throw new Error(`video file not found: ${video}`);
  }

  const duration = end - start;

  // Generate output path if not provided
  const outputPath =
    output ||
    join(
      dirname(video),
      `${basename(video, extname(video))}_trimmed${extname(video)}`,
    );

  console.log(`[trim] extracting ${start}s - ${end}s (${duration}s)...`);

  await trimVideo({
    input: video,
    output: outputPath,
    start,
    duration,
  });

  return {
    output: outputPath,
    duration,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
