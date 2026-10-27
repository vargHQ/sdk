/**
 * ASS subtitle generation — convert SRT to ASS format with style presets,
 * word grouping, karaoke highlighting, and emoji data collection.
 */

import { smartJoin } from "../../speech/word-segmenter";
import {
  type EmojiInstance,
  extractEmoji,
  hasEmoji,
  stripEmoji,
} from "./emoji";
import { parseSrt, type SrtEntry } from "./srt";

export interface SubtitleStyle {
  fontName: string;
  fontSize: number;
  primaryColor: string;
  outlineColor: string;
  backColor: string;
  bold: boolean;
  outline: number;
  shadow: number;
  marginV: number;
  alignment: number;
}

export const STYLE_PRESETS: Record<string, SubtitleStyle> = {
  tiktok: {
    fontName: "Montserrat",
    fontSize: 72,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    bold: true,
    outline: 4,
    shadow: 0,
    marginV: 480,
    alignment: 2,
  },
  karaoke: {
    fontName: "Arial",
    fontSize: 28,
    primaryColor: "&H00FFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    bold: true,
    outline: 2,
    shadow: 1,
    marginV: 40,
    alignment: 2,
  },
  bounce: {
    fontName: "Impact",
    fontSize: 36,
    primaryColor: "&HFFFFFF",
    outlineColor: "&H000000",
    backColor: "&H00000000",
    bold: false,
    outline: 4,
    shadow: 2,
    marginV: 60,
    alignment: 2,
  },
  typewriter: {
    fontName: "Courier New",
    fontSize: 24,
    primaryColor: "&H00FF00",
    outlineColor: "&H000000",
    backColor: "&H80000000",
    bold: false,
    outline: 1,
    shadow: 0,
    marginV: 30,
    alignment: 2,
  },
};

export const POSITION_ALIGNMENT: Record<string, number> = {
  top: 8,
  center: 5,
  bottom: 2,
};

/** Emoji data collected from a single ASS dialogue line. */
export interface EntryEmojiData {
  instances: EmojiInstance[];
  taggedStrippedText: string;
  startTime: number;
  endTime: number;
}

/** Convert a hex color (#RRGGBB) to ASS color format (&HBBGGRR). */
export function colorToAss(color: string): string {
  if (color.startsWith("&H")) return color;

  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);
    return `&H${b}${g}${r}`.toUpperCase();
  }
  return "&HFFFFFF";
}

/**
 * Format seconds to ASS timestamp `H:MM:SS.CC`.
 * Computes from total centiseconds to avoid overflow when rounding
 * lands on 100 cs (e.g. 1.999s would otherwise produce `0:00:01.100`).
 */
export function formatAssTime(seconds: number): string {
  const totalCs = Math.max(0, Math.round(seconds * 100));
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function buildAssHeader(
  style: SubtitleStyle,
  width: number,
  height: number,
): string {
  return `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.backColor},${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},10,10,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
}

/**
 * Enforce monotonic, non-overlapping entry timings.
 *
 * Whisper word timestamps are not guaranteed monotonic — a word's start can
 * precede the previous word's end (ep5: "I" 3.56-3.72 followed by "can't"
 * 3.18-3.96). Cue generation trusts these timings, so overlaps leak into
 * overlapping Dialogue events that ASS renders stacked (two caption lines
 * on screen at once).
 *
 * Rules, in order:
 * - start is clamped to the previous entry's (adjusted) end
 * - end is clamped to be >= start (zero-length allowed; grouped rendering
 *   derives per-word ends from the next word's start anyway)
 *
 * Returns new objects; input is not mutated.
 */
export function monotonizeEntries(entries: SrtEntry[]): SrtEntry[] {
  const result: SrtEntry[] = [];
  let prevEnd = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const start = Math.max(entry.start, prevEnd);
    const end = Math.max(entry.end, start);
    result.push({ ...entry, start, end });
    prevEnd = end;
  }
  return result;
}

export function convertSrtToAss(
  srtContent: string,
  style: SubtitleStyle,
  width: number,
  height: number,
  tagText?: (text: string) => string,
  collectEmoji?: boolean,
  spacesPerEmoji?: number,
): { ass: string; emojiData: EntryEmojiData[] } {
  const assHeader = buildAssHeader(style, width, height);
  const nSpaces = spacesPerEmoji ?? 1;
  const entries = monotonizeEntries(parseSrt(srtContent));
  const emojiData: EntryEmojiData[] = [];

  const assDialogues = entries
    .map((entry, i) => {
      const startTime = entry.start;
      const nextStart =
        i < entries.length - 1 ? entries[i + 1]!.start : undefined;
      const clampedEnd =
        nextStart !== undefined ? Math.min(entry.end, nextStart) : entry.end;

      const start = formatAssTime(startTime);
      const end = formatAssTime(clampedEnd);

      let rawText = entry.text.replace(/\n/g, "\\N");

      let entryEmojiInstances: EmojiInstance[] | undefined;
      if (collectEmoji && hasEmoji(rawText)) {
        entryEmojiInstances = extractEmoji(rawText, nSpaces);
        rawText = stripEmoji(rawText, nSpaces);
      }

      const text = tagText ? tagText(rawText) : rawText;

      if (entryEmojiInstances) {
        emojiData.push({
          instances: entryEmojiInstances,
          taggedStrippedText: text,
          startTime,
          endTime: clampedEnd,
        });
      }

      return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return { ass: assHeader + assDialogues, emojiData };
}

/**
 * Generates ASS subtitle content with grouped words and active-word highlighting.
 *
 * Groups words into chunks of `wordsPerLine`. For each group, generates one
 * Dialogue event per word timing where the currently-spoken word is colored
 * with `activeColor` and the rest use the base `primaryColor`.
 */
export function convertSrtToAssGrouped(
  srtContent: string,
  style: SubtitleStyle,
  width: number,
  height: number,
  wordsPerLine: number,
  activeColor?: string,
  tagText?: (text: string) => string,
  collectEmoji?: boolean,
  spacesPerEmoji?: number,
): { ass: string; emojiData: EntryEmojiData[] } {
  const assHeader = buildAssHeader(style, width, height);
  const nSpaces = spacesPerEmoji ?? 1;
  const entries: SrtEntry[] = monotonizeEntries(parseSrt(srtContent));
  const dialogues: string[] = [];
  const emojiData: EntryEmojiData[] = [];
  const baseColor = style.primaryColor;
  const highlightColor = activeColor ?? baseColor;

  for (let gi = 0; gi < entries.length; gi += wordsPerLine) {
    const group = entries.slice(gi, gi + wordsPerLine);
    const groupStart = group[0]!.start;
    const nextGroupStart =
      gi + wordsPerLine < entries.length
        ? entries[gi + wordsPerLine]!.start
        : undefined;
    const groupEnd = nextGroupStart ?? group[group.length - 1]!.end;

    if (!activeColor) {
      let rawText = smartJoin(group.map((e) => e.text.replace(/\n/g, " ")));

      let groupEmojiInstances: EmojiInstance[] | undefined;
      if (collectEmoji && hasEmoji(rawText)) {
        groupEmojiInstances = extractEmoji(rawText, nSpaces);
        rawText = stripEmoji(rawText, nSpaces);
      }

      const text = tagText ? tagText(rawText) : rawText;

      if (groupEmojiInstances) {
        emojiData.push({
          instances: groupEmojiInstances,
          taggedStrippedText: text,
          startTime: groupStart,
          endTime: groupEnd,
        });
      }

      dialogues.push(
        `Dialogue: 0,${formatAssTime(groupStart)},${formatAssTime(groupEnd)},Default,,0,0,0,,${text}`,
      );
    } else {
      const allGroupWords: string[] = [];
      for (const entry of group) {
        allGroupWords.push(entry.text.replace(/\n/g, " ").trim());
      }
      const fullLineRaw = smartJoin(allGroupWords);

      let lineEmojiInstances: EmojiInstance[] | undefined;
      let strippedFullLine: string | undefined;
      if (collectEmoji && hasEmoji(fullLineRaw)) {
        lineEmojiInstances = extractEmoji(fullLineRaw, nSpaces);
        strippedFullLine = stripEmoji(fullLineRaw, nSpaces);
      }

      const strippedWords = lineEmojiInstances
        ? allGroupWords.map((w) => (hasEmoji(w) ? stripEmoji(w, nSpaces) : w))
        : allGroupWords;

      for (let wi = 0; wi < group.length; wi++) {
        const wordEntry = group[wi]!;
        const wordStart = wordEntry.start;
        const wordEnd = wi < group.length - 1 ? group[wi + 1]!.start : groupEnd;

        const parts: string[] = [];
        for (let idx = 0; idx < group.length; idx++) {
          const rawWord = strippedWords[idx]?.trim() ?? "";
          const word = tagText ? tagText(rawWord) : rawWord;
          if (idx === wi) {
            parts.push(`{\\c${highlightColor}}${word}{\\c${baseColor}}`);
          } else {
            parts.push(word);
          }
        }

        const lineText = smartJoin(parts);

        if (wi === 0 && lineEmojiInstances) {
          emojiData.push({
            instances: lineEmojiInstances,
            taggedStrippedText: lineText,
            startTime: groupStart,
            endTime: groupEnd,
          });
        }

        dialogues.push(
          `Dialogue: 0,${formatAssTime(wordStart)},${formatAssTime(wordEnd)},Default,,0,0,0,,${lineText}`,
        );
      }
    }
  }

  return { ass: assHeader + dialogues.join("\n"), emojiData };
}
