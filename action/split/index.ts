#!/usr/bin/env bun

/**
 * split action
 * divide video into N equal-length parts
 */

import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { ActionMeta } from "../../cli/types";
import { getVideoDuration, trimVideo } from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "split",
  type: "action",
  description: "divide video into N equal-length parts",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "parts"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        parts: {
          type: "integer",
          description: "number of equal parts to split into",
        },
        "output-prefix": {
          type: "string",
          description: "prefix for output files (default: input filename)",
        },
      },
    },
    output: {
      type: "string",
      format: "file-path",
      description: "comma-separated list of output paths",
    },
  },
  async run(options) {
    const {
      video,
      parts,
      "output-prefix": outputPrefix,
    } = options as {
      video: string;
      parts: number;
      "output-prefix"?: string;
    };
    return split({ video, parts, outputPrefix });
  },
};

export interface SplitOptions {
  video: string;
  parts: number;
  outputPrefix?: string;
}

export interface SplitResult {
  outputs: string[];
  count: number;
  partDuration: number;
}

/**
 * divide video into N equal parts
 */
export async function split(options: SplitOptions): Promise<SplitResult> {
  const { video, parts, outputPrefix } = options;

  if (!video) {
    throw new Error("video is required");
  }
  if (!parts || parts < 2) {
    throw new Error("parts must be at least 2");
  }
  if (!existsSync(video)) {
    throw new Error(`video file not found: ${video}`);
  }

  // Get video duration
  const videoDuration = await getVideoDuration(video);
  const partDuration = videoDuration / parts;

  // Generate output prefix if not provided
  const prefix =
    outputPrefix || join(dirname(video), basename(video, extname(video)));

  console.log(
    `[split] dividing ${videoDuration}s video into ${parts} parts of ${partDuration.toFixed(2)}s each`,
  );

  const outputs: string[] = [];

  for (let i = 0; i < parts; i++) {
    const start = i * partDuration;
    const partNumber = String(i + 1).padStart(3, "0");
    const outputPath = `${prefix}_part${partNumber}.mp4`;

    console.log(
      `[split] creating part ${i + 1}/${parts}: ${start.toFixed(2)}s - ${(start + partDuration).toFixed(2)}s`,
    );

    await trimVideo({
      input: video,
      output: outputPath,
      start,
      duration: partDuration,
    });

    outputs.push(outputPath);
  }

  console.log(`[split] created ${outputs.length} parts`);

  return {
    outputs,
    count: outputs.length,
    partDuration,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
