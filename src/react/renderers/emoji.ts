/**
 * Emoji image overlay for caption rendering.
 *
 * Since libass (used by ffmpeg's subtitles filter) cannot render color emoji
 * from any font format, we extract emoji from caption text, replace them with
 * spaces in the ASS subtitle, and overlay the emoji as PNG images using
 * ffmpeg's overlay filter.
 *
 * Emoji PNGs are Apple-style, extracted from Apple Color Emoji and hosted
 * on s3.varg.ai/emoji/{codepoint}.png (96x96 px with transparency).
 */

const EMOJI_S3_BASE = "https://s3.varg.ai/emoji";

// Regex to match emoji characters (SMP pictographic emoji + common BMP emoji)
// This covers:
// - Emoticons (1F600-1F64F)
// - Misc symbols and pictographs (1F300-1F5FF)
// - Transport and map symbols (1F680-1F6FF)
// - Supplemental symbols (1F900-1F9FF)
// - Symbols extended-A (1FA00-1FAFF)
// - Misc symbols (2600-26FF)
// - Dingbats (2700-27BF)
// - Various BMP emoji (2B50, 2705, etc.)
// Also handles variation selectors (FE0F) and ZWJ (200D) sequences
const EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

export interface EmojiInstance {
  /** The emoji string (may be multi-codepoint for ZWJ sequences) */
  emoji: string;
  /** Hex codepoint(s) for the S3 filename (e.g. "1f4aa" or "1f468-200d-1f469") */
  codepoints: string;
  /** URL of the emoji PNG on S3 */
  url: string;
  /** Character index in the original text where this emoji starts */
  charIndex: number;
}

export interface EmojiOverlay {
  /** The emoji PNG URL */
  url: string;
  /** The emoji PNG filename */
  fileName: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** X position in pixels (from left) */
  x: number;
  /** Y position in pixels (from top) */
  y: number;
  /** Size in pixels (width = height, emoji are square) */
  size: number;
}

/**
 * Strip emoji from text, replacing each emoji with a space character.
 * This reserves horizontal space in the rendered subtitle.
 */
export function stripEmoji(text: string): string {
  EMOJI_REGEX.lastIndex = 0;
  return text.replace(EMOJI_REGEX, " ");
}

/**
 * Extract emoji from text, returning their codepoints and positions.
 *
 * The `charIndex` in the result corresponds to the position in the
 * STRIPPED text (where each emoji is replaced by a single space).
 * This is the index needed for X-position calculation.
 */
export function extractEmoji(text: string): EmojiInstance[] {
  const results: EmojiInstance[] = [];

  // Reset regex state
  EMOJI_REGEX.lastIndex = 0;

  // Track how many characters have been "shrunk" by emoji → space replacement
  // Each emoji (possibly multi-char in JS) gets replaced by one space
  let shrinkage = 0;

  for (
    let match = EMOJI_REGEX.exec(text);
    match !== null;
    match = EMOJI_REGEX.exec(text)
  ) {
    const emoji = match[0];
    // Build codepoint filename: strip variation selectors (FE0F) for lookup
    const cps: number[] = [];
    for (const char of emoji) {
      const cp = char.codePointAt(0);
      if (cp === undefined) continue;
      // Skip variation selectors — S3 filenames don't include them
      if (cp === 0xfe0f) continue;
      cps.push(cp);
    }
    const codepoints = cps.map((cp) => cp.toString(16)).join("-");

    // Position in the stripped text: original index minus accumulated shrinkage
    const strippedIndex = match.index - shrinkage;

    results.push({
      emoji,
      codepoints,
      url: `${EMOJI_S3_BASE}/${codepoints}.png`,
      charIndex: strippedIndex,
    });

    // This emoji occupies emoji.length chars in original but 1 space in stripped
    shrinkage += emoji.length - 1;
  }

  return results;
}

/**
 * Rendered emoji size in pixels, given the ASS font size and video dimensions.
 *
 * ASS fontSize doesn't map 1:1 to rendered pixel height — libass applies its
 * own scaling. Empirically, the rendered text height is ~0.55x the ASS fontSize
 * when PlayRes matches the video resolution (the common case in our pipeline).
 */
export function calculateEmojiSize(
  fontSize: number,
  playResY: number,
  videoHeight: number,
): number {
  const scale = videoHeight / playResY;
  // Emoji should be slightly larger than text cap-height for visual balance
  return Math.round(fontSize * 0.55 * scale);
}

/**
 * Calculate the X position of a character within a rendered subtitle line.
 *
 * Uses the empirical character width ratio for bold sans-serif fonts rendered
 * by libass. The ratio is ~0.38 * fontSize (in PlayRes units).
 *
 * @param charIndex - Index of the character in the text string (after emoji stripping)
 * @param textLength - Total number of characters in the text
 * @param fontSize - ASS font size (in PlayRes units)
 * @param playResX - ASS PlayResX (horizontal resolution)
 * @param videoWidth - Actual video width in pixels
 */
export function calculateEmojiX(
  charIndex: number,
  textLength: number,
  fontSize: number,
  playResX: number,
  videoWidth: number,
): number {
  // Empirical average character width for bold sans-serif in libass
  const charWidth = fontSize * 0.38;
  const totalTextWidth = textLength * charWidth;

  // For center-aligned text (Alignment 2, 5, or 8):
  const textStartX = playResX / 2 - totalTextWidth / 2;
  const emojiX = textStartX + charIndex * charWidth;

  const scale = videoWidth / playResX;
  return Math.round(emojiX * scale);
}

/**
 * Calculate the Y position of the emoji based on ASS alignment and margins.
 *
 * @param alignment - ASS alignment (2=bottom-center, 5=center, 8=top-center)
 * @param marginV - ASS vertical margin
 * @param fontSize - ASS font size
 * @param playResY - ASS PlayResY
 * @param videoHeight - Actual video height
 */
export function calculateEmojiY(
  alignment: number,
  marginV: number,
  fontSize: number,
  playResY: number,
  videoHeight: number,
): number {
  const scale = videoHeight / playResY;
  let y: number;

  if (alignment >= 7) {
    // Top alignment (7, 8, 9)
    y = marginV;
  } else if (alignment >= 4) {
    // Center alignment (4, 5, 6)
    y = playResY / 2 - (fontSize * 0.55) / 2;
  } else {
    // Bottom alignment (1, 2, 3)
    // Empirical: text baseline sits at playResY - marginV - fontSize*0.75
    y = playResY - marginV - fontSize * 0.75;
  }

  return Math.round(y * scale);
}

/**
 * Build the ffmpeg filter_complex string for emoji overlays.
 *
 * The filter chain:
 * 1. Apply subtitles filter to burn text captions
 * 2. For each emoji, overlay its PNG at the calculated position with timing
 *
 * @param subtitlesFilter - The subtitles= filter string (already built)
 * @param overlays - Array of emoji overlay descriptors
 * @param inputCount - Number of existing inputs (video + ASS = 2)
 * @returns The complete filter_complex string
 */
export function buildEmojiFilterComplex(
  subtitlesFilter: string,
  overlays: EmojiOverlay[],
  inputCount: number,
): string {
  if (overlays.length === 0) {
    // No emoji — just return the subtitles filter as a videoFilter
    return subtitlesFilter;
  }

  const parts: string[] = [];

  // Step 1: Apply subtitles filter
  parts.push(`[0:v]${subtitlesFilter}[sub]`);

  // Step 2: Scale and overlay each emoji PNG
  let prevLabel = "sub";
  for (let i = 0; i < overlays.length; i++) {
    const overlay = overlays[i];
    if (!overlay) continue;
    const inputIdx = inputCount + i; // emoji inputs start after video + ASS
    const nextLabel = i === overlays.length - 1 ? "vout" : `v${i}`;

    // Scale emoji PNG to match font size, then overlay with timing
    const scaleFilter = `[${inputIdx}:v]scale=${overlay.size}:${overlay.size}:flags=lanczos,format=rgba[emoji${i}]`;
    parts.push(scaleFilter);

    const overlayFilter =
      `[${prevLabel}][emoji${i}]overlay=x=${overlay.x}:y=${overlay.y}` +
      `:enable='between(t,${overlay.startTime.toFixed(2)},${overlay.endTime.toFixed(2)})'` +
      `[${nextLabel}]`;
    parts.push(overlayFilter);
    prevLabel = nextLabel;
  }

  return parts.join(";");
}
