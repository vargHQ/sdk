import type { SegmentDescriptor, WordTiming } from "./types";

/**
 * Map word-level timings back to the original string array to produce segments.
 *
 * The input text was formed by joining `children` with a single space separator
 * before sending to ElevenLabs. This function reconstructs which words belong
 * to which original segment by counting words in each child string.
 *
 * @param words - Word-level timing data from `parseElevenLabsAlignment()`
 * @param children - The original string array passed as Speech children
 * @returns Array of segment descriptors with start/end timestamps
 *
 * @example
 * ```ts
 * const words = [
 *   {word: "Welcome", start: 0, end: 0.5},
 *   {word: "everyone.", start: 0.6, end: 1.2},
 *   {word: "Main", start: 1.4, end: 1.7},
 *   {word: "content.", start: 1.8, end: 2.3},
 *   {word: "Thanks.", start: 2.5, end: 3.0},
 * ];
 * const segments = mapWordsToSegments(words, [
 *   "Welcome everyone.",
 *   "Main content.",
 *   "Thanks.",
 * ]);
 * // [
 * //   {text: "Welcome everyone.", start: 0, end: 1.2, duration: 1.2},
 * //   {text: "Main content.", start: 1.4, end: 2.3, duration: 0.9},
 * //   {text: "Thanks.", start: 2.5, end: 3.0, duration: 0.5},
 * // ]
 * ```
 */
export function mapWordsToSegments(
  words: WordTiming[],
  children: string[],
): SegmentDescriptor[] {
  if (!words.length || !children.length) return [];

  const firstWord = words[0]!;
  const lastWord = words[words.length - 1]!;

  // Single child -> one segment spanning the entire audio
  if (children.length === 1) {
    return [
      {
        text: children[0]!,
        start: firstWord.start,
        end: lastWord.end,
        duration: lastWord.end - firstWord.start,
      },
    ];
  }

  const segments: SegmentDescriptor[] = [];
  let wordIndex = 0;

  for (const text of children) {
    // Count how many words are in this segment's original text.
    // Split on whitespace, filter empties (handles multiple spaces, leading/trailing).
    const segmentWordCount = text.trim().split(/\s+/).filter(Boolean).length;

    if (segmentWordCount === 0) {
      // Empty segment -> zero duration at the current position
      const pos =
        wordIndex < words.length ? words[wordIndex]!.start : lastWord.end;
      segments.push({ text, start: pos, end: pos, duration: 0 });
      continue;
    }

    // If we've run out of words (more segments than words), clamp
    if (wordIndex >= words.length) {
      segments.push({
        text,
        start: lastWord.end,
        end: lastWord.end,
        duration: 0,
      });
      continue;
    }

    const segStart = words[wordIndex]!.start;

    // Advance through words for this segment. Clamp to available words.
    const endWordIndex = Math.min(
      wordIndex + segmentWordCount - 1,
      words.length - 1,
    );
    const segEnd = words[endWordIndex]!.end;

    segments.push({
      text,
      start: segStart,
      end: segEnd,
      duration: segEnd - segStart,
    });

    wordIndex += segmentWordCount;
  }

  return segments;
}
