import type { SegmentDescriptor, WordTiming } from "./types";
import { countWords } from "./word-segmenter";

/**
 * Map word-level timings back to the original string array to produce segments.
 *
 * The input text was formed by joining `children` with a single space separator
 * before sending to ElevenLabs. This function reconstructs which words belong
 * to which original segment by counting words in each child string.
 *
 * After computing raw boundaries from word timing, adjacent segments are expanded
 * to absorb the natural inter-sentence gaps. Each gap is split at its midpoint:
 * the first half extends the preceding segment, the second half pulls back the
 * following segment. This ensures no silence is lost when clips are placed
 * back-to-back.
 *
 * @param words - Word-level timing data from `parseElevenLabsAlignment()`
 * @param children - The original string array passed as Speech children
 * @param audioDuration - Total audio duration (extends last segment to include trailing silence)
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
 * ], 3.2);
 * // Boundaries expanded: segments touch at midpoints of original gaps
 * // [
 * //   {text: "Welcome everyone.", start: 0, end: 1.3, duration: 1.3},
 * //   {text: "Main content.", start: 1.3, end: 2.4, duration: 1.1},
 * //   {text: "Thanks.", start: 2.4, end: 3.2, duration: 0.8},
 * // ]
 * ```
 */
export function mapWordsToSegments(
  words: WordTiming[],
  children: string[],
  audioDuration?: number,
): SegmentDescriptor[] {
  if (!words.length || !children.length) return [];

  const firstWord = words[0]!;
  const lastWord = words[words.length - 1]!;

  // Single child -> one segment spanning the entire audio
  if (children.length === 1) {
    return [
      {
        text: children[0]!,
        start: 0,
        end: audioDuration ?? lastWord.end,
        duration: (audioDuration ?? lastWord.end) - 0,
      },
    ];
  }

  // --- Pass 1: compute raw segment boundaries from word timing ---
  const raw: SegmentDescriptor[] = [];
  let wordIndex = 0;

  for (const text of children) {
    const segmentWordCount = countWords(text);

    if (segmentWordCount === 0) {
      const pos =
        wordIndex < words.length ? words[wordIndex]!.start : lastWord.end;
      raw.push({ text, start: pos, end: pos, duration: 0 });
      continue;
    }

    if (wordIndex >= words.length) {
      raw.push({
        text,
        start: lastWord.end,
        end: lastWord.end,
        duration: 0,
      });
      continue;
    }

    const segStart = words[wordIndex]!.start;
    const endWordIndex = Math.min(
      wordIndex + segmentWordCount - 1,
      words.length - 1,
    );
    const segEnd = words[endWordIndex]!.end;

    raw.push({
      text,
      start: segStart,
      end: segEnd,
      duration: segEnd - segStart,
    });
    wordIndex += segmentWordCount;
  }

  // --- Pass 2: absorb inter-segment gaps ---
  // Split each gap at its midpoint so adjacent segments touch seamlessly.
  // First segment starts at 0, last segment extends to audioDuration.
  const expanded: SegmentDescriptor[] = [];

  for (let i = 0; i < raw.length; i++) {
    const seg = raw[i]!;

    // Skip zero-duration segments (empty text)
    if (seg.duration === 0) {
      expanded.push(seg);
      continue;
    }

    let start = seg.start;
    let end = seg.end;

    if (i === 0) {
      // First segment: start from the very beginning
      start = 0;
    } else {
      // Absorb gap from previous segment: pull start to midpoint of gap
      const prev = raw[i - 1]!;
      if (prev.duration > 0 && prev.end < seg.start) {
        const midpoint = prev.end + (seg.start - prev.end) / 2;
        start = midpoint;
      }
    }

    if (i === raw.length - 1) {
      // Last segment: extend to full audio duration
      end = audioDuration ?? seg.end;
    } else {
      // Absorb gap to next segment: push end to midpoint of gap
      const next = raw[i + 1]!;
      if (next.duration > 0 && seg.end < next.start) {
        const midpoint = seg.end + (next.start - seg.end) / 2;
        end = midpoint;
      }
    }

    expanded.push({
      text: seg.text,
      start,
      end,
      duration: end - start,
    });
  }

  return expanded;
}
