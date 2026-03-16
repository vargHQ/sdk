import { describe, expect, test } from "bun:test";
import { mapWordsToSegments } from "./map-segments";
import type { WordTiming } from "./types";

describe("mapWordsToSegments", () => {
  test("maps three segments correctly", () => {
    const words: WordTiming[] = [
      { word: "Welcome", start: 0, end: 0.5 },
      { word: "everyone.", start: 0.6, end: 1.2 },
      { word: "Main", start: 1.4, end: 1.7 },
      { word: "content.", start: 1.8, end: 2.3 },
      { word: "Thanks.", start: 2.5, end: 3.0 },
    ];

    const result = mapWordsToSegments(words, [
      "Welcome everyone.",
      "Main content.",
      "Thanks.",
    ]);

    expect(result).toEqual([
      { text: "Welcome everyone.", start: 0, end: 1.2, duration: 1.2 },
      {
        text: "Main content.",
        start: 1.4,
        end: 2.3,
        duration: expect.closeTo(0.9, 5),
      },
      { text: "Thanks.", start: 2.5, end: 3.0, duration: 0.5 },
    ]);
  });

  test("single child spans entire audio", () => {
    const words: WordTiming[] = [
      { word: "Hello", start: 0, end: 0.5 },
      { word: "world", start: 0.6, end: 1.0 },
    ];

    const result = mapWordsToSegments(words, ["Hello world"]);

    expect(result).toEqual([
      { text: "Hello world", start: 0, end: 1.0, duration: 1.0 },
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

    const result = mapWordsToSegments(words, ["", "Hello world"]);

    expect(result).toHaveLength(2);
    expect(result[0]!.duration).toBe(0);
    expect(result[1]!.text).toBe("Hello world");
    expect(result[1]!.start).toBe(0);
    expect(result[1]!.end).toBe(1.0);
  });

  test("clamps when more segment words than alignment words", () => {
    const words: WordTiming[] = [{ word: "Hello", start: 0, end: 0.5 }];

    const result = mapWordsToSegments(words, [
      "Hello world foo bar",
      "More text here",
    ]);

    // First segment claims the only word available
    expect(result[0]!.start).toBe(0);
    expect(result[0]!.end).toBe(0.5);
    // Second segment has no words left, gets zero duration at the end
    expect(result[1]!.duration).toBe(0);
  });

  test("handles segments with extra whitespace", () => {
    const words: WordTiming[] = [
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 0.2, end: 0.3 },
      { word: "c", start: 0.4, end: 0.5 },
    ];

    const result = mapWordsToSegments(words, [
      "  a  b  ", // 2 words with extra spaces
      " c ", // 1 word with spaces
    ]);

    expect(result).toEqual([
      { text: "  a  b  ", start: 0, end: 0.3, duration: 0.3 },
      { text: " c ", start: 0.4, end: 0.5, duration: expect.closeTo(0.1, 5) },
    ]);
  });

  test("handles uneven word distribution", () => {
    const words: WordTiming[] = [
      { word: "One", start: 0, end: 0.3 },
      { word: "two", start: 0.4, end: 0.7 },
      { word: "three", start: 0.8, end: 1.2 },
      { word: "four", start: 1.3, end: 1.6 },
      { word: "five", start: 1.7, end: 2.0 },
    ];

    const result = mapWordsToSegments(words, [
      "One", // 1 word
      "two three four", // 3 words
      "five", // 1 word
    ]);

    expect(result).toEqual([
      { text: "One", start: 0, end: 0.3, duration: 0.3 },
      {
        text: "two three four",
        start: 0.4,
        end: 1.6,
        duration: expect.closeTo(1.2, 5),
      },
      { text: "five", start: 1.7, end: 2.0, duration: expect.closeTo(0.3, 5) },
    ]);
  });
});
