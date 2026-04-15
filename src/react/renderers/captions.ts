import { writeFileSync } from "node:fs";
import { groq } from "@ai-sdk/groq";
import { experimental_transcribe as transcribe } from "ai";
import { z } from "zod";
import { smartJoin } from "../../speech/word-segmenter";
import { ResolvedElement } from "../resolved-element";
import type { CaptionsProps, VargElement } from "../types";
import { ensureLocalFonts } from "./burn-captions";
import type { RenderContext } from "./context";
import {
  calculateEmojiSize,
  calculateEmojiY,
  type EmojiInstance,
  type EmojiOverlay,
  extractEmoji,
  hasEmoji,
  stripEmoji,
} from "./emoji";
import { type FontResolution, getDefaultFontId, resolveFonts } from "./fonts";
import { addTask, completeTask, startTask } from "./progress";
import { renderSpeech } from "./speech";
import {
  type FontPathMap,
  getCharXPositions,
  getFontMetrics,
  getSpaceWidth,
  parseASSSegments,
} from "./text-measure";

const groqWordSchema = z.object({
  word: z.string(),
  start: z.number(),
  end: z.number(),
});

const groqResponseSchema = z.object({
  words: z.array(groqWordSchema).optional(),
});

type GroqWord = z.infer<typeof groqWordSchema>;

// Helper function to convert words to SRT format
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

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

interface SrtEntry {
  index: number;
  start: number;
  end: number;
  text: string;
}

interface SubtitleStyle {
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

const STYLE_PRESETS: Record<string, SubtitleStyle> = {
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

function convertSrtToAss(
  srtContent: string,
  style: SubtitleStyle,
  width: number,
  height: number,
  tagText?: (text: string) => string,
  collectEmoji?: boolean,
  spacesPerEmoji?: number,
): { ass: string; emojiData: EntryEmojiData[] } {
  const assHeader = `[Script Info]
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

  const nSpaces = spacesPerEmoji ?? 1;
  const entries = parseSrt(srtContent);
  const emojiData: EntryEmojiData[] = [];

  const assDialogues = entries
    .map((entry, i) => {
      const startTime = entry.start;
      // Clamp end to next entry's start to prevent overlapping subtitles
      // (transcription engines often produce overlapping word timestamps)
      const nextStart =
        i < entries.length - 1 ? entries[i + 1]!.start : undefined;
      const clampedEnd =
        nextStart !== undefined ? Math.min(entry.end, nextStart) : entry.end;

      const start = formatAssTime(startTime);
      const end = formatAssTime(clampedEnd);

      let rawText = entry.text.replace(/\n/g, "\\N");

      // Strip emoji from text and collect overlay data
      let entryEmojiInstances: EmojiInstance[] | undefined;
      if (collectEmoji && hasEmoji(rawText)) {
        entryEmojiInstances = extractEmoji(rawText, nSpaces);
        rawText = stripEmoji(rawText, nSpaces);
      }

      const text = tagText ? tagText(rawText) : rawText;

      // Collect emoji data with the tagged text for precise measurement
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
 *
 * Example output for group ["Varg", "AI", "is"] with activeColor orange:
 *   t=0.5-0.8: {\c&H428CFF&}Varg{\c&HFFFFFF&} AI is
 *   t=0.8-1.0: Varg {\c&H428CFF&}AI{\c&HFFFFFF&} is
 *   t=1.0-1.3: Varg AI {\c&H428CFF&}is{\c&HFFFFFF&}
 */
function convertSrtToAssGrouped(
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
  const assHeader = `[Script Info]
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

  const nSpaces = spacesPerEmoji ?? 1;
  const entries = parseSrt(srtContent);
  const dialogues: string[] = [];
  const emojiData: EntryEmojiData[] = [];
  const baseColor = style.primaryColor;
  const highlightColor = activeColor ?? baseColor;

  // Group entries into chunks of wordsPerLine
  for (let gi = 0; gi < entries.length; gi += wordsPerLine) {
    const group = entries.slice(gi, gi + wordsPerLine);
    const groupStart = group[0]!.start;
    // Cap group end at next group's start to prevent two groups showing simultaneously
    const nextGroupStart =
      gi + wordsPerLine < entries.length
        ? entries[gi + wordsPerLine]!.start
        : undefined;
    const groupEnd = nextGroupStart ?? group[group.length - 1]!.end;

    if (!activeColor) {
      // No highlight — show entire group as one event
      let rawText = smartJoin(group.map((e) => e.text.replace(/\n/g, " ")));

      // Strip emoji from the grouped text line
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
      // Karaoke highlight — one dialogue event per word, shifting the highlight
      // For emoji in karaoke mode, we strip emoji from the full group line
      // and collect overlay data once (for the full group duration).
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

      // Build per-word stripped words for highlight assembly
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

        // Collect emoji data once for the first word's dialogue
        // (all words in the group show the same line text, just with different highlight)
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

/** Emoji data collected from a single ASS dialogue line. */
interface EntryEmojiData {
  /** Emoji instances found in this entry's text. */
  instances: EmojiInstance[];
  /** The stripped text (emoji replaced with spaces) AFTER {\fn} tagging by tagText(). */
  taggedStrippedText: string;
  /** Start time in seconds. */
  startTime: number;
  /** End time in seconds. */
  endTime: number;
}

const POSITION_ALIGNMENT: Record<string, number> = {
  top: 8,
  center: 5,
  bottom: 2,
};

function colorToAss(color: string): string {
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

export interface CaptionsResult {
  assPath: string;
  srtPath?: string;
  audioPath?: string;
  /** Font files needed for rendering (primary + any fallbacks for non-Latin scripts). */
  fontFiles?: { url: string; fileName: string }[];
  /** Emoji overlay data for color emoji rendering via image overlay. */
  emojiOverlays?: EmojiOverlay[];
}

export async function renderCaptions(
  element: VargElement<"captions">,
  ctx: RenderContext,
): Promise<CaptionsResult> {
  const props = element.props as CaptionsProps;

  let srtContent: string;
  let srtPath: string | undefined;
  let audioPath: string | undefined;

  if (props.srt) {
    srtContent = await Bun.file(props.srt).text();
    srtPath = props.srt;
  } else if (props.src) {
    if (typeof props.src === "string") {
      srtContent = await Bun.file(props.src).text();
      srtPath = props.src;
    } else if (props.src.type === "speech") {
      // Use pre-generated file if already resolved, otherwise render
      const speechFile =
        props.src instanceof ResolvedElement
          ? props.src.meta.file
          : await renderSpeech(props.src, ctx);
      audioPath = await ctx.backend.resolvePath(speechFile);

      // Check if the speech element already has word-level timing from ElevenLabs.
      // If so, skip the Whisper transcription step entirely (saves time and cost).
      const nativeWords =
        props.src instanceof ResolvedElement ? props.src.meta.words : undefined;

      if (nativeWords && nativeWords.length > 0) {
        // Use native ElevenLabs word timing — same shape as GroqWord
        srtContent = convertToSRT(nativeWords);
      } else {
        // Transcribe audio to get word-level timestamps for captions.
        // Uses gateway transcription model if available (deployed render),
        // falls back to direct Groq Whisper for local/CLI usage.
        const transcriptionModel = ctx.defaults?.transcription;
        const transcribeTaskId = ctx.progress
          ? addTask(
              ctx.progress,
              "transcribe",
              transcriptionModel ? "gateway-whisper" : "groq-whisper",
            )
          : null;
        if (transcribeTaskId && ctx.progress)
          startTask(ctx.progress, transcribeTaskId);

        let words: GroqWord[] | undefined;
        let fallbackText = "";
        try {
          const audioData =
            audioPath.startsWith("http://") || audioPath.startsWith("https://")
              ? await fetch(audioPath).then((res) => res.arrayBuffer())
              : await Bun.file(audioPath).arrayBuffer();

          const model =
            transcriptionModel ?? groq.transcription("whisper-large-v3");
          const result = await transcribe({
            model,
            audio: new Uint8Array(audioData),
            providerOptions: transcriptionModel
              ? {}
              : {
                  groq: {
                    responseFormat: "verbose_json",
                    timestampGranularities: ["word"],
                  },
                },
          });

          fallbackText = result.text;

          // Extract words: from providerMetadata (gateway) or response body (direct groq)
          const metaWords = (
            result.providerMetadata?.varg as { words?: GroqWord[] } | undefined
          )?.words;
          if (metaWords && metaWords.length > 0) {
            words = metaWords;
          } else {
            const rawBody = (result.responses[0] as { body?: unknown })?.body;
            const parsed = groqResponseSchema.safeParse(rawBody);
            words = parsed.success ? parsed.data.words : undefined;
          }
        } finally {
          if (transcribeTaskId && ctx.progress)
            completeTask(ctx.progress, transcribeTaskId);
        }

        if (!words || words.length === 0) {
          srtContent = `1\n00:00:00,000 --> 00:00:05,000\n${fallbackText}\n`;
        } else {
          srtContent = convertToSRT(words);
        }
      }

      srtPath = `/tmp/varg-captions-${Date.now()}.srt`;
      writeFileSync(srtPath, srtContent);
      ctx.tempFiles.push(srtPath);
    } else {
      throw new Error(
        "Captions src must be a path to SRT file or Speech element",
      );
    }
  } else {
    throw new Error("Captions element requires either 'srt' or 'src' prop");
  }

  const styleName = props.style ?? "tiktok";
  const defaultStyle: SubtitleStyle = {
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
  };
  const baseStyle = STYLE_PRESETS[styleName] ?? defaultStyle;

  // Resolve fonts: primary font from props.font or style default, plus fallbacks
  const primaryFontId = props.font ?? getDefaultFontId(styleName);
  const fontResolution = resolveFonts(srtContent, primaryFontId);

  const alignment = props.position
    ? (POSITION_ALIGNMENT[props.position] ?? baseStyle.alignment)
    : baseStyle.alignment;

  const style: SubtitleStyle = {
    ...baseStyle,
    fontName: fontResolution.primary.fontName,
    fontSize: props.fontSize ?? baseStyle.fontSize,
    primaryColor: props.color
      ? colorToAss(props.color)
      : baseStyle.primaryColor,
    alignment,
    marginV: props.position === "center" ? 0 : baseStyle.marginV,
  };

  const activeColorAss = props.activeColor
    ? colorToAss(props.activeColor)
    : undefined;

  // Check if the SRT content has emoji — if so, we'll strip them from ASS
  // text and build overlay data for color PNG rendering
  const srtHasEmoji = hasEmoji(srtContent);

  // When emoji are present, compute how many spaces to reserve per emoji
  // using precise font metrics from the primary font
  let spacesPerEmoji: number | undefined;
  let fontPathMap: FontPathMap | undefined;
  if (srtHasEmoji) {
    // Download fonts locally for measurement
    const localFontsDir = await ensureLocalFonts(
      fontResolution.fontFiles.map((f) => ({
        url: f.url,
        fileName: f.fileName,
      })),
    );

    // Build font name → local path mapping
    fontPathMap = new Map();
    for (const f of fontResolution.fontFiles) {
      fontPathMap.set(f.fontName, `${localFontsDir}/${f.fileName}`);
    }

    // Compute spacesPerEmoji using real font metrics
    const primaryFontPath = fontPathMap.get(fontResolution.primary.fontName);
    if (primaryFontPath) {
      const metrics = getFontMetrics(primaryFontPath, style.fontSize);
      const emojiSize = calculateEmojiSize(
        metrics.winAscent,
        ctx.height,
        ctx.height,
      );
      const spaceWidth = getSpaceWidth(primaryFontPath, style.fontSize);
      // +1 buffer space for visual breathing room between emoji and adjacent text
      spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);
    }
  }

  const { ass: assContent, emojiData } = props.wordsPerLine
    ? convertSrtToAssGrouped(
        srtContent,
        style,
        ctx.width,
        ctx.height,
        props.wordsPerLine,
        activeColorAss,
        fontResolution.tagText,
        srtHasEmoji,
        spacesPerEmoji,
      )
    : convertSrtToAss(
        srtContent,
        style,
        ctx.width,
        ctx.height,
        fontResolution.tagText,
        srtHasEmoji,
        spacesPerEmoji,
      );
  const assPath = `/tmp/varg-captions-${Date.now()}.ass`;
  writeFileSync(assPath, assContent);
  ctx.tempFiles.push(assPath);

  // Build emoji overlay descriptors with precise pixel positions from font metrics
  let emojiOverlays: EmojiOverlay[] | undefined;
  if (emojiData.length > 0 && fontPathMap) {
    const primaryFontPath = fontPathMap.get(style.fontName);
    const metrics = primaryFontPath
      ? getFontMetrics(primaryFontPath, style.fontSize)
      : {
          ppem: style.fontSize * 0.64,
          capHeight: style.fontSize * 0.45,
          winAscent: style.fontSize * 0.7,
          winDescent: style.fontSize * 0.3,
        };
    const emojiSize = calculateEmojiSize(
      metrics.winAscent,
      ctx.height,
      ctx.height,
    );
    const nSpaces = spacesPerEmoji ?? 1;
    const spaceW = primaryFontPath
      ? getSpaceWidth(primaryFontPath, style.fontSize)
      : metrics.ppem * 0.28;
    emojiOverlays = [];
    for (const entry of emojiData) {
      const segments = parseASSSegments(
        entry.taggedStrippedText,
        style.fontName,
      );
      const charPositions = getCharXPositions(
        segments,
        fontPathMap,
        style.fontSize,
        ctx.width,
        style.alignment,
      );

      for (const instance of entry.instances) {
        // charIndex points to the first space in the reserved block.
        // Center the emoji within the reserved space block.
        const firstSpaceX = charPositions[instance.charIndex] ?? 0;
        const lastSpaceIdx = Math.min(
          instance.charIndex + nSpaces - 1,
          charPositions.length - 1,
        );
        const lastSpaceX = charPositions[lastSpaceIdx] ?? firstSpaceX;
        const blockEndX = lastSpaceX + spaceW;
        const blockWidth = blockEndX - firstSpaceX;
        const x = Math.round(firstSpaceX + blockWidth / 2 - emojiSize / 2);

        const y = calculateEmojiY(
          style.alignment,
          style.marginV,
          metrics.winDescent,
          metrics.winAscent,
          metrics.capHeight,
          ctx.height,
          ctx.height,
        );
        emojiOverlays.push({
          url: instance.url,
          fileName: `${instance.codepoints}.png`,
          startTime: entry.startTime,
          endTime: entry.endTime,
          x,
          y,
          size: emojiSize,
        });
      }
    }
  }

  // When emoji are overlaid as color PNGs, exclude Noto Emoji from font files
  // (emoji chars are spaces in the ASS text, so the monochrome font is unused)
  const fontFiles = fontResolution.fontFiles
    .filter(
      (f) =>
        !(emojiOverlays && emojiOverlays.length > 0 && f.id === "noto-emoji"),
    )
    .map((f) => ({ url: f.url, fileName: f.fileName }));

  return {
    assPath,
    srtPath,
    audioPath: props.withAudio ? audioPath : undefined,
    fontFiles,
    emojiOverlays,
  };
}
