import { describe, expect, test } from "bun:test";
import { parseElevenLabsAlignment } from "./parse-alignment";

describe("parseElevenLabsAlignment", () => {
  test("converts simple two-word alignment", () => {
    const result = parseElevenLabsAlignment({
      characters: ["H", "i", " ", "m", "o", "m"],
      character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.25],
      character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.25, 0.35],
    });

    expect(result).toEqual([
      { word: "Hi", start: 0, end: 0.1 },
      { word: "mom", start: 0.15, end: 0.35 },
    ]);
  });

  test("handles single word (no spaces)", () => {
    const result = parseElevenLabsAlignment({
      characters: ["H", "e", "l", "l", "o"],
      character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2],
      character_end_times_seconds: [0.05, 0.1, 0.15, 0.2, 0.3],
    });

    expect(result).toEqual([{ word: "Hello", start: 0, end: 0.3 }]);
  });

  test("handles multiple spaces between words", () => {
    const result = parseElevenLabsAlignment({
      characters: ["a", " ", " ", "b"],
      character_start_times_seconds: [0, 0.1, 0.15, 0.2],
      character_end_times_seconds: [0.1, 0.15, 0.2, 0.3],
    });

    expect(result).toEqual([
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 0.2, end: 0.3 },
    ]);
  });

  test("handles leading spaces", () => {
    const result = parseElevenLabsAlignment({
      characters: [" ", "h", "i"],
      character_start_times_seconds: [0, 0.05, 0.1],
      character_end_times_seconds: [0.05, 0.1, 0.2],
    });

    expect(result).toEqual([{ word: "hi", start: 0.05, end: 0.2 }]);
  });

  test("handles trailing spaces", () => {
    const result = parseElevenLabsAlignment({
      characters: ["h", "i", " "],
      character_start_times_seconds: [0, 0.05, 0.1],
      character_end_times_seconds: [0.05, 0.1, 0.15],
    });

    expect(result).toEqual([{ word: "hi", start: 0, end: 0.1 }]);
  });

  test("handles newlines as word separators", () => {
    const result = parseElevenLabsAlignment({
      characters: ["a", "\n", "b"],
      character_start_times_seconds: [0, 0.1, 0.2],
      character_end_times_seconds: [0.1, 0.2, 0.3],
    });

    expect(result).toEqual([
      { word: "a", start: 0, end: 0.1 },
      { word: "b", start: 0.2, end: 0.3 },
    ]);
  });

  test("handles punctuation attached to words", () => {
    const result = parseElevenLabsAlignment({
      characters: ["H", "i", "!", " ", "B", "y", "e", "."],
      character_start_times_seconds: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
      character_end_times_seconds: [
        0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.45,
      ],
    });

    expect(result).toEqual([
      { word: "Hi!", start: 0, end: 0.15 },
      { word: "Bye.", start: 0.2, end: 0.45 },
    ]);
  });

  test("returns empty array for empty alignment", () => {
    expect(
      parseElevenLabsAlignment({
        characters: [],
        character_start_times_seconds: [],
        character_end_times_seconds: [],
      }),
    ).toEqual([]);
  });

  test("handles longer sentence with natural timing", () => {
    // Simulates: "Welcome to the show."
    const chars = "Welcome to the show.".split("");
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.05);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.05);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    expect(result).toHaveLength(4);
    expect(result[0]!.word).toBe("Welcome");
    expect(result[1]!.word).toBe("to");
    expect(result[2]!.word).toBe("the");
    expect(result[3]!.word).toBe("show.");
    // First word starts at 0
    expect(result[0]!.start).toBe(0);
    // Last word ends at the end
    expect(result[3]!.end).toBe(n * 0.05);
  });
});
