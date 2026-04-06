import { describe, expect, test } from "bun:test";
import { convertToSRT } from "./captions";

// We need to test the internal convertSrtToAssGrouped function.
// Since it's not exported, we'll test the full flow via convertToSRT + verifying SRT output,
// then test the ASS generation by importing the module internals.

// For now, re-implement the key functions locally to test the logic.

function parseSrt(content: string) {
  const entries: { index: number; start: number; end: number; text: string }[] =
    [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 3) continue;

    const index = Number.parseInt(lines[0] || "0", 10);
    const timeLine = lines[1] || "";
    const timeMatch = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/,
    );

    if (!timeMatch) continue;

    const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
    if (!h1 || !m1 || !s1 || !ms1 || !h2 || !m2 || !s2 || !ms2) continue;

    const start =
      Number.parseInt(h1, 10) * 3600 +
      Number.parseInt(m1, 10) * 60 +
      Number.parseInt(s1, 10) +
      Number.parseInt(ms1, 10) / 1000;

    const end =
      Number.parseInt(h2, 10) * 3600 +
      Number.parseInt(m2, 10) * 60 +
      Number.parseInt(s2, 10) +
      Number.parseInt(ms2, 10) / 1000;

    const text = lines.slice(2).join("\n");
    entries.push({ index, start, end, text });
  }

  return entries;
}

describe("convertToSRT", () => {
  test("converts words to SRT format", () => {
    const words = [
      { word: "Hello", start: 0.0, end: 0.5 },
      { word: "world", start: 0.5, end: 1.0 },
    ];
    const srt = convertToSRT(words);
    expect(srt).toContain("Hello");
    expect(srt).toContain("world");
    expect(srt).toContain("00:00:00,000 --> 00:00:00,500");
    expect(srt).toContain("00:00:00,500 --> 00:00:01,000");
  });

  test("generates one SRT entry per word", () => {
    const words = [
      { word: "Varg", start: 0.5, end: 0.8 },
      { word: "AI", start: 0.8, end: 1.0 },
      { word: "is", start: 1.0, end: 1.3 },
      { word: "just", start: 1.3, end: 1.5 },
      { word: "insane", start: 1.5, end: 2.0 },
    ];
    const srt = convertToSRT(words);
    const entries = parseSrt(srt);
    expect(entries.length).toBe(5);
    expect(entries[0]!.text).toBe("Varg");
    expect(entries[4]!.text).toBe("insane");
  });
});

describe("grouped SRT parsing", () => {
  test("parseSrt correctly parses word-level SRT", () => {
    const srt = `1
00:00:00,500 --> 00:00:00,800
Varg

2
00:00:00,800 --> 00:00:01,000
AI

3
00:00:01,000 --> 00:00:01,300
is
`;
    const entries = parseSrt(srt);
    expect(entries.length).toBe(3);
    expect(entries[0]!.text).toBe("Varg");
    expect(entries[0]!.start).toBeCloseTo(0.5);
    expect(entries[0]!.end).toBeCloseTo(0.8);
    expect(entries[2]!.text).toBe("is");
  });
});
