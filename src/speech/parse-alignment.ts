import type { ElevenLabsCharacterAlignment, WordTiming } from "./types";

/**
 * Convert ElevenLabs character-level alignment to word-level timing.
 *
 * ElevenLabs returns arrays of individual characters with start/end times.
 * This function groups consecutive non-whitespace characters into words
 * and computes each word's start (first char start) and end (last char end).
 *
 * @example
 * ```ts
 * const alignment = {
 *   characters: ["H","e","l","l","o"," ","w","o","r","l","d"],
 *   character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55],
 *   character_end_times_seconds:   [0.05, 0.1, 0.15, 0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.65],
 * };
 * const words = parseElevenLabsAlignment(alignment);
 * // [{word: "Hello", start: 0, end: 0.3}, {word: "world", start: 0.35, end: 0.65}]
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

  const words: WordTiming[] = [];
  let wordChars = "";
  let wordStart = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]!;
    const startTime = character_start_times_seconds[i]!;
    const isWhitespace =
      char === " " || char === "\n" || char === "\t" || char === "\r";

    if (isWhitespace) {
      // Flush accumulated word
      if (wordChars) {
        words.push({
          word: wordChars,
          start: wordStart,
          end: character_end_times_seconds[i - 1] ?? wordStart,
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
    const lastEnd = character_end_times_seconds[characters.length - 1];
    words.push({
      word: wordChars,
      start: wordStart,
      end: lastEnd ?? wordStart,
    });
  }

  return words;
}
