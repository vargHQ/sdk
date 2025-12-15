#!/usr/bin/env bun

/**
 * remove action
 * delete a segment from the middle of a video
 */

import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import type { ActionMeta } from "../../cli/types";
import {
  concatWithFileList,
  getVideoDuration,
  trimVideo,
} from "../../lib/ffmpeg";

export const meta: ActionMeta = {
  name: "remove",
  type: "action",
  description: "delete a segment from the middle of a video",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "from", "to"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        from: {
          type: "number",
          description: "start of segment to remove (seconds)",
        },
        to: {
          type: "number",
          description: "end of segment to remove (seconds)",
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
    const { video, from, to, output } = options as {
      video: string;
      from: number;
      to: number;
      output?: string;
    };
    return remove({ video, from, to, output });
  },
};

export interface RemoveOptions {
  video: string;
  from: number;
  to: number;
  output?: string;
}

export interface RemoveResult {
  output: string;
  removedDuration: number;
}

/**
 * remove a segment from video
 */
export async function remove(options: RemoveOptions): Promise<RemoveResult> {
  const { video, from, to, output } = options;

  if (!video) {
    throw new Error("video is required");
  }
  if (from === undefined || to === undefined) {
    throw new Error("from and to are required");
  }
  if (from >= to) {
    throw new Error("from must be less than to");
  }
  if (!existsSync(video)) {
    throw new Error(`video file not found: ${video}`);
  }

  const videoDuration = await getVideoDuration(video);

  if (from < 0 || to > videoDuration) {
    throw new Error(
      `segment ${from}s-${to}s is outside video duration (0-${videoDuration}s)`,
    );
  }

  const removedDuration = to - from;

  // Generate output path if not provided
  const outputPath =
    output ||
    join(
      dirname(video),
      `${basename(video, extname(video))}_edited${extname(video)}`,
    );

  console.log(
    `[remove] removing segment ${from}s - ${to}s (${removedDuration}s)`,
  );

  // Create temp files for the two parts
  const timestamp = Date.now();
  const part1Path = join(tmpdir(), `remove-part1-${timestamp}.mp4`);
  const part2Path = join(tmpdir(), `remove-part2-${timestamp}.mp4`);

  const tempFiles: string[] = [];

  try {
    // Extract part before the removed segment (0 to from)
    if (from > 0) {
      console.log(`[remove] extracting part 1: 0s - ${from}s`);
      await trimVideo({
        input: video,
        output: part1Path,
        start: 0,
        duration: from,
      });
      tempFiles.push(part1Path);
    }

    // Extract part after the removed segment (to to end)
    if (to < videoDuration) {
      console.log(`[remove] extracting part 2: ${to}s - ${videoDuration}s`);
      await trimVideo({
        input: video,
        output: part2Path,
        start: to,
        duration: videoDuration - to,
      });
      tempFiles.push(part2Path);
    }

    // Concatenate the two parts
    if (tempFiles.length === 0) {
      throw new Error("cannot remove entire video");
    }

    if (tempFiles.length === 1) {
      // Only one part, just copy/rename it
      const { copyFileSync } = await import("node:fs");
      copyFileSync(tempFiles[0] as string, outputPath);
    } else {
      // Concatenate both parts
      console.log(`[remove] joining parts...`);
      await concatWithFileList(tempFiles, outputPath);
    }

    console.log(`[remove] saved to ${outputPath}`);
  } finally {
    // Cleanup temp files
    for (const tempFile of tempFiles) {
      try {
        unlinkSync(tempFile);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  return {
    output: outputPath,
    removedDuration,
  };
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
