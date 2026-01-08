/**
 * FFmpeg utilities for varg SDK v2
 * Local video processing - not a hosted AI provider
 */

import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import type { TranscriptionSegment } from "./types";

export interface AddCaptionsOptions {
  video: string;
  segments: TranscriptionSegment[];
  output?: string;
  style?: "default" | "tiktok" | "youtube";
  fontFile?: string;
  fontSize?: number;
  fontColor?: string;
  outlineColor?: string;
  outlineWidth?: number;
}

export interface AddCaptionsResult {
  url: string;
}

export async function addCaptions(
  options: AddCaptionsOptions,
): Promise<AddCaptionsResult> {
  const {
    video,
    segments,
    output,
    style = "default",
    fontFile,
    fontSize = style === "tiktok" ? 48 : 24,
    fontColor = "white",
    outlineColor = "black",
    outlineWidth = style === "tiktok" ? 3 : 1,
  } = options;

  const inputPath = await resolveInput(video);
  const outputPath = output || inputPath.replace(/\.[^.]+$/, "_captioned.mp4");

  const srtPath = outputPath.replace(/\.[^.]+$/, ".srt");
  await writeSRT(srtPath, segments);

  console.log(`[ffmpeg] adding captions to video...`);

  return new Promise((resolve, reject) => {
    const filterOpts = [
      `FontSize=${fontSize}`,
      `PrimaryColour=&H00${hexToABGR(fontColor)}`,
      `OutlineColour=&H00${hexToABGR(outlineColor)}`,
      `Outline=${outlineWidth}`,
      `Alignment=2`,
      `MarginV=40`,
    ];

    if (fontFile) {
      filterOpts.push(`Fontsfile=${fontFile}`);
    }

    ffmpeg(inputPath)
      .outputOptions([
        "-vf",
        `subtitles=${srtPath}:force_style='${filterOpts.join(",")}'`,
        "-c:a",
        "copy",
      ])
      .output(outputPath)
      .on("end", () => {
        console.log(`[ffmpeg] captioned video saved to ${outputPath}`);
        resolve({ url: outputPath });
      })
      .on("error", reject)
      .run();
  });
}

export interface TransformOptions {
  video: string;
  output?: string;
  format?: "tiktok" | "instagram" | "youtube" | "square";
  width?: number;
  height?: number;
  fit?: "crop" | "pad" | "stretch";
}

export interface TransformResult {
  url: string;
}

const FORMAT_SIZES: Record<string, { width: number; height: number }> = {
  tiktok: { width: 1080, height: 1920 },
  instagram: { width: 1080, height: 1350 },
  youtube: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
};

export async function transform(
  options: TransformOptions,
): Promise<TransformResult> {
  const { video, output, format, width, height, fit = "crop" } = options;

  const inputPath = await resolveInput(video);
  const outputPath =
    output || inputPath.replace(/\.[^.]+$/, `_${format || "transformed"}.mp4`);

  const targetSize = format ? FORMAT_SIZES[format] : { width, height };
  if (!targetSize?.width || !targetSize?.height) {
    throw new Error("Must specify format or width/height");
  }

  console.log(
    `[ffmpeg] transforming video to ${targetSize.width}x${targetSize.height}...`,
  );

  return new Promise((resolve, reject) => {
    let vf: string;

    switch (fit) {
      case "stretch":
        vf = `scale=${targetSize.width}:${targetSize.height}`;
        break;
      case "pad":
        vf = `scale=${targetSize.width}:${targetSize.height}:force_original_aspect_ratio=decrease,pad=${targetSize.width}:${targetSize.height}:(ow-iw)/2:(oh-ih)/2`;
        break;
      case "crop":
      default:
        vf = `scale=${targetSize.width}:${targetSize.height}:force_original_aspect_ratio=increase,crop=${targetSize.width}:${targetSize.height}`;
        break;
    }

    ffmpeg(inputPath)
      .outputOptions(["-vf", vf, "-c:a", "copy"])
      .output(outputPath)
      .on("end", () => {
        console.log(`[ffmpeg] transformed video saved to ${outputPath}`);
        resolve({ url: outputPath });
      })
      .on("error", reject)
      .run();
  });
}

export interface TrimOptions {
  video: string;
  output?: string;
  start: number;
  end?: number;
  duration?: number;
}

export interface TrimResult {
  url: string;
}

export async function trim(options: TrimOptions): Promise<TrimResult> {
  const { video, output, start, end, duration } = options;

  const inputPath = await resolveInput(video);
  const outputPath = output || inputPath.replace(/\.[^.]+$/, "_trimmed.mp4");

  console.log(`[ffmpeg] trimming video...`);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath).setStartTime(start);

    if (duration) {
      cmd.setDuration(duration);
    } else if (end) {
      cmd.setDuration(end - start);
    }

    cmd
      .outputOptions(["-c", "copy"])
      .output(outputPath)
      .on("end", () => {
        console.log(`[ffmpeg] trimmed video saved to ${outputPath}`);
        resolve({ url: outputPath });
      })
      .on("error", reject)
      .run();
  });
}

export interface MergeOptions {
  videos: string[];
  output?: string;
}

export interface MergeResult {
  url: string;
}

export async function merge(options: MergeOptions): Promise<MergeResult> {
  const { videos, output } = options;

  if (videos.length < 2) {
    throw new Error("Need at least 2 videos to merge");
  }

  const inputPaths = await Promise.all(videos.map(resolveInput));
  const outputPath = output || `merged_${Date.now()}.mp4`;

  console.log(`[ffmpeg] merging ${videos.length} videos...`);

  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();

    for (const input of inputPaths) {
      cmd.input(input);
    }

    const filterComplex =
      inputPaths.map((_, i) => `[${i}:v][${i}:a]`).join("") +
      `concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`;

    cmd
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[outv]", "-map", "[outa]"])
      .output(outputPath)
      .on("end", () => {
        console.log(`[ffmpeg] merged video saved to ${outputPath}`);
        resolve({ url: outputPath });
      })
      .on("error", reject)
      .run();
  });
}

async function resolveInput(input: string): Promise<string> {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    const tempPath = `/tmp/varg_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
    console.log(`[ffmpeg] downloading ${input}...`);
    const response = await fetch(input);
    const buffer = await response.arrayBuffer();
    await Bun.write(tempPath, buffer);
    return tempPath;
  }

  if (!existsSync(input)) {
    throw new Error(`File not found: ${input}`);
  }

  return input;
}

async function writeSRT(
  path: string,
  segments: TranscriptionSegment[],
): Promise<void> {
  const lines: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    lines.push(String(i + 1));
    lines.push(`${formatSRTTime(seg.start)} --> ${formatSRTTime(seg.end)}`);
    lines.push(seg.text.trim());
    lines.push("");
  }

  await Bun.write(path, lines.join("\n"));
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);

  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function hexToABGR(hex: string): string {
  if (hex === "white") return "FFFFFF";
  if (hex === "black") return "000000";
  if (hex === "yellow") return "00FFFF";
  if (hex === "red") return "0000FF";

  const clean = hex.replace("#", "");
  if (clean.length === 6) {
    const r = clean.slice(0, 2);
    const g = clean.slice(2, 4);
    const b = clean.slice(4, 6);
    return `${b}${g}${r}`;
  }
  return clean;
}
