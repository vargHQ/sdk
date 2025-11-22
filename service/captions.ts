#!/usr/bin/env bun

/**
 * video captioning service
 * generates and overlays subtitles on videos using ffmpeg
 * supports auto-generation via groq/fireworks or custom srt files
 */

import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import { transcribe } from "./transcribe";

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
async function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help") {
    console.log(`
usage:
  bun run service/captions.ts <videoPath> [outputPath] [options]

arguments:
  videoPath      - path to input video file
  outputPath     - path to output video (default: video-captioned.mp4)

options:
  --srt <path>       - use existing srt file instead of auto-generating
  --provider <name>  - groq | fireworks (default: fireworks)
  --font <name>      - font name (default: Arial)
  --size <number>    - font size (default: 24)
  --color <hex>      - primary color in ASS format (default: &HFFFFFF)
  --outline <hex>    - outline color in ASS format (default: &H000000)

examples:
  # auto-generate captions with fireworks
  bun run service/captions.ts media/fitness-demo.mp4

  # auto-generate with groq (faster, plain text)
  bun run service/captions.ts media/fitness-demo.mp4 output.mp4 --provider groq

  # use existing srt file
  bun run service/captions.ts media/fitness-demo.mp4 output.mp4 --srt media/fitness-demo.srt

  # customize style
  bun run service/captions.ts media/video.mp4 output.mp4 --font "Helvetica" --size 28

requirements:
  ffmpeg must be installed on your system
  brew install ffmpeg (macos)
  apt-get install ffmpeg (linux)
    `);
    process.exit(0);
  }

  try {
    const videoPath = args[0];
    let outputPath = args[1];

    if (!videoPath) {
      throw new Error("videoPath is required");
    }

    // parse options
    let srtPath: string | undefined;
    let provider: "groq" | "fireworks" = "fireworks";
    const style: SubtitleStyle = {};

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg === "--srt") {
        srtPath = args[++i];
      } else if (arg === "--provider") {
        provider = args[++i] as "groq" | "fireworks";
      } else if (arg === "--font") {
        style.fontName = args[++i];
      } else if (arg === "--size") {
        const size = args[++i];
        if (!size) {
          throw new Error("--size requires a number");
        }
        style.fontSize = Number.parseInt(size, 10);
      } else if (arg === "--color") {
        const color = args[++i];
        if (!color) {
          throw new Error("--color requires a hex color");
        }
        style.primaryColor = color;
      } else if (arg === "--outline") {
        const outline = args[++i];
        if (!outline) {
          throw new Error("--outline requires a hex color");
        }
        style.outlineColor = outline;
      } else if (!arg?.startsWith("--") && !outputPath) {
        outputPath = arg;
      }
    }

    // default output path
    if (!outputPath) {
      outputPath = videoPath.replace(/\.[^.]+$/, "-captioned.mp4");
    }

    await addCaptions({
      videoPath,
      srtPath,
      output: outputPath,
      provider,
      style,
    });

    console.log("\ndone! video with captions saved to:", outputPath);
  } catch (error) {
    console.error("[captions] error:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  cli();
}
