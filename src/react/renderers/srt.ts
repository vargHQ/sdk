/**
 * SRT formatting and parsing — convert word timings to SRT format
 * and parse SRT content back into structured entries.
 */

import { z } from "zod";

export const groqWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

export type GroqWord = z.infer<typeof groqWordSchema>;

export interface SrtEntry {
  index: number;
  start: number;
  end: number;
  text: string;
}

/** Format seconds as SRT timestamp `HH:MM:SS,mmm`. */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

/** Convert word timings to SRT subtitle format. */
export function convertToSRT(words: GroqWord[]): string {
  let srt = "";
  let index = 1;

  for (const word of words) {
    const startTime = formatTime(word.start);
    const endTime = formatTime(word.end);

    srt += `${index}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${word.word.trim()}\n\n`;
    index++;
  }

  return srt;
}

/** Parse SRT content into structured entries. */
export function parseSrt(content: string): SrtEntry[] {
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

    const start =
      Number.parseInt(h1, 10) * 3600 +
      Number.parseInt(m1, 10) * 60 +
      Number.parseInt(s1, 10) +
      Number.parseInt(ms1, 10) / 1000;

    const end =
      Number.parseInt(h2, 10) * 3600 +
      Number.parseInt(m2, 10) * 60 +
      Number.parseInt(s2, 10) +
      Number.parseInt(ms2, 10) / 1000;

    const text = lines.slice(2).join("\n");
    entries.push({ index, start, end, text });
  }

  return entries;
}
