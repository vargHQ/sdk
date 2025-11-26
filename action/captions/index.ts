#!/usr/bin/env bun

/**
 * video captioning service
 * generates and overlays subtitles on videos using ffmpeg
 * supports auto-generation via groq/fireworks or custom srt files
 */

import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import type { ActionMeta } from "../../cli/types";
import { transcribe } from "../transcribe";

export const meta: ActionMeta = {
  name: "captions",
  type: "action",
  description: "add subtitles to video",
  inputType: "video",
  outputType: "video",
  schema: {
    input: {
      type: "object",
      required: ["video", "output"],
      properties: {
        video: {
          type: "string",
          format: "file-path",
          description: "input video file",
        },
        output: {
          type: "string",
          format: "file-path",
          description: "output video path",
        },
        srt: {
          type: "string",
          format: "file-path",
          description: "existing srt file (auto-generates if not provided)",
        },
        provider: {
          type: "string",
          enum: ["groq", "fireworks"],
          default: "fireworks",
          description: "transcription provider for auto-generation",
        },
      },
    },
    output: { type: "string", format: "file-path", description: "video path" },
  },
  async run(options) {
    const { video, output, srt, provider } = options as {
      video: string;
      output: string;
      srt?: string;
      provider?: "groq" | "fireworks";
    };
    return addCaptions({ videoPath: video, output, srtPath: srt, provider });
  },
};

// types
export interface AddCaptionsOptions {
  videoPath: string;
  srtPath?: string; // optional existing srt file
  output: string;
  provider?: "groq" | "fireworks"; // only used if srtPath not provided
  style?: SubtitleStyle;
}

export interface SubtitleStyle {
  fontName?: string; // default: Arial
  fontSize?: number; // default: 24
  primaryColor?: string; // default: &HFFFFFF (white)
  outlineColor?: string; // default: &H000000 (black)
  bold?: boolean; // default: true
  alignment?: number; // 1-9, default: 2 (bottom center)
  marginV?: number; // vertical margin, default: 20
}

// default subtitle style
const DEFAULT_STYLE: Required<SubtitleStyle> = {
  fontName: "Arial",
  fontSize: 24,
  primaryColor: "&HFFFFFF", // white
  outlineColor: "&H000000", // black
  bold: true,
  alignment: 2, // bottom center
  marginV: 20,
};

// main function to add captions to video
export async function addCaptions(
  options: AddCaptionsOptions,
): Promise<string> {
  const { videoPath, srtPath, output, provider = "fireworks", style } = options;

  if (!videoPath) {
    throw new Error("videoPath is required");
  }
  if (!output) {
    throw new Error("output is required");
  }
  if (!existsSync(videoPath)) {
    throw new Error(`video file not found: ${videoPath}`);
  }

  console.log("[captions] adding captions to video...");

  // determine srt file path
  let finalSrtPath = srtPath;

  // if no srt file provided, auto-generate it
  if (!finalSrtPath) {
    console.log(
      `[captions] no srt file provided, auto-generating with ${provider}...`,
    );

    // generate srt file from video audio
    const tempSrtPath = videoPath.replace(/\.[^.]+$/, ".srt");

    const result = await transcribe({
      audioUrl: videoPath,
      provider,
      outputFormat: "srt",
      outputPath: tempSrtPath,
    });

    if (!result.success) {
      throw new Error(`failed to generate subtitles: ${result.error}`);
    }

    finalSrtPath = tempSrtPath;
    console.log(`[captions] generated subtitles at ${finalSrtPath}`);
  }

  if (!existsSync(finalSrtPath)) {
    throw new Error(`srt file not found: ${finalSrtPath}`);
  }

  // merge style with defaults
  const finalStyle = { ...DEFAULT_STYLE, ...style };

  // build subtitle filter with style
  const subtitlesFilter = `subtitles=${finalSrtPath}:force_style='FontName=${finalStyle.fontName},FontSize=${finalStyle.fontSize},PrimaryColour=${finalStyle.primaryColor},OutlineColour=${finalStyle.outlineColor},Bold=${finalStyle.bold ? -1 : 0},Alignment=${finalStyle.alignment},MarginV=${finalStyle.marginV}'`;

  console.log("[captions] overlaying subtitles on video...");

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters(subtitlesFilter)
      .outputOptions(["-c:a", "copy"]) // copy audio without re-encoding
      .output(output)
      .on("end", () => {
        console.log(`[captions] saved to ${output}`);
        resolve(output);
      })
      .on("error", (err) => {
        console.error("[captions] error:", err);
        reject(err);
      })
      .run();
  });
}

// cli
if (import.meta.main) {
  const { runCli } = await import("../../cli/runner");
  runCli(meta);
}
