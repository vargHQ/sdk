import type { ElevenLabsCharacterAlignment, WordTiming } from "./types";
import { hasSpacelessChars, segmentWords } from "./word-segmenter";

/**
 * Convert ElevenLabs character-level alignment to word-level timing.
 *
 * ElevenLabs returns arrays of individual characters with start/end times.
 * This function groups characters into words and computes each word's
 * start (first char start) and end (last char end).
 *
 * For languages that use spaces (English, Arabic, Korean, etc.), words are
 * split at whitespace boundaries — same as before.
 *
 * For spaceless-script languages (Japanese, Chinese, Thai, etc.), we use
 * `Intl.Segmenter` (ICU-backed) to find linguistically correct word
 * boundaries, then map each word back to the character-level timing data.
 *
 * @example
 * ```ts
 * // English
 * const alignment = {
 *   characters: ["H","e","l","l","o"," ","w","o","r","l","d"],
 *   character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
 *   character_end_times_seconds:   [0.05, 0.1, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.65],
 * };
 * parseElevenLabsAlignment(alignment);
 * // [{word: "Hello", start: 0, end: 0.3}, {word: "world", start: 0.35, end: 0.65}]
 *
 * // Japanese — "これはテストです" → ["これ", "は", "テスト", "です"]
 * // Each word gets precise timing from the character-level data.
 * ```
 */
export function parseElevenLabsAlignment(
  alignment: ElevenLabsCharacterAlignment,
): WordTiming[] {
  const {
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  } = alignment;

  if (
    !characters?.length ||
    !character_start_times_seconds?.length ||
    !character_end_times_seconds?.length
  ) {
    return [];
  }

  // Reconstruct the full text and check if it contains spaceless scripts
  const fullText = characters.join("");

  if (hasSpacelessChars(fullText)) {
    return parseWithSegmenter(
      fullText,
      characters,
      character_start_times_seconds,
      character_end_times_seconds,
    );
  }

  return parseByWhitespace(
    characters,
    character_start_times_seconds,
    character_end_times_seconds,
  );
}

/**
 * Original whitespace-based parsing for space-delimited languages.
 */
function parseByWhitespace(
  characters: string[],
  startTimes: number[],
  endTimes: number[],
): WordTiming[] {
  const words: WordTiming[] = [];
  let wordChars = "";
  let wordStart = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]!;
    const startTime = startTimes[i]!;
    const isWhitespace =
      char === " " || char === "\n" || char === "\t" || char === "\r";

    if (isWhitespace) {
      // Flush accumulated word
      if (wordChars) {
        words.push({
          word: wordChars,
          start: wordStart,
          end: endTimes[i - 1] ?? wordStart,
        });
        wordChars = "";
      }
    } else {
      if (!wordChars) {
        // Start of a new word
        wordStart = startTime;
      }
      wordChars += char;
    }
  }

  // Flush final word
  if (wordChars) {
    const lastEnd = endTimes[characters.length - 1];
    words.push({
      word: wordChars,
      start: wordStart,
      end: lastEnd ?? wordStart,
    });
  }

  return words;
}

/**
 * Intl.Segmenter-based parsing for text containing spaceless scripts.
 *
 * Steps:
 * 1. Build a mapping from each code-unit offset in the full text to its
 *    index in the ElevenLabs character arrays (handling multi-char graphemes).
 * 2. Use `Intl.Segmenter` to find word boundaries in the full text.
 * 3. For each word-like segment, look up the start time of its first character
 *    and the end time of its last character from the alignment data.
 */
function parseWithSegmenter(
  fullText: string,
  characters: string[],
  startTimes: number[],
  endTimes: number[],
): WordTiming[] {
  // Build a mapping: code-unit offset in fullText → character array index.
  // ElevenLabs characters may be single code points or multi-code-unit chars
  // (e.g., emoji), so we track offsets carefully.
  const offsetToCharIndex = new Map<number, number>();
  let offset = 0;
  for (let ci = 0; ci < characters.length; ci++) {
    offsetToCharIndex.set(offset, ci);
    offset += characters[ci]!.length;
  }

  // Segment the full text into words
  const segments = segmentWords(fullText);

  const words: WordTiming[] = [];
  for (const seg of segments) {
    // Find the character indices for this segment's boundaries
    const segStart = seg.index;
    const segEnd = seg.index + seg.length;

    // Find the first character index in this segment
    let firstCharIdx: number | undefined;
    let lastCharIdx: number | undefined;

    // Walk through offsets to find all char indices within this segment
    for (const [off, ci] of offsetToCharIndex) {
      if (off >= segStart && off < segEnd) {
        if (firstCharIdx === undefined || ci < firstCharIdx) {
          firstCharIdx = ci;
        }
        if (lastCharIdx === undefined || ci > lastCharIdx) {
          lastCharIdx = ci;
        }
      }
    }

    if (firstCharIdx === undefined || lastCharIdx === undefined) continue;

    const wordStart = startTimes[firstCharIdx] ?? 0;
    const wordEnd = endTimes[lastCharIdx] ?? wordStart;

    words.push({
      word: seg.word,
      start: wordStart,
      end: wordEnd,
    });
  }

  return words;
}
