import { readFileSync, writeFileSync } from "node:fs";

export interface AssSegment {
  assPath: string;
  timeOffset: number;
  styleSuffix?: string;
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
 * Shift all Dialogue timestamps in an ASS file by `offset` seconds.
 * Returns path to a new temp file.
 */
export function shiftAssTimestamps(assPath: string, offset: number): string {
  const content = readFileSync(assPath, "utf-8");
  const shifted = content.replace(
    /^(Dialogue:\s*\d+,)(\d+:\d{2}:\d{2}\.\d{2}),(\d+:\d{2}:\d{2}\.\d{2})/gm,
    (_match, prefix: string, startTs: string, endTs: string) => {
      const newStart = formatAssTime(parseAssTime(startTs) + offset);
      const newEnd = formatAssTime(parseAssTime(endTs) + offset);
      return `${prefix}${newStart},${newEnd}`;
    },
  );
  const outPath = `/tmp/varg-shifted-captions-${Date.now()}.ass`;
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

      // Shift Start (index 1) and End (index 2)
      const startTs = parts[1]!.trim();
      const endTs = parts[2]!.trim();
      parts[1] = formatAssTime(parseAssTime(startTs) + segment.timeOffset);
      parts[2] = formatAssTime(parseAssTime(endTs) + segment.timeOffset);

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

  const outPath = `/tmp/varg-merged-captions-${Date.now()}.ass`;
  writeFileSync(outPath, header);
  return outPath;
}
