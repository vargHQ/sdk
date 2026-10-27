import { readFileSync, writeFileSync } from "node:fs";
import type { CaptionWindow } from "./flatten";
import { uniqueTempPath } from "./utils";

export interface AssSegment {
  assPath: string;
  /** Timeline position of the clip these captions belong to. */
  timeOffset: number;
  styleSuffix?: string;
  /**
   * Trim window of the source clip, when it was trimmed with cutFrom/cutTo.
   * Cue timestamps in the ASS reference the RAW (untrimmed) media, so:
   * - effective shift = timeOffset - cutFrom (not just timeOffset)
   * - cues entirely outside [cutFrom, cutTo] are dropped
   * - cues partially outside are clamped to the window
   */
  window?: CaptionWindow;
}

/**
 * Transform one cue's [start, end] (raw-media seconds) into timeline
 * seconds for a clip at `timeOffset` with an optional trim window.
 * Returns null when the cue should be dropped (entirely outside the window).
 */
export function transformCue(
  start: number,
  end: number,
  timeOffset: number,
  window?: CaptionWindow,
): { start: number; end: number } | null {
  if (!window) {
    return { start: start + timeOffset, end: end + timeOffset };
  }

  const cutFrom = window.cutFrom;
  // Upper bound in raw-media time: explicit cutTo, else cutFrom + duration.
  const cutTo =
    window.cutTo ??
    (window.duration !== undefined ? cutFrom + window.duration : undefined);

  // Drop cues entirely outside the window.
  if (end <= cutFrom) return null;
  if (cutTo !== undefined && start >= cutTo) return null;

  // Clamp partially-outside cues to the window, then re-base to timeline.
  const clampedStart = Math.max(start, cutFrom);
  const clampedEnd = cutTo !== undefined ? Math.min(end, cutTo) : end;
  if (clampedEnd <= clampedStart) return null;

  const shift = timeOffset - cutFrom;
  return { start: clampedStart + shift, end: clampedEnd + shift };
}

/**
 * Parse ASS timestamp `H:MM:SS.CC` to seconds.
 */
function parseAssTime(ts: string): number {
  const match = ts.match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!match) return 0;
  const [, h, m, s, cs] = match;
  return (
    Number.parseInt(h!, 10) * 3600 +
    Number.parseInt(m!, 10) * 60 +
    Number.parseInt(s!, 10) +
    Number.parseInt(cs!, 10) / 100
  );
}

/**
 * Format seconds to ASS timestamp `H:MM:SS.CC`.
 * Computes from total centiseconds to avoid overflow when rounding
 * lands on 100 cs (e.g. 1.999s would otherwise produce `0:00:01.100`).
 */
function formatAssTime(seconds: number): string {
  const totalCs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Shift all Dialogue timestamps in an ASS file by `offset` seconds,
 * optionally re-basing/clamping to a clip trim window (see transformCue).
 * Cues dropped by the window are removed entirely.
 * Returns path to a new temp file.
 */
export function shiftAssTimestamps(
  assPath: string,
  offset: number,
  window?: CaptionWindow,
): string {
  const content = readFileSync(assPath, "utf-8");
  const DROP = "\u0000DROP\u0000";
  const shifted = content
    .replace(
      /^(Dialogue:\s*\d+,)(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2})/gm,
      (_match, prefix: string, startTs: string, endTs: string) => {
        const cue = transformCue(
          parseAssTime(startTs),
          parseAssTime(endTs),
          offset,
          window,
        );
        if (!cue) return DROP;
        return `${prefix}${formatAssTime(cue.start)},${formatAssTime(cue.end)}`;
      },
    )
    .split("\n")
    .filter((line) => !line.startsWith(DROP))
    .join("\n");
  const outPath = uniqueTempPath("varg-shifted-captions", "ass");
  writeFileSync(outPath, shifted);
  return outPath;
}

/**
 * Merge multiple ASS files into one, shifting timestamps and renaming styles
 * to avoid collisions between segments.
 *
 * Each segment's `Default` style is renamed to `Default_N` (using styleSuffix)
 * and all its Dialogue lines reference the renamed style.
 */
export function mergeAssFiles(
  segments: AssSegment[],
  width: number,
  height: number,
): string {
  const allStyles: string[] = [];
  const allDialogues: string[] = [];

  for (const segment of segments) {
    const content = readFileSync(segment.assPath, "utf-8");
    const suffix = segment.styleSuffix ?? "";

    // Extract Style lines from [V4+ Styles] section
    const styleLines = content
      .split("\n")
      .filter((line) => line.startsWith("Style:"));

    for (const styleLine of styleLines) {
      // Rename style: "Style: Default,..." -> "Style: Default_0,..."
      // Use [^,]+ to handle style names that may contain spaces.
      const renamed = styleLine.replace(
        /^Style:\s*([^,]+),/,
        (_m, name: string) => `Style: ${name.trim()}${suffix},`,
      );
      allStyles.push(renamed);
    }

    // Extract Dialogue lines from [Events] section
    const dialogueLines = content
      .split("\n")
      .filter((line) => line.startsWith("Dialogue:"));

    for (const dialogueLine of dialogueLines) {
      // Parse: Dialogue: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
      const parts = dialogueLine.split(",");
      if (parts.length < 10) continue;

      // Re-base Start (index 1) and End (index 2) to the timeline,
      // dropping/clamping cues via the segment's trim window.
      const cue = transformCue(
        parseAssTime(parts[1]!.trim()),
        parseAssTime(parts[2]!.trim()),
        segment.timeOffset,
        segment.window,
      );
      if (!cue) continue;
      parts[1] = formatAssTime(cue.start);
      parts[2] = formatAssTime(cue.end);

      // Rename style reference (index 3)
      const styleName = parts[3]!.trim();
      parts[3] = `${styleName}${suffix}`;

      allDialogues.push(parts.join(","));
    }
  }

  const header = `[Script Info]
Title: Merged Subtitles
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${allStyles.join("\n")}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${allDialogues.join("\n")}
`;

  const outPath = uniqueTempPath("varg-merged-captions", "ass");
  writeFileSync(outPath, header);
  return outPath;
}
