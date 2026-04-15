import { describe, expect, test } from "bun:test";
import {
  countWords,
  hasSpacelessChars,
  isSpacelessScript,
  segmentWords,
  smartJoin,
} from "./word-segmenter";

// ---------------------------------------------------------------------------
// isSpacelessScript
// ---------------------------------------------------------------------------

describe("isSpacelessScript", () => {
  test("detects hiragana", () => {
    expect(isSpacelessScript("あ".codePointAt(0)!)).toBe(true);
    expect(isSpacelessScript("ん".codePointAt(0)!)).toBe(true);
  });

  test("detects katakana", () => {
    expect(isSpacelessScript("ア".codePointAt(0)!)).toBe(true);
    expect(isSpacelessScript("ン".codePointAt(0)!)).toBe(true);
  });

  test("detects CJK ideographs", () => {
    expect(isSpacelessScript("漢".codePointAt(0)!)).toBe(true);
    expect(isSpacelessScript("字".codePointAt(0)!)).toBe(true);
  });

  test("detects Thai", () => {
    expect(isSpacelessScript("ก".codePointAt(0)!)).toBe(true);
    expect(isSpacelessScript("ม".codePointAt(0)!)).toBe(true);
  });

  test("rejects Latin", () => {
    expect(isSpacelessScript("A".codePointAt(0)!)).toBe(false);
    expect(isSpacelessScript("z".codePointAt(0)!)).toBe(false);
  });

  test("rejects Arabic", () => {
    expect(isSpacelessScript("ع".codePointAt(0)!)).toBe(false);
  });

  test("rejects Korean (hangul uses spaces)", () => {
    expect(isSpacelessScript("한".codePointAt(0)!)).toBe(false);
  });

  test("rejects digits and punctuation", () => {
    expect(isSpacelessScript("0".codePointAt(0)!)).toBe(false);
    expect(isSpacelessScript(".".codePointAt(0)!)).toBe(false);
    expect(isSpacelessScript(" ".codePointAt(0)!)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasSpacelessChars
// ---------------------------------------------------------------------------

describe("hasSpacelessChars", () => {
  test("detects Japanese text", () => {
    expect(hasSpacelessChars("これはテストです")).toBe(true);
  });

  test("detects mixed text with Japanese", () => {
    expect(hasSpacelessChars("Hello これは test")).toBe(true);
  });

  test("returns false for English", () => {
    expect(hasSpacelessChars("Hello world")).toBe(false);
  });

  test("returns false for Arabic", () => {
    expect(hasSpacelessChars("مرحبا بالعالم")).toBe(false);
  });

  test("returns false for Korean", () => {
    expect(hasSpacelessChars("안녕하세요 세계")).toBe(false);
  });

  test("detects Chinese", () => {
    expect(hasSpacelessChars("今天天气很好")).toBe(true);
  });

  test("detects Thai", () => {
    expect(hasSpacelessChars("สวัสดีครับ")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// segmentWords
// ---------------------------------------------------------------------------

describe("segmentWords", () => {
  test("segments English text by whitespace", () => {
    const result = segmentWords("Hello world test");
    expect(result.map((s) => s.word)).toEqual(["Hello", "world", "test"]);
  });

  test("segments Japanese into morphological words", () => {
    const result = segmentWords("これはテストです");
    expect(result.length).toBeGreaterThan(1);
    // All segments joined = original text
    expect(result.map((s) => s.word).join("")).toBe("これはテストです");
  });

  test("segments Chinese into words", () => {
    const result = segmentWords("今天天气很好");
    expect(result.length).toBeGreaterThan(1);
    expect(result.map((s) => s.word).join("")).toBe("今天天气很好");
  });

  test("segments Thai into words", () => {
    const result = segmentWords("สวัสดีครับ");
    expect(result.length).toBeGreaterThan(1);
  });

  test("handles mixed Japanese-English", () => {
    const result = segmentWords("Varg AIはすごい");
    const words = result.map((s) => s.word);
    expect(words).toContain("Varg");
    expect(words).toContain("AI");
    expect(words.length).toBeGreaterThan(2);
  });

  test("returns character indices", () => {
    const result = segmentWords("Hello world");
    expect(result[0]!.index).toBe(0);
    expect(result[0]!.length).toBe(5);
    expect(result[1]!.index).toBe(6); // after "Hello "
    expect(result[1]!.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// countWords
// ---------------------------------------------------------------------------

describe("countWords", () => {
  test("counts English words by whitespace", () => {
    expect(countWords("Hello world test")).toBe(3);
  });

  test("counts Japanese morphological words", () => {
    // Uses Intl.Segmenter, should find multiple words
    expect(countWords("これはテストです")).toBeGreaterThan(1);
  });

  test("counts Chinese words", () => {
    expect(countWords("今天天气很好")).toBeGreaterThan(1);
  });

  test("counts words with extra whitespace", () => {
    expect(countWords("  Hello   world  ")).toBe(2);
  });

  test("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  test("returns 0 for whitespace-only string", () => {
    expect(countWords("   ")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// smartJoin
// ---------------------------------------------------------------------------

describe("smartJoin", () => {
  test("joins English words with spaces", () => {
    expect(smartJoin(["Hello", "world", "test"])).toBe("Hello world test");
  });

  test("joins Japanese words without spaces", () => {
    expect(smartJoin(["これ", "は", "テスト", "です"])).toBe(
      "これはテストです",
    );
  });

  test("joins Chinese words without spaces", () => {
    expect(smartJoin(["今天", "天气", "很好"])).toBe("今天天气很好");
  });

  test("joins mixed Japanese-English without space at boundary", () => {
    // "Varg" + "は" → "Vargは" (no space — Japanese side)
    expect(smartJoin(["Varg", "は", "すごい"])).toBe("Vargはすごい");
  });

  test("joins English words before CJK without space at boundary", () => {
    // "AI" + "は" → "AIは"
    expect(smartJoin(["Varg", "AI", "は"])).toBe("Varg AIは");
  });

  test("handles single word", () => {
    expect(smartJoin(["Hello"])).toBe("Hello");
  });

  test("handles empty array", () => {
    expect(smartJoin([])).toBe("");
  });

  test("joins Thai words without spaces", () => {
    expect(smartJoin(["สวัสดี", "ครับ"])).toBe("สวัสดีครับ");
  });

  test("Arabic words get spaces (space-delimited script)", () => {
    expect(smartJoin(["مرحبا", "بالعالم"])).toBe("مرحبا بالعالم");
  });

  test("Korean words get spaces (space-delimited script)", () => {
    expect(smartJoin(["안녕하세요", "세계"])).toBe("안녕하세요 세계");
  });

  test("handles ASS override tags mixed with CJK", () => {
    // When karaoke mode wraps words in color tags
    const parts = ["{\\c&H428CFF&}これ{\\c&HFFFFFF&}", "は", "テスト"];
    const result = smartJoin(parts);
    // The closing } is not a spaceless char, but the next char は is
    // so no space should be inserted
    expect(result).not.toContain("} は");
  });
});
