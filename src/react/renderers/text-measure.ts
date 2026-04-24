/**
 * Precise text measurement matching libass rendering.
 *
 * libass uses FT_SIZE_REQUEST_TYPE_REAL_DIM when setting the FreeType font
 * size, which means the ASS fontSize specifies the full cell height
 * (usWinAscent + usWinDescent from the OS/2 table), NOT the em square.
 *
 * The effective pixels-per-em (ppem) is:
 *   ppem = assFontSize * unitsPerEm / (usWinAscent + usWinDescent)
 *
 * All glyph advance widths must be computed at this effective ppem to match
 * what libass actually renders.
 */

import * as opentype from "opentype.js";

// ---------------------------------------------------------------------------
// Font cache
// ---------------------------------------------------------------------------

const fontCache = new Map<string, opentype.Font>();

/**
 * Load a font from a local file path, caching by path.
 */
export function loadFont(fontPath: string): opentype.Font {
  let font = fontCache.get(fontPath);
  if (!font) {
    font = opentype.loadSync(fontPath);
    fontCache.set(fontPath, font);
  }
  return font;
}

// ---------------------------------------------------------------------------
// Safe glyph access (handles Arabic/complex script GSUB failures)
// ---------------------------------------------------------------------------

/**
 * Get glyphs for a text string, falling back to per-character cmap lookup
 * if the font's GSUB processing fails.
 *
 * opentype.js v1.3.4 crashes on Arabic fonts when applying contextual
 * substitution (GSUB lookup type 5 / substFormat 3). The fallback uses
 * `charToGlyph()` which does a direct cmap lookup — no Bidi processing,
 * no GSUB shaping, no crash.
 *
 * For scripts with complex shaping (Arabic, Hebrew), the nominal advance
 * widths from isolated-form glyphs overestimate the actual rendered width
 * because HarfBuzz applies ligatures and contextual forms. The `needsShaping`
 * output flag signals that the caller should correct total width using
 * `measureRenderedWidth()`.
 */
function safeGetGlyphs(
  font: opentype.Font,
  text: string,
): { glyphs: opentype.Glyph[]; needsShaping: boolean } {
  try {
    return { glyphs: font.stringToGlyphs(text), needsShaping: false };
  } catch {
    return {
      glyphs: [...text].map((ch) => font.charToGlyph(ch)),
      needsShaping: true,
    };
  }
}

// Cache for rendered width measurements (fontPath+text+ppem -> width)
const renderedWidthCache = new Map<string, number>();

/**
 * Measure the actual rendered width of a text string by invoking ffmpeg with
 * the ASS subtitle filter and scanning the output frame for non-black pixels.
 *
 * This is the only reliable way to measure complex-script text (Arabic, Hebrew)
 * where opentype.js can't perform shaping. libass uses HarfBuzz internally
 * which handles Arabic contextual forms and ligatures correctly.
 *
 * Results are cached by (fontPath, text, fontSize) to avoid repeated renders.
 */
export function measureRenderedWidth(
  text: string,
  fontName: string,
  fontDir: string,
  fontSize: number,
  playResX: number = 2000,
): number {
  const cacheKey = `${fontName}|${text}|${fontSize}`;
  const cached = renderedWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const h = Math.ceil(fontSize * 3);
  const assContent = `[Script Info]
PlayResX: ${playResX}
PlayResY: ${h}
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},&HFFFFFF,&H000000FF,&H000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,${text}`;

  const assPath = `/tmp/varg-measure-${Date.now()}.ass`;
  const { writeFileSync, unlinkSync } = require("node:fs");
  writeFileSync(assPath, assContent);

  try {
    // Render to raw RGB pixels
    const proc = Bun.spawnSync([
      "ffmpeg", "-y", "-f", "lavfi",
      "-i", `color=black:s=${playResX}x${h}:d=1:r=1`,
      "-vf", `subtitles='${assPath.replace(/'/g, "'\\''")}':fontsdir='${fontDir}'`,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], { stdout: "pipe", stderr: "pipe" });

    if (proc.exitCode !== 0) {
      // Fallback: return a rough estimate
      const fallback = text.length * fontSize * 0.5;
      renderedWidthCache.set(cacheKey, fallback);
      return fallback;
    }

    const pixels = new Uint8Array(proc.stdout as unknown as ArrayBuffer);
    const w = playResX;
    let minX = w;
    let maxX = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const off = (y * w + x) * 3;
        if (pixels[off]! > 20 || pixels[off + 1]! > 20 || pixels[off + 2]! > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }

    const width = maxX >= minX ? maxX - minX + 1 : text.length * fontSize * 0.5;
    renderedWidthCache.set(cacheKey, width);
    return width;
  } finally {
    try { unlinkSync(assPath); } catch {}
  }
}

/**
 * Render the FULL line of ASS text (with spaces where emoji were removed) and
 * find the X-axis gaps where no text is rendered. Returns the center X of each
 * gap, which is where the emoji overlay should be placed.
 *
 * This is used for lines containing complex-script text (Arabic, Hebrew) where
 * BiDi reordering makes logical character positions unreliable. By scanning the
 * actual rendered pixels we find the true visual location of each space gap.
 *
 * @param taggedText - Full ASS-tagged text with spaces replacing emoji
 * @param primaryFontName - The default ASS style font name
 * @param fontSize - ASS font size
 * @param fontDir - Directory containing font files
 * @param playResX - ASS PlayResX
 * @param alignment - ASS alignment (2=bottom-center, etc.)
 * @param marginL - ASS MarginL
 * @param marginR - ASS MarginR
 * @param marginV - ASS MarginV
 * @param emojiSize - Size of the emoji overlay in pixels
 * @param spacesPerEmoji - Number of spaces that replaced each emoji
 * @param numEmoji - Number of emoji expected (to know how many gaps to find)
 * @returns Array of {x, gapStart, gapEnd} for each emoji, sorted left-to-right
 */
export function measureEmojiGapPositions(
  taggedText: string,
  primaryFontName: string,
  fontSize: number,
  fontDir: string,
  playResX: number,
  playResY: number,
  alignment: number,
  marginL: number,
  marginR: number,
  marginV: number,
  emojiSize: number,
  numEmoji: number = 1,
): { x: number; gapStart: number; gapEnd: number }[] {
  const assContent = `[Script Info]
PlayResX: ${playResX}
PlayResY: ${playResY}
ScaledBorderAndShadow: yes
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${primaryFontName},${fontSize},&HFFFFFF,&H000000FF,&H000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,${alignment},${marginL},${marginR},${marginV},1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:01.00,Default,,0,0,0,,${taggedText}`;

  const assPath = `/tmp/varg-gap-${Date.now()}.ass`;
  const { writeFileSync, unlinkSync } = require("node:fs");
  writeFileSync(assPath, assContent);

  try {
    const proc = Bun.spawnSync([
      "ffmpeg", "-y", "-f", "lavfi",
      "-i", `color=black:s=${playResX}x${playResY}:d=1:r=1`,
      "-vf", `subtitles='${assPath.replace(/'/g, "'\\''")}':fontsdir='${fontDir}'`,
      "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], { stdout: "pipe", stderr: "pipe" });

    if (proc.exitCode !== 0) return [];

    const pixels = new Uint8Array(proc.stdout as unknown as ArrayBuffer);
    const w = playResX;
    const h = playResY;

    // Build a per-column "has text" boolean array by scanning all rows
    const colHasText = new Uint8Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const off = (y * w + x) * 3;
        if (pixels[off]! > 20 || pixels[off + 1]! > 20 || pixels[off + 2]! > 20) {
          colHasText[x] = 1;
        }
      }
    }

    // Find the text extent (leftmost and rightmost text columns)
    let textLeft = -1;
    let textRight = -1;
    for (let x = 0; x < w; x++) {
      if (colHasText[x]) {
        if (textLeft === -1) textLeft = x;
        textRight = x;
      }
    }
    if (textLeft === -1) return []; // no text rendered

    // Find internal gaps: runs of empty columns between text columns
    // A gap must be at least (emojiSize * 0.4) pixels wide to be an emoji gap
    // (to distinguish from normal inter-letter spacing)
    const minGapWidth = emojiSize * 0.4;
    const gaps: { gapStart: number; gapEnd: number; x: number }[] = [];
    let inGap = false;
    let gapStart = 0;

    for (let x = textLeft; x <= textRight; x++) {
      if (!colHasText[x]) {
        if (!inGap) {
          gapStart = x;
          inGap = true;
        }
      } else {
        if (inGap) {
          const gapEnd = x - 1;
          const gapWidth = gapEnd - gapStart + 1;
          if (gapWidth >= minGapWidth) {
            const center = Math.round(gapStart + gapWidth / 2 - emojiSize / 2);
            gaps.push({ gapStart, gapEnd, x: center });
          }
          inGap = false;
        }
      }
    }

    // If we found enough internal gaps, return them
    if (gaps.length >= numEmoji) {
      return gaps;
    }

    // For begin/end emoji: libass trims leading/trailing spaces, so there's
    // no visible gap — the emoji goes at the edge of the visible text.
    // We need to add edge positions for missing emoji.
    const missingCount = numEmoji - gaps.length;
    if (missingCount > 0) {
      // Determine which edges need emoji by checking the logical text structure.
      // The tagged text starts/ends with spaces if there's a begin/end emoji.
      const plainText = taggedText.replace(/\{[^}]*\}/g, ""); // strip ASS tags
      const hasLeadingSpaces = plainText.match(/^ +/);
      const hasTrailingSpaces = plainText.match(/ +$/);

      // For RTL text, visual left = logical end, visual right = logical begin
      // Leading spaces in logical order appear at visual RIGHT for RTL
      // Trailing spaces in logical order appear at visual LEFT for RTL
      if (hasLeadingSpaces && missingCount > 0) {
        // Begin emoji: place at the visual RIGHT edge of text
        const x = Math.round(textRight + 1 + (emojiSize * 0.1));
        gaps.push({ gapStart: textRight + 1, gapEnd: textRight + emojiSize, x });
      }
      if (hasTrailingSpaces && gaps.length < numEmoji) {
        // End emoji: place at the visual LEFT edge of text
        const x = Math.round(textLeft - emojiSize - (emojiSize * 0.1));
        gaps.unshift({ gapStart: textLeft - emojiSize, gapEnd: textLeft - 1, x });
      }
    }

    // Sort left-to-right
    gaps.sort((a, b) => a.gapStart - b.gapStart);
    return gaps.slice(0, numEmoji);
  } finally {
    try { unlinkSync(assPath); } catch {}
  }
}

// ---------------------------------------------------------------------------
// libass font size conversion
// ---------------------------------------------------------------------------

/**
 * Compute the effective pixels-per-em (ppem) that libass uses internally.
 *
 * libass calls FT_Request_Size with FT_SIZE_REQUEST_TYPE_REAL_DIM, which
 * means the ASS fontSize specifies the full cell height (usWinAscent +
 * usWinDescent), not the em square. The actual ppem is smaller.
 *
 * @param fontPath - Local path to TTF/OTF file
 * @param assFontSize - The fontSize from the ASS style (in PlayRes units)
 * @returns Effective ppem for use with opentype.js advance width calculations
 */
export function getEffectivePpem(
  fontPath: string,
  assFontSize: number,
): number {
  const font = loadFont(fontPath);
  const os2 = font.tables?.os2;
  if (!os2) return assFontSize;
  const winAscent: number = os2.usWinAscent ?? 0;
  const winDescent: number = os2.usWinDescent ?? 0;
  const cellHeight = winAscent + winDescent;
  if (cellHeight === 0) return assFontSize;
  return (assFontSize * font.unitsPerEm) / cellHeight;
}

/**
 * Get font vertical metrics for emoji sizing and Y positioning.
 *
 * @param fontPath - Local path to TTF/OTF file
 * @param assFontSize - The fontSize from the ASS style
 * @returns Cap height, ascent, descent in pixels at the effective ppem
 */
export function getFontMetrics(
  fontPath: string,
  assFontSize: number,
): {
  ppem: number;
  capHeight: number;
  winAscent: number;
  winDescent: number;
} {
  const font = loadFont(fontPath);
  const os2 = font.tables?.os2;
  const winAsc: number = os2?.usWinAscent ?? 0;
  const winDesc: number = os2?.usWinDescent ?? 0;
  const cellHeight = winAsc + winDesc;
  const ppem =
    cellHeight > 0
      ? (assFontSize * font.unitsPerEm) / cellHeight
      : assFontSize;

  return {
    ppem,
    capHeight: (((os2?.sCapHeight ?? 700) * ppem) / font.unitsPerEm),
    winAscent: (winAsc * ppem) / font.unitsPerEm,
    winDescent: (winDesc * ppem) / font.unitsPerEm,
  };
}

// ---------------------------------------------------------------------------
// Segment parsing
// ---------------------------------------------------------------------------

/** A segment of text rendered with a single font. */
export interface TextSegment {
  /** ASS font family name (e.g. "Montserrat", "Noto Sans CJK JP") */
  fontName: string;
  /** The text content of this segment (no ASS tags) */
  text: string;
}

/**
 * Parse ASS-tagged text into segments of (fontName, text).
 *
 * ASS override tags like `{\fnFontName}` switch the active font.
 * Non-font tags (like `{\c&H...}`) are stripped from the text.
 */
export function parseASSSegments(
  taggedText: string,
  defaultFontName: string,
): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentFont = defaultFontName;
  let currentText = "";

  const tagRegex = /\{([^}]*)\}/g;
  let lastIndex = 0;

  for (
    let match = tagRegex.exec(taggedText);
    match !== null;
    match = tagRegex.exec(taggedText)
  ) {
    const textBefore = taggedText.slice(lastIndex, match.index);
    if (textBefore.length > 0) {
      currentText += textBefore;
    }

    const tagContent = match[1]!;
    const fnMatch = tagContent.match(/\\fn([^\\}]*)/);
    if (fnMatch) {
      if (currentText.length > 0) {
        segments.push({ fontName: currentFont, text: currentText });
        currentText = "";
      }
      currentFont = fnMatch[1]!;
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = taggedText.slice(lastIndex);
  if (remaining.length > 0) {
    currentText += remaining;
  }
  if (currentText.length > 0) {
    segments.push({ fontName: currentFont, text: currentText });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Text measurement
// ---------------------------------------------------------------------------

/**
 * Mapping from ASS font family name to local file path.
 */
export type FontPathMap = Map<string, string>;

/**
 * Get the advance width of a space character as rendered by libass.
 *
 * @param fontPath - Local path to the TTF/OTF file
 * @param assFontSize - The ASS fontSize (full cell height, not ppem)
 */
export function getSpaceWidth(
  fontPath: string,
  assFontSize: number,
): number {
  const ppem = getEffectivePpem(fontPath, assFontSize);
  const font = loadFont(fontPath);
  return font.getAdvanceWidth(" ", ppem);
}

/**
 * Derive the font directory from any font path in the map.
 */
function getFontDir(fontPaths: FontPathMap): string {
  for (const p of fontPaths.values()) {
    return p.substring(0, p.lastIndexOf("/"));
  }
  return "/tmp/varg-caption-fonts";
}

/**
 * Compute the total width of a line of ASS-tagged text as rendered by libass.
 */
export function measureLineWidth(
  segments: TextSegment[],
  fontPaths: FontPathMap,
  assFontSize: number,
): number {
  let totalWidth = 0;
  const fontDir = getFontDir(fontPaths);
  for (const seg of segments) {
    const fontPath = fontPaths.get(seg.fontName);
    if (!fontPath) {
      const ppem = assFontSize * 0.64; // rough fallback
      totalWidth += seg.text.length * ppem * 0.5;
      continue;
    }
    const ppem = getEffectivePpem(fontPath, assFontSize);
    const font = loadFont(fontPath);
    const { glyphs, needsShaping } = safeGetGlyphs(font, seg.text);
    if (needsShaping) {
      // Use ffmpeg to measure the actual shaped width
      totalWidth += measureRenderedWidth(
        `{\\fn${seg.fontName}}${seg.text}`,
        seg.fontName,
        fontDir,
        assFontSize,
      );
    } else {
      for (const g of glyphs) {
        totalWidth += (g.advanceWidth ?? 0) * (ppem / font.unitsPerEm);
      }
    }
  }
  return totalWidth;
}

/**
 * Compute the X position of every character in a line, matching libass layout.
 *
 * For center alignment, libass centers within (PlayResX - MarginL - MarginR)
 * starting at MarginL.
 */
export function getCharXPositions(
  segments: TextSegment[],
  fontPaths: FontPathMap,
  assFontSize: number,
  playResX: number,
  alignment: number = 2,
  marginL: number = 10,
  marginR: number = 10,
): number[] {
  // Step 1: per-character advance widths at the correct effective ppem
  const advances: number[] = [];
  for (const seg of segments) {
    const fontPath = fontPaths.get(seg.fontName);
    if (!fontPath) {
      const ppem = assFontSize * 0.64;
      for (const _char of seg.text) {
        advances.push(ppem * 0.5);
      }
      continue;
    }
    const ppem = getEffectivePpem(fontPath, assFontSize);
    const font = loadFont(fontPath);
    const { glyphs, needsShaping } = safeGetGlyphs(font, seg.text);
    if (needsShaping) {
      // Complex script (Arabic, etc.): measure real rendered width via ffmpeg
      // and distribute evenly across characters
      const fontDir = getFontDir(fontPaths);
      const renderedWidth = measureRenderedWidth(
        `{\\fn${seg.fontName}}${seg.text}`,
        seg.fontName,
        fontDir,
        assFontSize,
      );
      const charCount = [...seg.text].length;
      const perChar = charCount > 0 ? renderedWidth / charCount : 0;
      for (const _ch of seg.text) {
        advances.push(perChar);
      }
    } else {
      for (let i = 0; i < glyphs.length; i++) {
        const glyph = glyphs[i]!;
        let advance = (glyph.advanceWidth ?? 0) * (ppem / font.unitsPerEm);
        if (i < glyphs.length - 1) {
          const kerning = font.getKerningValue(glyph, glyphs[i + 1]!);
          advance += kerning * (ppem / font.unitsPerEm);
        }
        advances.push(advance);
      }
    }
  }

  // Step 2: total line width
  const totalWidth = advances.reduce((sum, w) => sum + w, 0);

  // Step 2b: Compute trimmed width for alignment (matching libass behavior).
  // libass's trim_whitespace() marks leading and trailing space glyphs with
  // skip=true, and align_lines() excludes skipped glyphs from the width used
  // for center/right alignment. The trimmed glyphs still occupy space in the
  // layout — they just don't count toward the centering width.
  const allChars: string[] = [];
  for (const seg of segments) {
    for (const char of seg.text) {
      allChars.push(char);
    }
  }

  let leadingSpacesWidth = 0;
  let trailingSpacesWidth = 0;

  // Count leading whitespace width
  let leadIdx = 0;
  while (leadIdx < allChars.length && allChars[leadIdx] === " ") {
    leadingSpacesWidth += advances[leadIdx]!;
    leadIdx++;
  }
  // Count trailing whitespace width
  let trailIdx = allChars.length - 1;
  while (trailIdx >= leadIdx && allChars[trailIdx] === " ") {
    trailingSpacesWidth += advances[trailIdx]!;
    trailIdx--;
  }

  const trimmedWidth = totalWidth - leadingSpacesWidth - trailingSpacesWidth;

  // Step 3: start X based on alignment (matching libass align_lines)
  // libass uses the trimmed width for alignment, then applies the shift
  // to ALL glyphs (including the skipped leading/trailing spaces).
  const hAlign = (alignment - 1) % 3; // 0=left, 1=center, 2=right
  const maxTextWidth = playResX - marginL - marginR;
  let startX: number;
  if (hAlign === 1) {
    // Center: shift = (maxTextWidth - trimmedWidth) / 2
    // This shift positions the first VISIBLE (non-space) character.
    // Leading spaces precede it, so the actual cursor start is further left.
    startX = marginL + (maxTextWidth - trimmedWidth) / 2 - leadingSpacesWidth;
  } else if (hAlign === 2) {
    // Right: shift = maxTextWidth - trimmedWidth
    startX = marginL + maxTextWidth - trimmedWidth - leadingSpacesWidth;
  } else {
    startX = marginL;
  }

  // Step 4: cumulative positions
  const positions: number[] = [];
  let cursor = startX;
  for (const advance of advances) {
    positions.push(cursor);
    cursor += advance;
  }

  return positions;
}

/**
 * Compute per-character advance widths matching libass rendering.
 */
export function getCharAdvances(
  text: string,
  fontPath: string,
  assFontSize: number,
): number[] {
  const ppem = getEffectivePpem(fontPath, assFontSize);
  const font = loadFont(fontPath);
  const { glyphs, needsShaping } = safeGetGlyphs(font, text);
  const advances: number[] = [];
  if (needsShaping) {
    // Complex script fallback: uniform advances based on unshaped widths
    for (const g of glyphs) {
      advances.push((g.advanceWidth ?? 0) * (ppem / font.unitsPerEm));
    }
  } else {
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i]!;
      let advance = (glyph.advanceWidth ?? 0) * (ppem / font.unitsPerEm);
      if (i < glyphs.length - 1) {
        const kerning = font.getKerningValue(glyph, glyphs[i + 1]!);
        advance += kerning * (ppem / font.unitsPerEm);
      }
      advances.push(advance);
    }
  }
  return advances;
}
