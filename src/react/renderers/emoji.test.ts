import { describe, expect, test } from "bun:test";
import {
  buildEmojiFilterComplex,
  calculateEmojiSize,
  calculateEmojiX,
  calculateEmojiY,
  extractEmoji,
  hasEmoji,
  stripEmoji,
  type EmojiOverlay,
} from "./emoji";

// ---------------------------------------------------------------------------
// hasEmoji
// ---------------------------------------------------------------------------

describe("hasEmoji", () => {
  test("returns true for text with emoji", () => {
    expect(hasEmoji("Hello 💪")).toBe(true);
    expect(hasEmoji("🔥")).toBe(true);
    expect(hasEmoji("Go go 🎉🎊")).toBe(true);
  });

  test("returns false for text without emoji", () => {
    expect(hasEmoji("Hello world")).toBe(false);
    expect(hasEmoji("日本語テスト")).toBe(false);
    expect(hasEmoji("")).toBe(false);
    expect(hasEmoji("123 abc !@#")).toBe(false);
  });

  test("detects ZWJ sequences", () => {
    expect(hasEmoji("👨‍👩‍👧‍👦 family")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stripEmoji
// ---------------------------------------------------------------------------

describe("stripEmoji", () => {
  test("replaces single emoji with space", () => {
    expect(stripEmoji("Hello 💪 world")).toBe("Hello   world");
  });

  test("replaces multiple emoji with spaces", () => {
    expect(stripEmoji("🔥 Let's go 💪")).toBe("  Let's go  ");
  });

  test("returns unchanged text when no emoji", () => {
    expect(stripEmoji("Hello world")).toBe("Hello world");
  });

  test("handles ZWJ sequences as single space", () => {
    const text = "Hi 👨‍👩‍👧‍👦 family";
    const stripped = stripEmoji(text);
    // ZWJ sequence (multi-char) replaced with single space
    expect(stripped).toBe("Hi   family");
  });

  test("handles consecutive emoji", () => {
    expect(stripEmoji("🔥🔥🔥")).toBe("   ");
  });
});

// ---------------------------------------------------------------------------
// extractEmoji
// ---------------------------------------------------------------------------

describe("extractEmoji", () => {
  test("extracts single emoji", () => {
    const result = extractEmoji("Hello 💪 world");
    expect(result).toHaveLength(1);
    expect(result[0]!.emoji).toBe("💪");
    expect(result[0]!.codepoints).toBe("1f4aa");
    expect(result[0]!.url).toBe("https://s3.varg.ai/emoji/1f4aa.png");
    // In stripped text "Hello   world", the space at index 6 replaces 💪
    expect(result[0]!.charIndex).toBe(6);
  });

  test("extracts multiple emoji", () => {
    const result = extractEmoji("🔥 Go 💪");
    expect(result).toHaveLength(2);
    expect(result[0]!.codepoints).toBe("1f525");
    expect(result[1]!.codepoints).toBe("1f4aa");
  });

  test("handles emoji with variation selectors", () => {
    // Star emoji: U+2B50 U+FE0F
    const result = extractEmoji("⭐ rating");
    expect(result.length).toBeGreaterThanOrEqual(1);
    // FE0F should be stripped from codepoints for S3 filename
    const star = result.find((e) => e.codepoints === "2b50");
    expect(star).toBeDefined();
  });

  test("returns empty array for no emoji", () => {
    expect(extractEmoji("Hello world")).toEqual([]);
  });

  test("charIndex accounts for shrinkage in multi-char emoji", () => {
    // 💪 is 2 chars in JS (surrogate pair), gets replaced by 1 space
    // So "A💪B" -> "A B", 💪's charIndex should be 1 (position of space)
    const result = extractEmoji("A💪B");
    expect(result).toHaveLength(1);
    expect(result[0]!.charIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// calculateEmojiSize
// ---------------------------------------------------------------------------

describe("calculateEmojiSize", () => {
  test("rounds winAscent when scale=1", () => {
    // winAscent=51, scale=1 -> 51
    const size = calculateEmojiSize(51, 1920, 1920);
    expect(size).toBe(51);
  });

  test("scales winAscent when playRes differs from video", () => {
    // winAscent=51, PlayRes=720, video=1080 -> scale=1.5 -> 77 (rounded)
    const size = calculateEmojiSize(51, 720, 1080);
    expect(size).toBe(77);
  });
});

// ---------------------------------------------------------------------------
// calculateEmojiX
// ---------------------------------------------------------------------------

describe("calculateEmojiX", () => {
  test("computes center-aligned x position", () => {
    // 10 chars, charIndex 0, fontSize 72, playResX 1080, videoWidth 1080
    const x = calculateEmojiX(0, 10, 72, 1080, 1080);
    // charWidth = 72*0.38 = 27.36, totalWidth = 273.6
    // textStartX = 540 - 136.8 = 403.2
    // emojiX = 403.2 + 0*27.36 = 403.2 -> 403
    expect(x).toBe(403);
  });

  test("computes mid-text x position", () => {
    const x = calculateEmojiX(5, 10, 72, 1080, 1080);
    // textStartX = 403.2, emojiX = 403.2 + 5*27.36 = 540 -> 540
    expect(x).toBe(540);
  });
});

// ---------------------------------------------------------------------------
// calculateEmojiY
// ---------------------------------------------------------------------------

describe("calculateEmojiY", () => {
  // Using real Montserrat-Bold-like metrics: winDescent=14, winAscent=51, capHeight=32
  // verticalNudge = (51 - 32) / 2 = 9.5
  test("computes bottom-aligned y position", () => {
    // alignment=2, marginV=80, winDescent=14, winAscent=51, capHeight=32
    // baseline = 720 - 80 - 14 = 626
    // y = 626 - 51 + 9.5 = 584.5 -> 585
    const y = calculateEmojiY(2, 80, 14, 51, 32, 720, 720);
    expect(y).toBe(585);
  });

  test("computes top-aligned y position", () => {
    // alignment=8, marginV=100, nudge=9.5
    // y = 100 + 9.5 = 109.5 -> 110
    const y = calculateEmojiY(8, 100, 14, 51, 32, 1920, 1920);
    expect(y).toBe(110);
  });

  test("computes center-aligned y position", () => {
    // alignment=5, marginV=0, winAscent=51, capHeight=32, nudge=9.5
    // y = 960 - 51/2 + 9.5 = 960 - 25.5 + 9.5 = 944
    const y = calculateEmojiY(5, 0, 14, 51, 32, 1920, 1920);
    expect(y).toBe(944);
  });
});

// ---------------------------------------------------------------------------
// buildEmojiFilterComplex
// ---------------------------------------------------------------------------

describe("buildEmojiFilterComplex", () => {
  test("returns subtitles filter when no overlays", () => {
    const result = buildEmojiFilterComplex(
      "subtitles=captions.ass:fontsdir=.",
      [],
      2,
    );
    expect(result).toBe("subtitles=captions.ass:fontsdir=.");
  });

  test("builds filter graph for single emoji", () => {
    const overlays: EmojiOverlay[] = [
      {
        url: "https://s3.varg.ai/emoji/1f525.png",
        fileName: "1f525.png",
        startTime: 1.0,
        endTime: 2.5,
        x: 400,
        y: 1386,
        size: 40,
      },
    ];
    const result = buildEmojiFilterComplex(
      "subtitles=captions.ass:fontsdir=.",
      overlays,
      2,
    );

    // Should have 3 parts: subtitles, scale, overlay
    const parts = result.split(";");
    expect(parts).toHaveLength(3);

    // First part: apply subtitles
    expect(parts[0]).toBe("[0:v]subtitles=captions.ass:fontsdir=.[sub]");

    // Second part: scale emoji PNG at input index 2
    expect(parts[1]).toContain("[2:v]scale=40:40");
    expect(parts[1]).toContain("[emoji0]");

    // Third part: overlay with timing
    expect(parts[2]).toContain("[sub][emoji0]overlay=x=400:y=1386");
    expect(parts[2]).toContain("enable='between(t,1.00,2.50)'");
    expect(parts[2]).toContain("[vout]");
  });

  test("builds chained filter graph for multiple emoji", () => {
    const overlays: EmojiOverlay[] = [
      {
        url: "https://s3.varg.ai/emoji/1f525.png",
        fileName: "1f525.png",
        startTime: 1.0,
        endTime: 2.0,
        x: 400,
        y: 1386,
        size: 40,
      },
      {
        url: "https://s3.varg.ai/emoji/1f4aa.png",
        fileName: "1f4aa.png",
        startTime: 2.0,
        endTime: 3.0,
        x: 500,
        y: 1386,
        size: 40,
      },
    ];
    const result = buildEmojiFilterComplex(
      "subtitles=captions.ass",
      overlays,
      2,
    );

    const parts = result.split(";");
    // subtitles + 2*(scale + overlay) = 5 parts
    expect(parts).toHaveLength(5);

    // First emoji uses input [2:v], second uses [3:v]
    expect(parts[1]).toContain("[2:v]scale=");
    expect(parts[3]).toContain("[3:v]scale=");

    // Chaining: first overlay output -> second overlay input
    // First overlay: [sub][emoji0] -> [v0]
    expect(parts[2]).toContain("[sub][emoji0]");
    expect(parts[2]).toContain("[v0]");

    // Second overlay: [v0][emoji1] -> [vout]
    expect(parts[4]).toContain("[v0][emoji1]");
    expect(parts[4]).toContain("[vout]");
  });

  test("respects inputCount offset for emoji indices", () => {
    const overlays: EmojiOverlay[] = [
      {
        url: "https://s3.varg.ai/emoji/1f525.png",
        fileName: "1f525.png",
        startTime: 0,
        endTime: 1,
        x: 0,
        y: 0,
        size: 40,
      },
    ];

    // inputCount=3 means emoji starts at index 3
    const result = buildEmojiFilterComplex("subtitles=test.ass", overlays, 3);
    expect(result).toContain("[3:v]scale=");
  });
});

// ---------------------------------------------------------------------------
// Multi-space stripEmoji + extractEmoji
// ---------------------------------------------------------------------------

describe("multi-space strip + extract", () => {
  test("stripEmoji replaces each emoji with N spaces", () => {
    expect(stripEmoji("Hello 💪 world", 2)).toBe("Hello    world");
    expect(stripEmoji("Hello 💪 world", 3)).toBe("Hello     world");
  });

  test("extractEmoji charIndex tracks multi-space replacement", () => {
    // "A💪B" with spacesPerEmoji=2 -> "A  B"
    // 💪 is at original index 1, emoji is 2 chars, replaced by 2 spaces
    // shrinkage = 2 - 2 = 0, so charIndex = 1
    const result = extractEmoji("A💪B", 2);
    expect(result).toHaveLength(1);
    expect(result[0]!.charIndex).toBe(1);

    const stripped = stripEmoji("A💪B", 2);
    expect(stripped).toBe("A  B");
    expect(stripped[result[0]!.charIndex]).toBe(" ");
  });

  test("multi-space with multiple emoji", () => {
    // "🔥🔥" with spacesPerEmoji=3 -> "      " (6 spaces)
    const stripped = stripEmoji("🔥🔥", 3);
    expect(stripped).toBe("      "); // 3 + 3

    const instances = extractEmoji("🔥🔥", 3);
    expect(instances).toHaveLength(2);
    expect(instances[0]!.charIndex).toBe(0);
    expect(instances[1]!.charIndex).toBe(3); // after first 3 spaces
  });

  test("multi-space charIndex consistency with stripped text", () => {
    const text = "Start 🔥 middle 💪 end";
    const nSpaces = 2;
    const stripped = stripEmoji(text, nSpaces);
    const instances = extractEmoji(text, nSpaces);

    // Each emoji's charIndex should point to a space in the stripped text
    for (const inst of instances) {
      expect(stripped[inst.charIndex]).toBe(" ");
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: stripEmoji + extractEmoji consistency (single space, backward compat)
// ---------------------------------------------------------------------------

describe("strip + extract consistency", () => {
  test("stripped text length matches charIndex expectations", () => {
    const text = "Start 🔥 middle 💪 end";
    const stripped = stripEmoji(text);
    const instances = extractEmoji(text);

    // Verify each emoji's charIndex points to a space in the stripped text
    for (const inst of instances) {
      expect(stripped[inst.charIndex]).toBe(" ");
    }
  });

  test("handles text with only emoji", () => {
    const text = "💪🔥🎉";
    const stripped = stripEmoji(text);
    expect(stripped).toBe("   ");

    const instances = extractEmoji(text);
    expect(instances).toHaveLength(3);
    // charIndex should be 0, 1, 2 in the stripped "   " text
    expect(instances[0]!.charIndex).toBe(0);
    expect(instances[1]!.charIndex).toBe(1);
    expect(instances[2]!.charIndex).toBe(2);
  });

  test("handles mixed CJK + emoji text", () => {
    const text = "日本語 💪 テスト";
    const stripped = stripEmoji(text);
    expect(stripped).toBe("日本語   テスト");

    const instances = extractEmoji(text);
    expect(instances).toHaveLength(1);
    expect(instances[0]!.codepoints).toBe("1f4aa");
    // In stripped text, the space is at index 4
    expect(instances[0]!.charIndex).toBe(4);
  });
});
