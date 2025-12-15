#!/usr/bin/env bun

/**
 * cut action
 * split video at specific timestamps into separate clips
 */

import { existsSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { ActionMeta } from "../../cli/types";
import { splitAtTimestamps } from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "cut",
  type: "action",
  description: "split video at specific timestamps into separate clips",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "timestamps"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        timestamps: {
          type: "string",
          description:
            "comma-separated cut points in seconds (e.g., '10,30,60')",
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
      timestamps,
      "output-prefix": outputPrefix,
    } = options as {
      video: string;
      timestamps: string;
      "output-prefix"?: string;
    };
    return cut({ video, timestamps, outputPrefix });
  },
};

export interface CutOptions {
  video: string;
  timestamps: string;
  outputPrefix?: string;
}

export interface CutResult {
  outputs: string[];
  count: number;
}

/**
 * split video at timestamps into separate clips
 */
export async function cut(options: CutOptions): Promise<CutResult> {
  const { video, timestamps, outputPrefix } = options;

  if (!video) {
    throw new Error("video is required");
  }
  if (!timestamps) {
    throw new Error("timestamps are required");
  }
  if (!existsSync(video)) {
    throw new Error(`video file not found: ${video}`);
  }

  // Parse timestamps from comma-separated string
  const timestampValues = timestamps
    .split(",")
    .map((t) => Number.parseFloat(t.trim()))
    .filter((t) => !Number.isNaN(t));

  if (timestampValues.length === 0) {
    throw new Error("at least one valid timestamp is required");
  }

  // Generate output prefix if not provided
  const prefix =
    outputPrefix || join(dirname(video), basename(video, extname(video)));

  console.log(`[cut] splitting at timestamps: ${timestampValues.join(", ")}s`);

  const outputs = await splitAtTimestamps({
    input: video,
    timestamps: timestampValues,
    outputPrefix: prefix,
  });

  return {
    outputs,
    count: outputs.length,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
