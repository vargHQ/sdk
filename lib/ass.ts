#!/usr/bin/env bun

/**
 * ASS (Advanced SubStation Alpha) subtitle format generator
 * Used for TikTok-style word-by-word captions with animations
 *
 * ASS Format Reference:
 * - Colors are in BGR format: &HBBGGRR (e.g., white = &HFFFFFF, red = &H0000FF)
 * - Alignment uses numpad layout (1-9): 2 = bottom center, 8 = top center, 5 = middle center
 * - Animation tags: \t(start,end,\effect) for transitions
 * - Fade tags: \fad(fadeIn,fadeOut) in milliseconds
 */

import { writeFileSync } from "node:fs";

// ============ TYPES ============

export interface ASSStyle {
  name: string;
  fontname: string;
  fontsize: number;
  primarycolor: string; // BGR format: &HBBGGRR or &HAABBGGRR with alpha
  secondarycolor: string; // Used for karaoke highlight
  outlinecolor: string;
  backcolor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeout: boolean;
  scaleX: number; // percentage, default 100
  scaleY: number; // percentage, default 100
  spacing: number; // letter spacing in pixels
  angle: number; // rotation in degrees
  borderStyle: number; // 1 = outline + shadow, 3 = opaque box
  outline: number; // outline thickness in pixels
  shadow: number; // shadow distance in pixels
  alignment: number; // 1-9 numpad style
  marginL: number;
  marginR: number;
  marginV: number;
  encoding: number; // character encoding, 1 = default
}

export interface ASSEvent {
  layer: number;
  start: number; // in seconds
  end: number; // in seconds
  style: string;
  name: string; // actor name (usually empty)
  marginL: number;
  marginR: number;
  marginV: number;
  effect: string;
  text: string; // with ASS override tags
}

export interface ASSDocument {
  title: string;
  playResX: number;
  playResY: number;
  wrapStyle: number; // 0 = smart, 1 = end-of-line, 2 = no wrap, 3 = smart (lower)
  scaledBorderAndShadow: boolean;
  styles: ASSStyle[];
  events: ASSEvent[];
}

// ============ COLOR UTILITIES ============

/**
 * Named colors with RGB values
 */
export const COLORS = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  yellow: [255, 229, 92],
  tiktok_yellow: [254, 231, 21], // Bright TikTok-style yellow (#FEE715)
  red: [255, 0, 0],
  green: [0, 255, 0],
  blue: [0, 0, 255],
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
} as const;

export type ColorName = keyof typeof COLORS;

/**
 * Parse color to RGB tuple
 * Supports: color names, hex (#RRGGBB), RGB array
 */
export function parseColor(
  color: string | [number, number, number],
): [number, number, number] {
  if (Array.isArray(color)) {
    return color;
  }

  // Check named colors
  const lowerColor = color.toLowerCase();
  if (lowerColor in COLORS) {
    return COLORS[lowerColor as ColorName] as [number, number, number];
  }

  // Parse hex color (#RRGGBB or RRGGBB)
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }

  // Default to white
  console.warn(`[ass] unknown color: ${color}, defaulting to white`);
  return [255, 255, 255];
}

/**
 * Convert RGB to ASS BGR format string
 * ASS uses &HBBGGRR format (blue, green, red)
 */
export function rgbToBGR(r: number, g: number, b: number): string {
  const bHex = b.toString(16).padStart(2, "0").toUpperCase();
  const gHex = g.toString(16).padStart(2, "0").toUpperCase();
  const rHex = r.toString(16).padStart(2, "0").toUpperCase();
  return `&H${bHex}${gHex}${rHex}`;
}

/**
 * Convert RGB to ASS BGR format with alpha
 * ASS uses &HAABBGGRR format (alpha, blue, green, red)
 * Alpha: 00 = fully visible, FF = fully transparent
 */
export function rgbToBGRWithAlpha(
  r: number,
  g: number,
  b: number,
  alpha = 0,
): string {
  const aHex = alpha.toString(16).padStart(2, "0").toUpperCase();
  const bHex = b.toString(16).padStart(2, "0").toUpperCase();
  const gHex = g.toString(16).padStart(2, "0").toUpperCase();
  const rHex = r.toString(16).padStart(2, "0").toUpperCase();
  return `&H${aHex}${bHex}${gHex}${rHex}`;
}

/**
 * Convert color (name, hex, or RGB) to ASS BGR format
 */
export function colorToBGR(color: string | [number, number, number]): string {
  const [r, g, b] = parseColor(color);
  return rgbToBGR(r, g, b);
}

// ============ TIME UTILITIES ============

/**
 * Convert seconds to ASS time format: H:MM:SS.cc (centiseconds)
 */
export function secondsToASSTime(seconds: number): string {
  const totalCentiseconds = Math.round(seconds * 100);
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const secs = Math.floor((totalCentiseconds % 6000) / 100);
  const centisecs = totalCentiseconds % 100;

  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centisecs).padStart(2, "0")}`;
}

/**
 * Convert milliseconds to ASS time format
 */
export function msToASSTime(ms: number): string {
  return secondsToASSTime(ms / 1000);
}

// ============ ASS OVERRIDE TAGS ============

/**
 * Create color override tag
 * @param color - Color in any supported format
 * @returns ASS color tag like {\c&HFFFFFF&}
 */
export function colorTag(color: string | [number, number, number]): string {
  return `{\\c${colorToBGR(color)}&}`;
}

/**
 * Create animation/transition tag
 * @param startMs - Start time in milliseconds (relative to event start)
 * @param endMs - End time in milliseconds
 * @param effect - Effect to apply (e.g., \fscx120\fscy120)
 * @returns ASS transition tag
 */
export function transitionTag(
  startMs: number,
  endMs: number,
  effect: string,
): string {
  return `{\\t(${startMs},${endMs},${effect})}`;
}

/**
 * Create bounce animation tags (scale up then back to normal)
 * @param durationMs - Total duration of the bounce
 * @param scale - Scale percentage (e.g., 112 for 12% increase)
 * @param animDurationMs - Duration of scale animation (default: 50ms)
 * @returns ASS tags for bounce effect
 */
export function bounceTag(
  durationMs: number,
  scale = 112,
  animDurationMs = 50,
): string {
  const scaleUpEnd = Math.min(animDurationMs, durationMs / 2);
  const scaleDownStart = Math.max(0, durationMs - animDurationMs);

  return (
    `{\\t(0,${scaleUpEnd},\\fscx${scale}\\fscy${scale})}` +
    `{\\t(${scaleDownStart},${durationMs},\\fscx100\\fscy100)}`
  );
}

/**
 * Create fade tag
 * @param fadeInMs - Fade in duration in milliseconds
 * @param fadeOutMs - Fade out duration in milliseconds
 * @returns ASS fade tag
 */
export function fadeTag(fadeInMs: number, fadeOutMs: number): string {
  return `{\\fad(${fadeInMs},${fadeOutMs})}`;
}

/**
 * Create reset tag to clear all overrides
 */
export function resetTag(): string {
  return "{\\r}";
}

/**
 * Create position override tag
 * @param x - X position in pixels
 * @param y - Y position in pixels
 * @returns ASS position tag
 */
export function positionTag(x: number, y: number): string {
  return `{\\pos(${x},${y})}`;
}

/**
 * Create alignment override tag
 * @param alignment - Alignment value 1-9 (numpad style)
 * @returns ASS alignment tag
 */
export function alignmentTag(alignment: number): string {
  return `{\\an${alignment}}`;
}

// ============ STYLE CREATION ============

/**
 * Create default ASS style
 */
export function createDefaultStyle(
  name = "Default",
  overrides: Partial<ASSStyle> = {},
): ASSStyle {
  return {
    name,
    fontname: "Arial",
    fontsize: 48,
    primarycolor: "&HFFFFFF", // white
    secondarycolor: "&H00FFFF", // yellow (for karaoke)
    outlinecolor: "&H000000", // black
    backcolor: "&H00000000", // transparent
    bold: true,
    italic: false,
    underline: false,
    strikeout: false,
    scaleX: 100,
    scaleY: 100,
    spacing: 0,
    angle: 0,
    borderStyle: 1,
    outline: 2,
    shadow: 0,
    alignment: 2, // bottom center
    marginL: 40,
    marginR: 40,
    marginV: 60,
    encoding: 1,
    ...overrides,
  };
}

/**
 * Create TikTok-optimized style
 */
export function createTikTokStyle(
  name = "TikTok",
  overrides: Partial<ASSStyle> = {},
): ASSStyle {
  return createDefaultStyle(name, {
    fontname: "Helvetica Bold",
    fontsize: 80,
    primarycolor: rgbToBGR(254, 231, 21), // TikTok yellow (inactive)
    secondarycolor: rgbToBGR(255, 255, 255), // white (active)
    outlinecolor: rgbToBGR(0, 0, 0), // black outline
    backcolor: rgbToBGRWithAlpha(0, 0, 0, 255), // transparent
    bold: true,
    outline: 8, // thick outline for 4.5:1 contrast
    shadow: 0,
    spacing: 3,
    alignment: 8, // top center (will be adjusted per position)
    marginL: 60,
    marginR: 120,
    marginV: 300,
    ...overrides,
  });
}

// ============ DOCUMENT GENERATION ============

/**
 * Generate ASS style line
 */
function formatStyle(style: ASSStyle): string {
  return (
    `Style: ${style.name},${style.fontname},${style.fontsize},` +
    `${style.primarycolor},${style.secondarycolor},${style.outlinecolor},${style.backcolor},` +
    `${style.bold ? -1 : 0},${style.italic ? -1 : 0},${style.underline ? -1 : 0},${style.strikeout ? -1 : 0},` +
    `${style.scaleX},${style.scaleY},${style.spacing},${style.angle},` +
    `${style.borderStyle},${style.outline},${style.shadow},` +
    `${style.alignment},${style.marginL},${style.marginR},${style.marginV},${style.encoding}`
  );
}

/**
 * Generate ASS event (dialogue) line
 */
function formatEvent(event: ASSEvent): string {
  const start = secondsToASSTime(event.start);
  const end = secondsToASSTime(event.end);

  return (
    `Dialogue: ${event.layer},${start},${end},${event.style},` +
    `${event.name},${event.marginL},${event.marginR},${event.marginV},` +
    `${event.effect},${event.text}`
  );
}

/**
 * Generate complete ASS document string
 */
export function generateASS(doc: ASSDocument): string {
  const lines: string[] = [];

  // Script Info section
  lines.push("[Script Info]");
  lines.push(`Title: ${doc.title}`);
  lines.push("ScriptType: v4.00+");
  lines.push(`PlayResX: ${doc.playResX}`);
  lines.push(`PlayResY: ${doc.playResY}`);
  lines.push(`WrapStyle: ${doc.wrapStyle}`);
  lines.push(
    `ScaledBorderAndShadow: ${doc.scaledBorderAndShadow ? "yes" : "no"}`,
  );
  lines.push("");

  // Styles section
  lines.push("[V4+ Styles]");
  lines.push(
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
  );
  for (const style of doc.styles) {
    lines.push(formatStyle(style));
  }
  lines.push("");

  // Events section
  lines.push("[Events]");
  lines.push(
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  );
  for (const event of doc.events) {
    lines.push(formatEvent(event));
  }

  return lines.join("\n");
}

/**
 * Create ASS event helper
 */
export function createEvent(
  start: number,
  end: number,
  text: string,
  style = "Default",
  overrides: Partial<ASSEvent> = {},
): ASSEvent {
  return {
    layer: 0,
    start,
    end,
    style,
    name: "",
    marginL: 0,
    marginR: 0,
    marginV: 0,
    effect: "",
    text,
    ...overrides,
  };
}

/**
 * Create ASS document helper
 */
export function createDocument(
  width: number,
  height: number,
  styles: ASSStyle[],
  events: ASSEvent[],
  title = "Generated Subtitles",
): ASSDocument {
  return {
    title,
    playResX: width,
    playResY: height,
    wrapStyle: 2, // smart wrapping
    scaledBorderAndShadow: true,
    styles,
    events,
  };
}

/**
 * Save ASS document to file
 */
export function saveASS(doc: ASSDocument, outputPath: string): void {
  const content = generateASS(doc);
  writeFileSync(outputPath, content, "utf-8");
  console.log(`[ass] saved to ${outputPath}`);
}

// ============ TEXT UTILITIES ============

/**
 * Wrap text to multiple lines based on max characters per line
 * Uses \\N for ASS line breaks
 */
export function wrapText(text: string, maxCharsPerLine = 27): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentLength = 0;

  for (const word of words) {
    const wordLength = word.length;
    const spaceNeeded = wordLength + (currentLine.length > 0 ? 1 : 0);

    if (currentLength + spaceNeeded <= maxCharsPerLine) {
      currentLine.push(word);
      currentLength += spaceNeeded;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(" "));
      }
      currentLine = [word];
      currentLength = wordLength;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(" "));
  }

  return lines.join("\\N");
}

/**
 * Split words into lines respecting max characters
 */
export function splitIntoLines<T extends { word: string }>(
  words: T[],
  maxChars = 27,
): T[][] {
  const lines: T[][] = [];
  let currentLine: T[] = [];
  let currentLength = 0;

  for (const wordData of words) {
    const wordLen = wordData.word.length;

    if (currentLength > 0 && currentLength + 1 + wordLen > maxChars) {
      lines.push(currentLine);
      currentLine = [wordData];
      currentLength = wordLen;
    } else {
      currentLine.push(wordData);
      currentLength += wordLen + (currentLength > 0 ? 1 : 0);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

// ============ CLI ============

if (import.meta.main) {
  console.log(`
ASS Subtitle Generator
======================

This library generates ASS (Advanced SubStation Alpha) subtitle files
for use with ffmpeg's ass filter. It supports:

- Custom styles with colors, fonts, outlines
- Animation tags (bounce, fade, transitions)
- TikTok-style word-by-word highlighting
- Safe zone calculations for mobile video

Usage as library:

  import { createDocument, createTikTokStyle, createEvent, generateASS } from './lib/ass'

  const style = createTikTokStyle('TikTok')
  const event = createEvent(0, 3, 'Hello World', 'TikTok')
  const doc = createDocument(1080, 1920, [style], [event])
  const assContent = generateASS(doc)

Color utilities:

  import { colorToBGR, colorTag, bounceTag, fadeTag } from './lib/ass'
  
  colorToBGR('white')           // => '&HFFFFFF'
  colorToBGR([255, 0, 0])       // => '&H0000FF' (red in BGR)
  colorTag('tiktok_yellow')     // => '{\\c&H15E7FE&}'
  bounceTag(400, 112, 50)       // => '{\\t(0,50,\\fscx112\\fscy112)}{\\t(350,400,\\fscx100\\fscy100)}'
  fadeTag(150, 150)             // => '{\\fad(150,150)}'
  `);
}
