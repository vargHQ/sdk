import { describe, expect, test } from "bun:test";
import { mapWordsToSegments } from "./map-segments";
import type { WordTiming } from "./types";

describe("mapWordsToSegments", () => {
  test("maps three segments with gap absorption", () => {
    const words: WordTiming[] = [
      { word: "Welcome", start: 0, end: 0.5 },
      { word: "everyone.", start: 0.6, end: 1.2 },
      // gap: 1.2 -> 1.4 = 0.2s
      { word: "Main", start: 1.4, end: 1.7 },
      { word: "content.", start: 1.8, end: 2.3 },
      // gap: 2.3 -> 2.5 = 0.2s
      { word: "Thanks.", start: 2.5, end: 3.0 },
    ];

    const result = mapWordsToSegments(
      words,
      ["Welcome everyone.", "Main content.", "Thanks."],
      3.2, // audioDuration
    );

    expect(result).toHaveLength(3);
    // First segment: starts at 0, absorbs half the gap to next (midpoint of 1.2-1.4 = 1.3)
    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBeCloseTo(1.3, 5);
    // Second segment: starts at midpoint of gap from prev, ends at midpoint of gap to next
    expect(result[1]!.start).toBeCloseTo(1.3, 5);
    expect(result[1]!.end).toBeCloseTo(2.4, 5);
    // Third segment: starts at midpoint of gap from prev, ends at audioDuration
    expect(result[2]!.start).toBeCloseTo(2.4, 5);
    expect(result[2]!.end).toBe(3.2);
  });

  test("segments touch — no gaps between adjacent segments", () => {
    const words: WordTiming[] = [
      { word: "A.", start: 0, end: 1.0 },
      // gap: 0.1s
      { word: "B.", start: 1.1, end: 2.0 },
      // gap: 0.06s
      { word: "C.", start: 2.06, end: 3.0 },
    ];

    const result = mapWordsToSegments(words, ["A.", "B.", "C."], 3.5);

    // Adjacent segments should touch (no gap)
    expect(result[0]!.end).toBeCloseTo(result[1]!.start, 10);
    expect(result[1]!.end).toBeCloseTo(result[2]!.start, 10);
    // First starts at 0, last ends at audioDuration
    expect(result[0]!.start).toBe(0);
    expect(result[2]!.end).toBe(3.5);
  });

  test("single child spans entire audio", () => {
    const words: WordTiming[] = [
      { word: "Hello", start: 0.1, end: 0.5 },
      { word: "world", start: 0.6, end: 1.0 },
    ];

    const result = mapWordsToSegments(words, ["Hello world"], 1.2);

    expect(result).toEqual([
      { text: "Hello world", start: 0, end: 1.2, duration: 1.2 },
    ]);
  });

  test("handles empty children array", () => {
    const words: WordTiming[] = [{ word: "Hello", start: 0, end: 0.5 }];
    expect(mapWordsToSegments(words, [])).toEqual([]);
  });

  test("handles empty words array", () => {
    expect(mapWordsToSegments([], ["Hello"])).toEqual([]);
  });

  test("handles empty segment text", () => {
    const words: WordTiming[] = [
      { word: "Hello", start: 0, end: 0.5 },
      { word: "world", start: 0.6, end: 1.0 },
    ];

    const result = mapWordsToSegments(words, ["", "Hello world"], 1.2);

    expect(result).toHaveLength(2);
    expect(result[0]!.duration).toBe(0);
    expect(result[1]!.text).toBe("Hello world");
    expect(result[1]!.end).toBe(1.2);
  });

  test("clamps when more segment words than alignment words", () => {
    const words: WordTiming[] = [{ word: "Hello", start: 0, end: 0.5 }];

    const result = mapWordsToSegments(words, [
      "Hello world foo bar",
      "More text here",
    ]);

    // First segment claims the only word available
    expect(result[0]!.start).toBe(0);
    // Second segment has no words left, gets zero duration
    expect(result[1]!.duration).toBe(0);
  });

  test("handles segments with extra whitespace", () => {
    const words: WordTiming[] = [
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 0.2, end: 0.3 },
      // gap: 0.1s
      { word: "c", start: 0.4, end: 0.5 },
    ];

    const result = mapWordsToSegments(words, ["  a  b  ", " c "], 0.6);

    expect(result).toHaveLength(2);
    // Gap absorption: midpoint of 0.3-0.4 = 0.35
    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBeCloseTo(0.35, 5);
    expect(result[1]!.start).toBeCloseTo(0.35, 5);
    expect(result[1]!.end).toBe(0.6);
  });

  test("handles uneven word distribution with gap absorption", () => {
    const words: WordTiming[] = [
      { word: "One", start: 0, end: 0.3 },
      // gap: 0.1s
      { word: "two", start: 0.4, end: 0.7 },
      { word: "three", start: 0.8, end: 1.2 },
      { word: "four", start: 1.3, end: 1.6 },
      // gap: 0.1s
      { word: "five", start: 1.7, end: 2.0 },
    ];

    const result = mapWordsToSegments(
      words,
      ["One", "two three four", "five"],
      2.2,
    );

    expect(result).toHaveLength(3);
    // First: 0 -> midpoint of 0.3-0.4 = 0.35
    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBeCloseTo(0.35, 5);
    // Second: 0.35 -> midpoint of 1.6-1.7 = 1.65
    expect(result[1]!.start).toBeCloseTo(0.35, 5);
    expect(result[1]!.end).toBeCloseTo(1.65, 5);
    // Third: 1.65 -> audioDuration
    expect(result[2]!.start).toBeCloseTo(1.65, 5);
    expect(result[2]!.end).toBe(2.2);
  });

  test("works without audioDuration (falls back to last word end)", () => {
    const words: WordTiming[] = [
      { word: "A.", start: 0, end: 1.0 },
      { word: "B.", start: 1.2, end: 2.0 },
    ];

    const result = mapWordsToSegments(words, ["A.", "B."]);

    // Last segment end = last word end (no audioDuration to extend)
    expect(result[1]!.end).toBe(2.0);
  });

  test("no gaps in original -> segments keep word boundaries", () => {
    const words: WordTiming[] = [
      { word: "Hello", start: 0, end: 0.5 },
      { word: "world.", start: 0.5, end: 1.0 },
      // no gap (end of prev == start of next)
      { word: "Bye.", start: 1.0, end: 1.5 },
    ];

    const result = mapWordsToSegments(words, ["Hello world.", "Bye."], 1.6);

    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBe(1.0); // no gap to absorb, stays at word boundary
    expect(result[1]!.start).toBe(1.0);
    expect(result[1]!.end).toBe(1.6);
  });
});
