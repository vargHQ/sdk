/**
 * Language-aware word segmentation utilities.
 *
 * Uses `Intl.Segmenter` (ICU-backed, zero dependencies) to handle languages
 * that don't use spaces between words: Japanese, Chinese, Thai, Khmer, etc.
 *
 * For Latin/Cyrillic/Arabic/Korean and other space-delimited scripts, simple
 * whitespace splitting is equivalent — but `Intl.Segmenter` handles them too,
 * so we use a single code path for all languages.
 */

// ---------------------------------------------------------------------------
// Script detection helpers
// ---------------------------------------------------------------------------

/**
 * Check if a code point belongs to a script that doesn't use spaces between words.
 *
 * Covers: CJK ideographs, Hiragana, Katakana, Thai, Lao, Myanmar, Khmer, Tibetan.
 * Does NOT include Korean (Hangul) — Korean uses spaces between words.
 */
export function isSpacelessScript(cp: number): boolean {
  // Hiragana
  if (cp >= 0x3040 && cp <= 0x309f) return true;
  // Katakana
  if (cp >= 0x30a0 && cp <= 0x30ff) return true;
  if (cp >= 0x31f0 && cp <= 0x31ff) return true; // Katakana Phonetic Extensions
  if (cp >= 0xff65 && cp <= 0xff9f) return true; // Halfwidth Katakana
  // CJK Unified Ideographs
  if (cp >= 0x4e00 && cp <= 0x9fff) return true;
  if (cp >= 0x3400 && cp <= 0x4dbf) return true; // Extension A
  if (cp >= 0xf900 && cp <= 0xfaff) return true; // Compatibility
  if (cp >= 0x20000 && cp <= 0x2a6df) return true; // Extension B
  if (cp >= 0x2a700 && cp <= 0x2b73f) return true; // Extension C
  if (cp >= 0x2b740 && cp <= 0x2b81f) return true; // Extension D
  // CJK Radicals
  if (cp >= 0x2e80 && cp <= 0x2eff) return true;
  if (cp >= 0x2f00 && cp <= 0x2fdf) return true;
  // Thai
  if (cp >= 0x0e00 && cp <= 0x0e7f) return true;
  // Lao
  if (cp >= 0x0e80 && cp <= 0x0eff) return true;
  // Myanmar
  if (cp >= 0x1000 && cp <= 0x109f) return true;
  // Khmer
  if (cp >= 0x1780 && cp <= 0x17ff) return true;
  // Tibetan
  if (cp >= 0x0f00 && cp <= 0x0fff) return true;

  return false;
}

/**
 * Check if a string contains any characters from spaceless scripts.
 * Used as a fast gate to decide whether we need `Intl.Segmenter`.
 */
export function hasSpacelessChars(text: string): boolean {
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && isSpacelessScript(cp)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Intl.Segmenter-based word segmentation
// ---------------------------------------------------------------------------

interface WordSegment {
  /** The word text. */
  word: string;
  /** Character offset in the original string (code-unit index). */
  index: number;
  /** Length in code units. */
  length: number;
}

/** Cached segmenter instance (default locale, word granularity). */
let _segmenter: Intl.Segmenter | undefined;

function getSegmenter(): Intl.Segmenter {
  if (!_segmenter) {
    _segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
  }
  return _segmenter;
}

/**
 * Segment text into word-like tokens using `Intl.Segmenter`.
 *
 * Returns only word-like segments (no punctuation-only or whitespace segments).
 * Works correctly for all languages including Japanese, Chinese, Thai, Korean,
 * Arabic, Hindi, etc.
 */
export function segmentWords(text: string): WordSegment[] {
  const segmenter = getSegmenter();
  const result: WordSegment[] = [];
  for (const seg of segmenter.segment(text)) {
    if (seg.isWordLike) {
      result.push({
        word: seg.segment,
        index: seg.index,
        length: seg.segment.length,
      });
    }
  }
  return result;
}

/**
 * Count the number of word-like tokens in a string.
 *
 * Uses `Intl.Segmenter` for spaceless scripts, whitespace splitting for others.
 * This matches the word count from `segmentWords()` / `parseElevenLabsAlignment()`.
 */
export function countWords(text: string): number {
  if (hasSpacelessChars(text)) {
    return segmentWords(text).length;
  }
  // Fast path for space-delimited scripts
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Smart join — language-aware word concatenation
// ---------------------------------------------------------------------------

/**
 * Join words without inserting incorrect spaces between CJK/Thai tokens.
 *
 * Rules:
 * - Between two spaceless-script tokens → no space (日本語 + テスト → 日本語テスト)
 * - Between a spaceless-script token and a Latin token → no space (Varg + は → Vargは)
 * - Between two Latin/Cyrillic/etc. tokens → space (Hello + world → Hello world)
 *
 * This matches how the original text would look — CJK/Thai don't use spaces.
 */
export function smartJoin(words: string[]): string {
  if (words.length === 0) return "";
  if (words.length === 1) return words[0]!;

  let result = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1]!;
    const curr = words[i]!;

    // Check the last char of prev and first char of curr
    const prevLastCp = lastCodePoint(prev);
    const currFirstCp = curr.codePointAt(0) ?? 0;

    // No space if either side is a spaceless script character
    const needsSpace =
      !isSpacelessScript(prevLastCp) && !isSpacelessScript(currFirstCp);

    result += needsSpace ? ` ${curr}` : curr;
  }
  return result;
}

/**
 * Get the last code point of a string.
 */
function lastCodePoint(s: string): number {
  if (s.length === 0) return 0;
  // Handle surrogate pairs
  const last = s.codePointAt(s.length - 1);
  if (last !== undefined && last >= 0xdc00 && last <= 0xdfff && s.length >= 2) {
    // Low surrogate — the actual code point starts one position earlier
    return s.codePointAt(s.length - 2) ?? 0;
  }
  return last ?? 0;
}
