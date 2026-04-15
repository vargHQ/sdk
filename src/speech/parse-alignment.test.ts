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

  // -----------------------------------------------------------------------
  // Japanese (spaceless script — uses Intl.Segmenter)
  // -----------------------------------------------------------------------

  test("segments Japanese text into morphological words", () => {
    // "これはテストです" → これ, は, テスト, です
    const text = "これはテストです";
    const chars = [...text]; // split into individual characters
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.1);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.1);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    // Should produce multiple words, not a single mega-word
    expect(result.length).toBeGreaterThan(1);
    // Each word should have valid timing
    for (const w of result) {
      expect(w.start).toBeLessThan(w.end);
      expect(w.word.length).toBeGreaterThan(0);
    }
    // Concatenated words should equal original text
    expect(result.map((w) => w.word).join("")).toBe(text);
    // First word starts at 0
    expect(result[0]!.start).toBe(0);
    // Last word ends at the end
    expect(result[result.length - 1]!.end).toBe(n * 0.1);
  });

  test("segments mixed Japanese-English text", () => {
    // "Varg AIはすごいです" — mix of Latin and Japanese
    const text = "Varg AIはすごいです";
    const chars = [...text];
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.05);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.05);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    // Should have multiple words including "Varg", "AI", and Japanese words
    expect(result.length).toBeGreaterThan(2);
    // Should contain "Varg" and "AI" as separate words
    const wordTexts = result.map((w) => w.word);
    expect(wordTexts).toContain("Varg");
    expect(wordTexts).toContain("AI");
  });

  // -----------------------------------------------------------------------
  // Chinese (spaceless script)
  // -----------------------------------------------------------------------

  test("segments Chinese text into words", () => {
    // "今天天气很好" → 今天, 天气, 很好
    const text = "今天天气很好";
    const chars = [...text];
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.15);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.15);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    expect(result.length).toBeGreaterThan(1);
    expect(result.map((w) => w.word).join("")).toBe(text);
  });

  // -----------------------------------------------------------------------
  // Thai (spaceless script)
  // -----------------------------------------------------------------------

  test("segments Thai text into words", () => {
    // "สวัสดีครับ" → สวัสดี, ครับ
    const text = "สวัสดีครับ";
    const chars = [...text];
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.08);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.08);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    expect(result.length).toBeGreaterThan(1);
    expect(result.map((w) => w.word).join("")).toBe(text);
  });

  // -----------------------------------------------------------------------
  // Space-delimited scripts should still work as before
  // -----------------------------------------------------------------------

  test("Arabic text uses whitespace splitting (has spaces)", () => {
    // "مرحبا بالعالم" — Arabic with a space
    const chars = [
      "م",
      "ر",
      "ح",
      "ب",
      "ا",
      " ",
      "ب",
      "ا",
      "ل",
      "ع",
      "ا",
      "ل",
      "م",
    ];
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.05);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.05);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.word).toBe("مرحبا");
    expect(result[1]!.word).toBe("بالعالم");
  });

  test("Korean text uses whitespace splitting (has spaces)", () => {
    // "안녕하세요 세계" — Korean with a space
    const text = "안녕하세요 세계";
    const chars = [...text];
    const n = chars.length;
    const starts = Array.from({ length: n }, (_, i) => i * 0.05);
    const ends = Array.from({ length: n }, (_, i) => (i + 1) * 0.05);

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.word).toBe("안녕하세요");
    expect(result[1]!.word).toBe("세계");
  });

  // -----------------------------------------------------------------------
  // Timing precision
  // -----------------------------------------------------------------------

  test("Japanese words get correct per-character timing", () => {
    // "はい" (2 chars) + space + "OK" (2 chars)
    // But since "はい" triggers spaceless path, this goes through Intl.Segmenter
    const chars = ["は", "い", " ", "O", "K"];
    const starts = [0, 0.1, 0.2, 0.3, 0.4];
    const ends = [0.1, 0.2, 0.3, 0.4, 0.5];

    const result = parseElevenLabsAlignment({
      characters: chars,
      character_start_times_seconds: starts,
      character_end_times_seconds: ends,
    });

    // Should find "はい" and "OK" as separate words
    const words = result.map((w) => w.word);
    expect(words).toContain("はい");
    expect(words).toContain("OK");

    // Timing: "はい" should be 0-0.2, "OK" should be 0.3-0.5
    const hai = result.find((w) => w.word === "はい")!;
    expect(hai.start).toBe(0);
    expect(hai.end).toBe(0.2);

    const ok = result.find((w) => w.word === "OK")!;
    expect(ok.start).toBe(0.3);
    expect(ok.end).toBe(0.5);
  });
});
