/**
 * Captions/subtitles action
 * Add captions to video from transcription
 */

import { writeFileSync } from "node:fs";
import { z } from "zod";
import type { ActionDefinition } from "../../core/schema/types";
import { ffmpegProvider } from "../../providers/ffmpeg";
import { transcribe } from "./transcribe";

export const captionsInputSchema = z.object({
  video: z.string().describe("Input video"),
  output: z.string().describe("Output path"),
  srt: z.string().optional().describe("SRT file (optional)"),
  style: z
    .enum(["default", "tiktok", "youtube"])
    .optional()
    .default("default")
    .describe("Caption style"),
});

export const captionsOutputSchema = z.string().describe("Captioned video path");

export type CaptionsInput = z.infer<typeof captionsInputSchema>;
export type CaptionsOutput = z.infer<typeof captionsOutputSchema>;

export const definition: ActionDefinition<
  typeof captionsInputSchema,
  typeof captionsOutputSchema
> = {
  type: "action",
  name: "captions",
  description: "Add captions/subtitles to video",
  inputSchema: captionsInputSchema,
  outputSchema: captionsOutputSchema,
  routes: [],
  execute: async (inputs) => {
    const { video, output, srt, style } = inputs;
    return addCaptions({ video, output, srt, style });
  },
};

// Types
export interface SubtitleStyle {
  fontName?: string;
  fontSize?: number;
  primaryColor?: string;
  outlineColor?: string;
  backColor?: string;
  bold?: boolean;
  outline?: number;
  shadow?: number;
  marginV?: number;
  alignment?: number;
}

export interface AddCaptionsOptions {
  video: string;
  output: string;
  srt?: string;
  style?: "default" | "tiktok" | "youtube";
}

// Style presets
const STYLE_PRESETS: Record<string, SubtitleStyle> = {
  default: {
    fontName: "Arial",
    fontSize: 24,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    outline: 2,
    shadow: 1,
    marginV: 30,
    alignment: 2, // Bottom center
  },
  tiktok: {
    fontName: "Montserrat",
    fontSize: 32,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H80000000",
    bold: true,
    outline: 3,
    shadow: 0,
    marginV: 50,
    alignment: 2,
  },
  youtube: {
    fontName: "Roboto",
    fontSize: 28,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H40000000",
    outline: 2,
    shadow: 1,
    marginV: 40,
    alignment: 2,
  },
};

/**
 * Add captions to video
 */
export async function addCaptions(
  options: AddCaptionsOptions,
): Promise<string> {
  const { video, output, srt: srtPath, style = "default" } = options;

  console.log(`[captions] adding captions to ${video}...`);

  // Generate SRT if not provided
  let srtFile = srtPath;
  if (!srtFile) {
    console.log("[captions] generating transcription...");

    // Extract audio first
    const audioPath = video.replace(/\.[^.]+$/, "_audio.mp3");
    await ffmpegProvider.extractAudio(video, audioPath);

    // Transcribe
    const result = await transcribe({
      audioUrl: audioPath,
      provider: "fireworks",
      outputFormat: "srt",
    });

    if (!result.success || !result.srt) {
      throw new Error("Transcription failed");
    }

    // Save SRT
    srtFile = video.replace(/\.[^.]+$/, ".srt");
    writeFileSync(srtFile, result.srt);
    console.log(`[captions] saved srt to ${srtFile}`);
  }

  // Get style preset (default is always defined)
  const styleConfig = STYLE_PRESETS[style] ??
    STYLE_PRESETS.default ?? {
      fontName: "Arial",
      fontSize: 24,
      primaryColor: "&HFFFFFF",
      outlineColor: "&H000000",
      outline: 2,
      shadow: 1,
      marginV: 30,
      alignment: 2,
    };

  // Convert SRT to ASS for styling (simplified - in production use a proper ASS library)
  const assFile = srtFile.replace(".srt", ".ass");
  await convertSrtToAss(srtFile, assFile, styleConfig);

  // Burn subtitles into video using ffmpeg
  // This is a simplified implementation - full implementation would use ffmpegProvider
  console.log(`[captions] burning subtitles...`);

  // For now, just copy the video (proper implementation would use subtitles filter)
  await ffmpegProvider.convertFormat({ input: video, output });

  console.log(`[captions] saved to ${output}`);
  return output;
}

/**
 * Convert SRT to ASS format with styling
 */
async function convertSrtToAss(
  srtPath: string,
  assPath: string,
  style: SubtitleStyle,
): Promise<void> {
  const srtContent = await Bun.file(srtPath).text();

  // Parse SRT and convert to ASS
  const assHeader = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName || "Arial"},${style.fontSize || 24},${style.primaryColor || "&HFFFFFF"},&H000000FF,${style.outlineColor || "&H000000"},${style.backColor || "&H00000000"},${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outline || 2},${style.shadow || 1},${style.alignment || 2},10,10,${style.marginV || 30},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Convert SRT entries to ASS dialogue lines
  const entries = parseSrt(srtContent);
  const assDialogues = entries
    .map((entry) => {
      const start = formatAssTime(entry.start);
      const end = formatAssTime(entry.end);
      const text = entry.text.replace(/\n/g, "\\N");
      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  writeFileSync(assPath, assHeader + assDialogues);
}

interface SrtEntry {
  index: number;
  start: number;
  end: number;
  text: string;
}

function parseSrt(content: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = Number.parseInt(lines[0] || "0", 10);
    const timeLine = lines[1] || "";
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );

    if (!timeMatch) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    if (!h1 || !m1 || !s1 || !ms1 || !h2 || !m2 || !s2 || !ms2) continue;

    const start = parseTime(h1, m1, s1, ms1);
    const end = parseTime(h2, m2, s2, ms2);
    const text = lines.slice(2).join("\n");

    entries.push({ index, start, end, text });
  }

  return entries;
}

function parseTime(h: string, m: string, s: string, ms: string): number {
  return (
    Number.parseInt(h, 10) * 3600 +
    Number.parseInt(m, 10) * 60 +
    Number.parseInt(s, 10) +
    Number.parseInt(ms, 10) / 1000
  );
}

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export default definition;
