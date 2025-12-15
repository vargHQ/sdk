#!/usr/bin/env bun

/**
 * TikTok-style word-by-word captions with animations
 *
 * Features:
 * - Progressive word appearance (words appear one by one)
 * - Bounce animation on active word
 * - Color switching (yellow inactive → white active)
 * - Fade in/out transitions
 * - TikTok safe zones for mobile video
 *
 * Based on Python reference: sdk-py-reference/varg-cli/lib/caption.py
 */

import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import {
  type ASSDocument,
  type ASSEvent,
  type ASSStyle,
  bounceTag,
  colorTag,
  colorToBGR,
  createDocument,
  createEvent,
  createTikTokStyle,
  fadeTag,
  resetTag,
  saveASS,
  splitIntoLines,
} from "../../lib/ass";

// ============ TIKTOK SAFE ZONES ============

/**
 * TikTok canvas constants for 9:16 aspect ratio
 */
export const TIKTOK_CANVAS = {
  WIDTH: 1080,
  HEIGHT: 1920,
  SAFE_ZONE_WIDTH: 840,
  SAFE_ZONE_HEIGHT: 1280,
  MARGIN_TOP: 120,
  MARGIN_BOTTOM: 240,
  MARGIN_LEFT: 60,
  MARGIN_RIGHT: 120,
} as const;

/**
 * Position zones for TikTok (pixels from edge for 1920px height)
 */
export const TIKTOK_POSITIONS = {
  "upper-middle": { alignment: 8, marginV: 300 }, // Golden zone for hooks (top center)
  middle: { alignment: 5, marginV: 0 }, // Middle center
  "lower-middle": { alignment: 2, marginV: 400 }, // Above navigation (bottom center)
  top: { alignment: 8, marginV: 120 }, // Top center
  bottom: { alignment: 2, marginV: 240 }, // Bottom center
} as const;

export type TikTokPosition = keyof typeof TIKTOK_POSITIONS;

// ============ TYPES ============

export interface TikTokWordStyle {
  /** Font size in pixels (default: 80, min 60-80 for 1080x1920) */
  fontsize?: number;
  /** Color of active/highlighted word (default: 'white') */
  activeColor?: string | [number, number, number];
  /** Color of inactive words (default: 'tiktok_yellow' #FEE715) */
  inactiveColor?: string | [number, number, number];
  /** Font name (default: 'Helvetica Bold') */
  font?: string;
  /** Stroke/outline color RGB (default: [0, 0, 0] black) */
  strokeColor?: [number, number, number];
  /** Stroke width in pixels (default: 8 for 4.5:1 contrast) */
  strokeWidth?: number;
  /** Vertical position (default: 'upper-middle') */
  position?: TikTokPosition;
  /** Scale multiplier for bounce effect (default: 1.12) */
  bounceScale?: number;
  /** Max characters per line (default: 27) */
  maxCharsPerLine?: number;
  /** Enable bounce animation (default: true) */
  useBounce?: boolean;
  /** Fade in/out duration in seconds (default: 0.15) */
  fadeDuration?: number;
  /** Pause between caption segments in seconds (default: 0.1) */
  pauseBetweenSegments?: number;
  /** Animation transition duration in milliseconds (default: 50) */
  animationDuration?: number;
}

export interface TikTokWordData {
  word: string;
  start: number; // seconds
  end: number; // seconds
}

export interface TikTokCaptionItem {
  /** Full caption text */
  text: string;
  /** Start time in seconds */
  start: number;
  /** End time in seconds */
  end: number;
  /** Optional word-level timing (auto-splits if not provided) */
  words?: TikTokWordData[];
}

export interface AddTikTokCaptionsOptions {
  videoPath: string;
  output: string;
  captions: TikTokCaptionItem[];
  style?: TikTokWordStyle;
}

// ============ DEFAULT STYLE ============

const DEFAULT_TIKTOK_STYLE: Required<TikTokWordStyle> = {
  fontsize: 80,
  activeColor: "white",
  inactiveColor: "tiktok_yellow",
  font: "Helvetica Bold",
  strokeColor: [0, 0, 0],
  strokeWidth: 8,
  position: "upper-middle",
  bounceScale: 1.12,
  maxCharsPerLine: 27,
  useBounce: true,
  fadeDuration: 0.15,
  pauseBetweenSegments: 0.1,
  animationDuration: 50,
};

// ============ VIDEO UTILITIES ============

/**
 * Get video dimensions using ffprobe
 */
async function getVideoDimensions(
  videoPath: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        console.warn(
          "[tiktok] could not get video dimensions, defaulting to 1080x1920",
        );
        resolve({ width: 1080, height: 1920 });
        return;
      }

      const videoStream = metadata.streams.find(
        (s) => s.codec_type === "video",
      );
      if (videoStream?.width && videoStream?.height) {
        resolve({ width: videoStream.width, height: videoStream.height });
      } else {
        resolve({ width: 1080, height: 1920 });
      }
    });
  });
}

/**
 * Calculate margin based on position and video height
 */
function calculateMarginV(
  position: TikTokPosition,
  videoHeight: number,
): number {
  const scale = videoHeight / TIKTOK_CANVAS.HEIGHT;
  const posConfig = TIKTOK_POSITIONS[position];
  return Math.round(posConfig.marginV * scale);
}

/**
 * Get alignment for position
 */
function getAlignment(position: TikTokPosition): number {
  return TIKTOK_POSITIONS[position].alignment;
}

// ============ CAPTION GENERATION ============

/**
 * Split text into words with even timing
 */
function autoSplitWords(
  text: string,
  start: number,
  end: number,
): TikTokWordData[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];

  const duration = end - start;
  const durationPerWord = duration / words.length;

  return words.map((word, i) => ({
    word,
    start: start + i * durationPerWord,
    end: start + (i + 1) * durationPerWord,
  }));
}

/**
 * Build ASS text for a word with styling
 */
function buildWordText(
  word: string,
  isActive: boolean,
  style: Required<TikTokWordStyle>,
  wordDurationMs: number,
): string {
  const color = isActive ? style.activeColor : style.inactiveColor;
  const colorStr = colorTag(color);

  if (isActive && style.useBounce) {
    const scale = Math.round(style.bounceScale * 100);
    const bounce = bounceTag(wordDurationMs, scale, style.animationDuration);
    return `${bounce}${colorStr}${word}${resetTag()}`;
  }

  return `${colorStr}${word}${resetTag()}`;
}

/**
 * Generate ASS events for TikTok-style word-by-word captions
 */
function generateTikTokEvents(
  captions: TikTokCaptionItem[],
  style: Required<TikTokWordStyle>,
): ASSEvent[] {
  const events: ASSEvent[] = [];
  const fadeInMs = Math.round(style.fadeDuration * 1000);
  const fadeOutMs = Math.round(style.fadeDuration * 1000);

  let prevSegmentEnd = 0;

  for (const caption of captions) {
    const { end, text } = caption;
    let start = caption.start;

    // Add pause after previous segment
    if (start < prevSegmentEnd + style.pauseBetweenSegments) {
      start = prevSegmentEnd + style.pauseBetweenSegments;
    }

    // Get word timings (auto-split if not provided)
    const wordsData = caption.words ?? autoSplitWords(text, start, end);
    if (wordsData.length === 0) continue;

    // Split words into lines
    const lines = splitIntoLines(wordsData, style.maxCharsPerLine);

    // Process each line
    for (const lineWords of lines) {
      const firstWord = lineWords[0];
      const lastWord = lineWords[lineWords.length - 1];
      if (!firstWord || !lastWord) continue;

      const lineEnd = lastWord.end;

      // Create event for each word (progressive appearance)
      for (let wordIdx = 0; wordIdx < lineWords.length; wordIdx++) {
        const wordData = lineWords[wordIdx];
        if (!wordData) continue;

        const wordStart = wordData.start;
        const wordEnd = wordData.end;
        const wordDurationMs = Math.round((wordEnd - wordStart) * 1000);

        // Build text showing only words up to current (progressive)
        const lineParts: string[] = [];

        for (let i = 0; i <= wordIdx; i++) {
          const wd = lineWords[i];
          if (!wd) continue;

          const isActive = i === wordIdx;
          const wdDurationMs = Math.round((wd.end - wd.start) * 1000);

          lineParts.push(buildWordText(wd.word, isActive, style, wdDurationMs));
        }

        let lineText = lineParts.join(" ");

        // First word: add fade in
        if (wordIdx === 0) {
          // Set initial color before fade to prevent flash
          const activeColorStr = colorTag(style.activeColor);
          lineText = `${activeColorStr}${fadeTag(fadeInMs, 0)}${lineText}`;
        }

        // Last word: add fade out and extend duration
        let eventEnd = wordEnd;
        if (wordIdx === lineWords.length - 1) {
          const activeColorStr = colorTag(style.activeColor);
          lineText = `${activeColorStr}${fadeTag(0, fadeOutMs)}${lineParts.join(" ")}`;
          eventEnd = wordEnd + style.fadeDuration;
        }

        events.push(createEvent(wordStart, eventEnd, lineText, "TikTok"));
      }

      prevSegmentEnd = lineEnd;
    }
  }

  return events;
}

/**
 * Create ASS style for TikTok captions
 */
function createTikTokASSStyle(
  style: Required<TikTokWordStyle>,
  videoWidth: number,
  videoHeight: number,
): ASSStyle {
  const scale = videoWidth / TIKTOK_CANVAS.WIDTH;
  const marginV = calculateMarginV(style.position, videoHeight);
  const alignment = getAlignment(style.position);

  return createTikTokStyle("TikTok", {
    fontname: style.font,
    fontsize: Math.round(style.fontsize * scale),
    primarycolor: colorToBGR(style.inactiveColor), // Yellow base
    secondarycolor: colorToBGR(style.activeColor), // White highlight
    outlinecolor: colorToBGR(style.strokeColor),
    outline: Math.round(style.strokeWidth * scale),
    spacing: Math.round(3 * scale),
    alignment,
    marginL: Math.round(TIKTOK_CANVAS.MARGIN_LEFT * scale),
    marginR: Math.round(TIKTOK_CANVAS.MARGIN_RIGHT * scale),
    marginV,
  });
}

// ============ MAIN FUNCTION ============

/**
 * Add TikTok-style word-by-word captions to a video
 *
 * Features:
 * - Progressive word appearance
 * - Bounce animation on active word
 * - Yellow → White color switching
 * - Fade in/out transitions
 * - TikTok safe zone positioning
 *
 * @example
 * ```typescript
 * await addTikTokCaptions({
 *   videoPath: 'video.mp4',
 *   output: 'captioned.mp4',
 *   captions: [
 *     {
 *       text: 'Follow the Apostles Diet',
 *       start: 0,
 *       end: 3,
 *       words: [
 *         { word: 'Follow', start: 0, end: 0.5 },
 *         { word: 'the', start: 0.5, end: 0.8 },
 *         { word: 'Apostles', start: 0.8, end: 1.5 },
 *         { word: 'Diet', start: 1.5, end: 3 },
 *       ]
 *     }
 *   ],
 *   style: { position: 'upper-middle', bounceScale: 1.15 }
 * });
 * ```
 */
export async function addTikTokCaptions(
  options: AddTikTokCaptionsOptions,
): Promise<string> {
  const { videoPath, output, captions, style: userStyle } = options;

  if (!videoPath) {
    throw new Error("videoPath is required");
  }
  if (!output) {
    throw new Error("output is required");
  }
  if (!existsSync(videoPath)) {
    throw new Error(`video file not found: ${videoPath}`);
  }
  if (!captions || captions.length === 0) {
    throw new Error("captions array is required and must not be empty");
  }

  console.log("[tiktok] adding TikTok-style captions...");

  // Merge style with defaults
  const style: Required<TikTokWordStyle> = {
    ...DEFAULT_TIKTOK_STYLE,
    ...userStyle,
  };

  // Get video dimensions
  const { width, height } = await getVideoDimensions(videoPath);
  console.log(`[tiktok] video dimensions: ${width}x${height}`);

  // Create ASS style
  const assStyle = createTikTokASSStyle(style, width, height);

  // Generate events
  const events = generateTikTokEvents(captions, style);
  console.log(`[tiktok] generated ${events.length} caption events`);

  // Create ASS document
  const doc = createDocument(
    width,
    height,
    [assStyle],
    events,
    "TikTok Captions",
  );

  // Save to temp file
  const assPath = join(tmpdir(), `tiktok-captions-${Date.now()}.ass`);
  saveASS(doc, assPath);

  console.log("[tiktok] rendering video with ffmpeg...");

  // Apply with ffmpeg
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters(`ass=${assPath}`)
      .outputOptions(["-c:a", "copy"]) // copy audio without re-encoding
      .output(output)
      .on("end", () => {
        // Clean up temp file
        try {
          unlinkSync(assPath);
        } catch {
          // Ignore cleanup errors
        }
        console.log(`[tiktok] saved to ${output}`);
        resolve(output);
      })
      .on("error", (err) => {
        // Clean up temp file
        try {
          unlinkSync(assPath);
        } catch {
          // Ignore cleanup errors
        }
        console.error("[tiktok] error:", err);
        reject(err);
      })
      .run();
  });
}

// ============ CLI ============

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`
TikTok-Style Word-by-Word Captions
==================================

Usage:
  bun run action/captions/tiktok.ts <videoPath> <outputPath> [options]

Options:
  --text <text>       Caption text (will auto-split words)
  --start <seconds>   Start time (default: 0)
  --end <seconds>     End time (required if --text provided)
  --position <pos>    Position: upper-middle, middle, lower-middle, top, bottom
  --bounce <scale>    Bounce scale (default: 1.12)
  --no-bounce         Disable bounce animation

Example:
  bun run action/captions/tiktok.ts video.mp4 output.mp4 \\
    --text "Follow the Apostles Diet" \\
    --start 0 --end 3 \\
    --position upper-middle
    `);
    process.exit(0);
  }

  const videoPath = args[0] as string;
  const outputPath = args[1] || videoPath.replace(/(\.[^.]+)$/, "_tiktok$1");

  // Parse options
  let text = "";
  let start = 0;
  let end = 5;
  let position: TikTokPosition = "upper-middle";
  let bounceScale = 1.12;
  let useBounce = true;

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--text" && args[i + 1]) {
      text = args[++i] as string;
    } else if (arg === "--start" && args[i + 1]) {
      start = Number.parseFloat(args[++i] as string);
    } else if (arg === "--end" && args[i + 1]) {
      end = Number.parseFloat(args[++i] as string);
    } else if (arg === "--position" && args[i + 1]) {
      position = args[++i] as TikTokPosition;
    } else if (arg === "--bounce" && args[i + 1]) {
      bounceScale = Number.parseFloat(args[++i] as string);
    } else if (arg === "--no-bounce") {
      useBounce = false;
    }
  }

  if (!text) {
    text = "This is a TikTok style caption demo";
  }

  const captions: TikTokCaptionItem[] = [{ text, start, end }];

  addTikTokCaptions({
    videoPath,
    output: outputPath,
    captions,
    style: { position, bounceScale, useBounce },
  })
    .then(() => {
      console.log("[tiktok] done!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[tiktok] failed:", err);
      process.exit(1);
    });
}
