/**
 * Captions renderer — orchestrates SRT generation (from native word timings
 * or Whisper transcription), ASS conversion with style presets, emoji
 * overlay computation, and font resolution.
 *
 * SRT formatting/parsing lives in srt.ts.
 * ASS generation + style presets live in ass.ts.
 */

import { writeFileSync } from "node:fs";
import { groq } from "@ai-sdk/groq";
import { experimental_transcribe as transcribe } from "ai";
import { extractWordTimings } from "../primitives/transcribe";
import { ResolvedElement } from "../resolved-element";
import type { CaptionsProps, VargElement } from "../types";
import {
  colorToAss,
  convertSrtToAss,
  convertSrtToAssGrouped,
  POSITION_ALIGNMENT,
  STYLE_PRESETS,
  type SubtitleStyle,
} from "./ass";
import { ensureLocalFonts } from "./burn-captions";
import type { RenderContext } from "./context";
import {
  calculateEmojiSize,
  calculateEmojiY,
  type EmojiOverlay,
  hasEmoji,
} from "./emoji";
import { type FontResolution, getDefaultFontId, resolveFonts } from "./fonts";
import { addTask, completeTask, startTask } from "./progress";
import { renderSpeech } from "./speech";
import { convertToSRT, type GroqWord } from "./srt";
import {
  type FontPathMap,
  getCharXPositions,
  getFontMetrics,
  getSpaceWidth,
  parseASSSegments,
} from "./text-measure";
import { uniqueTempPath } from "./utils";

export interface CaptionsResult {
  assPath: string;
  srtPath?: string;
  audioPath?: string;
  fontFiles?: { url: string; fileName: string }[];
  emojiOverlays?: EmojiOverlay[];
}

export async function renderCaptions(
  element: VargElement<"captions">,
  ctx: RenderContext,
): Promise<CaptionsResult> {
  const props = element.props as CaptionsProps;

  // 1. Resolve SRT content (from file, speech element, or audio element)
  const { srtContent, srtPath, audioPath } = await resolveSrtContent(
    props,
    element,
    ctx,
  );

  // 2. Build subtitle style from preset + props overrides
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

  // 3. Resolve fonts: primary font + fallbacks for non-Latin scripts
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

  // 4. Compute emoji spacing using real font metrics (if emoji present)
  const srtHasEmoji = hasEmoji(srtContent);
  let spacesPerEmoji: number | undefined;
  let fontPathMap: FontPathMap | undefined;

  if (srtHasEmoji) {
    const localFontsDir = await ensureLocalFonts(
      fontResolution.fontFiles.map((f) => ({
        url: f.url,
        fileName: f.fileName,
      })),
    );

    fontPathMap = new Map();
    for (const f of fontResolution.fontFiles) {
      fontPathMap.set(f.fontName, `${localFontsDir}/${f.fileName}`);
    }

    const primaryFontPath = fontPathMap.get(fontResolution.primary.fontName);
    if (primaryFontPath) {
      const metrics = getFontMetrics(primaryFontPath, style.fontSize);
      const emojiSize = calculateEmojiSize(
        metrics.winAscent,
        ctx.height,
        ctx.height,
      );
      const spaceWidth = getSpaceWidth(primaryFontPath, style.fontSize);
      spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);
    }
  }

  // 5. Convert SRT → ASS (with optional word grouping + karaoke highlight)
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
  const assPath = uniqueTempPath("varg-captions", "ass");
  writeFileSync(assPath, assContent);
  ctx.tempFiles.push(assPath);

  // 6. Build emoji overlay descriptors with precise pixel positions
  const emojiOverlays = buildEmojiOverlays(
    emojiData,
    fontPathMap,
    style,
    ctx,
    spacesPerEmoji,
  );

  // 7. Filter font files (exclude Noto Emoji when emoji overlaid as PNGs)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveSrtContent(
  props: CaptionsProps,
  element: VargElement<"captions">,
  ctx: RenderContext,
): Promise<{ srtContent: string; srtPath?: string; audioPath?: string }> {
  if (props.srt) {
    const srtContent = await Bun.file(props.srt).text();
    return { srtContent, srtPath: props.srt };
  }

  if (!props.src) {
    throw new Error("Captions element requires either 'srt' or 'src' prop");
  }

  if (typeof props.src === "string") {
    const srtContent = await Bun.file(props.src).text();
    return { srtContent, srtPath: props.src };
  }

  if (props.src.type !== "speech" && props.src.type !== "audio") {
    throw new Error(
      "Captions src must be a path to SRT file, a Speech element, or an audio element (video.audio / speech.audio)",
    );
  }

  // Resolve speech/audio file
  let speechFile: Awaited<ReturnType<typeof renderSpeech>>;
  if (props.src instanceof ResolvedElement) {
    speechFile = props.src.meta.file;
  } else if (props.src.type === "audio") {
    const { renderAudio } = await import("./audio");
    speechFile = await renderAudio(props.src as VargElement<"audio">, ctx);
  } else {
    speechFile = await renderSpeech(props.src as VargElement<"speech">, ctx);
  }
  const audioPath = await ctx.backend.resolvePath(speechFile);

  // AudioNode src (video.audio / speech.audio) — use the node's own
  // memoized transcribe(): shares one whisper call + silence-refined
  // boundaries with speechRange(), so captions and auto-trim agree on
  // when speech starts (whisper alone absorbs leading ambience into the
  // first word, putting captions on screen before anyone speaks).
  const maybeNode = props.src as Partial<import("../audio-element").AudioNode>;
  if (
    props.src.type === "audio" &&
    typeof maybeNode.transcribe === "function"
  ) {
    const { words } = await maybeNode.transcribe(
      props.prompt ? { prompt: props.prompt } : undefined,
    );
    if (words && words.length > 0) {
      const srtContent = convertToSRT(words as GroqWord[]);
      const srtPath = uniqueTempPath("varg-captions", "srt");
      writeFileSync(srtPath, srtContent);
      ctx.tempFiles.push(srtPath);
      return { srtContent, srtPath, audioPath };
    }
  }

  // Check for native word timings (ElevenLabs alignment) — skip Whisper if present
  const nativeWords =
    props.src instanceof ResolvedElement
      ? props.src.meta.words
      : props.src.meta?.words;

  if (nativeWords && nativeWords.length > 0) {
    const srtContent = convertToSRT(nativeWords as GroqWord[]);
    const srtPath = uniqueTempPath("varg-captions", "srt");
    writeFileSync(srtPath, srtContent);
    ctx.tempFiles.push(srtPath);
    return { srtContent, srtPath, audioPath };
  }

  // Transcribe via Whisper (gateway or direct Groq)
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

    const model = transcriptionModel ?? groq.transcription("whisper-large-v3");
    const result = await transcribe({
      model,
      audio: new Uint8Array(audioData),
      providerOptions: transcriptionModel
        ? props.prompt
          ? { varg: { prompt: props.prompt } }
          : {}
        : {
            groq: {
              responseFormat: "verbose_json",
              timestampGranularities: ["word"],
              ...(props.prompt ? { prompt: props.prompt } : {}),
            },
          },
    });

    fallbackText = result.text;
    words = extractWordTimings(result) as GroqWord[] | undefined;
  } finally {
    if (transcribeTaskId && ctx.progress)
      completeTask(ctx.progress, transcribeTaskId);
  }

  const srtContent =
    words && words.length > 0
      ? convertToSRT(words)
      : `1\n00:00:00,000 --> 00:00:05,000\n${fallbackText}\n`;
  const srtPath = uniqueTempPath("varg-captions", "srt");
  writeFileSync(srtPath, srtContent);
  ctx.tempFiles.push(srtPath);

  return { srtContent, srtPath, audioPath };
}

function buildEmojiOverlays(
  emojiData: import("./ass").EntryEmojiData[],
  fontPathMap: FontPathMap | undefined,
  style: SubtitleStyle,
  ctx: RenderContext,
  spacesPerEmoji: number | undefined,
): EmojiOverlay[] | undefined {
  if (emojiData.length === 0 || !fontPathMap) return undefined;

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

  const overlays: EmojiOverlay[] = [];
  for (const entry of emojiData) {
    const segments = parseASSSegments(entry.taggedStrippedText, style.fontName);
    const charPositions = getCharXPositions(
      segments,
      fontPathMap,
      style.fontSize,
      ctx.width,
      style.alignment,
    );

    for (const instance of entry.instances) {
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
      overlays.push({
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

  return overlays;
}
