import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import {
  type FontPathMap,
  getCharAdvances,
  getCharXPositions,
  getEffectivePpem,
  getFontMetrics,
  getSpaceWidth,
  loadFont,
  measureLineWidth,
  parseASSSegments,
} from "./text-measure";
import {
  calculateEmojiSize,
  calculateEmojiY,
  extractEmoji,
  stripEmoji,
} from "./emoji";

// ---------------------------------------------------------------------------
// parseASSSegments
// ---------------------------------------------------------------------------

describe("parseASSSegments", () => {
  test("parses plain text with no tags", () => {
    const segments = parseASSSegments("Hello world", "Montserrat");
    expect(segments).toEqual([{ fontName: "Montserrat", text: "Hello world" }]);
  });

  test("parses font switch tag", () => {
    const segments = parseASSSegments(
      "Hello {\\fnNoto Sans CJK JP}世界{\\fnMontserrat} test",
      "Montserrat",
    );
    expect(segments).toEqual([
      { fontName: "Montserrat", text: "Hello " },
      { fontName: "Noto Sans CJK JP", text: "世界" },
      { fontName: "Montserrat", text: " test" },
    ]);
  });

  test("ignores non-font tags (color, bold)", () => {
    const segments = parseASSSegments(
      "{\\c&H428CFF&}Hello{\\c&HFFFFFF&} world",
      "Montserrat",
    );
    expect(segments).toEqual([
      { fontName: "Montserrat", text: "Hello world" },
    ]);
  });

  test("handles font tag with color tag in same block", () => {
    const segments = parseASSSegments(
      "{\\fnArial\\c&HFF0000&}Red text",
      "Montserrat",
    );
    expect(segments).toEqual([{ fontName: "Arial", text: "Red text" }]);
  });

  test("handles empty text", () => {
    const segments = parseASSSegments("", "Montserrat");
    expect(segments).toEqual([]);
  });

  test("handles text ending with tag", () => {
    const segments = parseASSSegments("Hello{\\fnArial}", "Montserrat");
    expect(segments).toEqual([{ fontName: "Montserrat", text: "Hello" }]);
  });
});

// ---------------------------------------------------------------------------
// Font-dependent tests (require Montserrat-Bold.ttf)
// ---------------------------------------------------------------------------

const FONT_DIR = "/tmp/varg-caption-fonts";
const MONTSERRAT_PATH = `${FONT_DIR}/Montserrat-Bold.ttf`;
const POPPINS_PATH = `${FONT_DIR}/Poppins-Bold.ttf`;
const ROBOTO_PATH = `${FONT_DIR}/Roboto-Bold.ttf`;
const BEBAS_PATH = `${FONT_DIR}/BebasNeue-Regular.ttf`;
const ARABIC_PATH = `${FONT_DIR}/NotoSansArabic-Bold.ttf`;
const CJK_JP_PATH = `${FONT_DIR}/NotoSansCJKjp-Bold.otf`;

const FONTS_TO_DOWNLOAD: Record<string, string> = {
  [MONTSERRAT_PATH]: "https://s3.varg.ai/fonts/Montserrat-Bold.ttf",
  [POPPINS_PATH]: "https://s3.varg.ai/fonts/Poppins-Bold.ttf",
  [ROBOTO_PATH]: "https://s3.varg.ai/fonts/Roboto-Bold.ttf",
  [BEBAS_PATH]: "https://s3.varg.ai/fonts/BebasNeue-Regular.ttf",
  [ARABIC_PATH]: "https://s3.varg.ai/fonts/NotoSansArabic-Bold.ttf",
  [CJK_JP_PATH]: "https://s3.varg.ai/fonts/NotoSansCJKjp-Bold.otf",
};

// Download all test fonts if not already cached
beforeAll(async () => {
  if (!existsSync(FONT_DIR)) {
    mkdirSync(FONT_DIR, { recursive: true });
  }
  for (const [path, url] of Object.entries(FONTS_TO_DOWNLOAD)) {
    if (!existsSync(path)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
      writeFileSync(path, new Uint8Array(await res.arrayBuffer()));
    }
  }
});

describe("loadFont", () => {
  test("loads Montserrat-Bold.ttf", () => {
    const font = loadFont(MONTSERRAT_PATH);
    expect(font.unitsPerEm).toBe(1000);
  });

  test("caches loaded font", () => {
    const font1 = loadFont(MONTSERRAT_PATH);
    const font2 = loadFont(MONTSERRAT_PATH);
    expect(font1).toBe(font2); // Same reference
  });
});

describe("getSpaceWidth", () => {
  test("returns correct space width using effective ppem", () => {
    const width = getSpaceWidth(MONTSERRAT_PATH, 72);
    // Montserrat: cellHeight=1562, ppem = 72*1000/1562 = 46.09
    // space advance = 283 units, at ppem 46.09: 283 * 46.09 / 1000 = 13.04
    expect(width).toBeCloseTo(13.04, 1);
  });

  test("scales linearly with fontSize", () => {
    const w72 = getSpaceWidth(MONTSERRAT_PATH, 72);
    const w36 = getSpaceWidth(MONTSERRAT_PATH, 36);
    expect(w36).toBeCloseTo(w72 / 2, 2);
  });
});

describe("getCharAdvances", () => {
  test("returns per-character advance widths", () => {
    const advances = getCharAdvances("Wi", MONTSERRAT_PATH, 72);
    expect(advances).toHaveLength(2);
    // W is much wider than i (at effective ppem ~46)
    expect(advances[0]).toBeGreaterThan(40); // W ~ 53.6px
    expect(advances[1]).toBeLessThan(20); // i ~ 13.9px
  });

  test("space advance matches getSpaceWidth", () => {
    const advances = getCharAdvances(" ", MONTSERRAT_PATH, 72);
    const spaceWidth = getSpaceWidth(MONTSERRAT_PATH, 72);
    expect(advances[0]).toBeCloseTo(spaceWidth, 2);
  });
});

describe("measureLineWidth", () => {
  test("sums character advances for a single segment", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello", "Montserrat");
    const width = measureLineWidth(segments, fontPaths, 72);
    // Should be > 0 and reasonable (5 chars at ~30-80px each)
    expect(width).toBeGreaterThan(100);
    expect(width).toBeLessThan(500);
  });

  test("uses effective ppem, not raw fontSize", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello world", "Montserrat");
    const measured = measureLineWidth(segments, fontPaths, 72);

    // With ppem correction, width should be smaller than naive fontSize=72
    const font = loadFont(MONTSERRAT_PATH);
    const naiveWidth = font.getAdvanceWidth("Hello world", 72);
    expect(measured).toBeLessThan(naiveWidth);
    // Should be roughly 64% of naive (ppem/fontSize = 1000/1562 = 0.64)
    expect(measured / naiveWidth).toBeCloseTo(0.64, 1);
  });
});

describe("getCharXPositions", () => {
  test("returns correct number of positions", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello", "Montserrat");
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);
    expect(positions).toHaveLength(5);
  });

  test("positions are strictly increasing", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello world", "Montserrat");
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });

  test("center-aligned positions are symmetric around midpoint", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello", "Montserrat");
    const positions = getCharXPositions(segments, fontPaths, 72, 1000, 2);
    const width = measureLineWidth(segments, fontPaths, 72);

    // First char should start at (1000 - width) / 2
    expect(positions[0]).toBeCloseTo((1000 - width) / 2, 1);
  });

  test("left-aligned starts at marginL", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello", "Montserrat");
    // alignment=1 (bottom-left), marginL=10
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 1, 10, 10);
    expect(positions[0]).toBeCloseTo(10, 1);
  });

  test("right-aligned ends at playResX - marginR", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Hello", "Montserrat");
    const width = measureLineWidth(segments, fontPaths, 72);
    // alignment=3 (bottom-right), marginR=10
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 3, 10, 10);
    expect(positions[0]).toBeCloseTo(1080 - 10 - width, 1);
  });

  test("variable character widths differ from fixed-width heuristic", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const segments = parseASSSegments("Wi", "Montserrat");
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);

    // The gap between W and i should be much larger than i's advance
    // because W is ~54px wide and i is ~14px wide at effective ppem
    const gap = positions[1]! - positions[0]!;
    expect(gap).toBeGreaterThan(40); // W advance at effective ppem
  });

  test("trailing spaces are trimmed for center alignment (matching libass)", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    // "Hello" without trailing spaces
    const segPlain = parseASSSegments("Hello", "Montserrat");
    const posPlain = getCharXPositions(segPlain, fontPaths, 72, 1080, 2);

    // "Hello     " with 5 trailing spaces (simulating end-emoji replacement)
    const segTrailing = parseASSSegments("Hello     ", "Montserrat");
    const posTrailing = getCharXPositions(segTrailing, fontPaths, 72, 1080, 2);

    // The "H" position should be the same in both cases because libass
    // trims trailing spaces from the centering width. The visible text
    // "Hello" should center identically regardless of trailing spaces.
    expect(posTrailing[0]).toBeCloseTo(posPlain[0]!, 1);
    expect(posTrailing[1]).toBeCloseTo(posPlain[1]!, 1);
    expect(posTrailing[4]).toBeCloseTo(posPlain[4]!, 1);
  });

  test("leading spaces are trimmed for center alignment (matching libass)", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    // "Hello" without leading spaces
    const segPlain = parseASSSegments("Hello", "Montserrat");
    const posPlain = getCharXPositions(segPlain, fontPaths, 72, 1080, 2);

    // "     Hello" with 5 leading spaces (simulating begin-emoji replacement)
    const segLeading = parseASSSegments("     Hello", "Montserrat");
    const posLeading = getCharXPositions(segLeading, fontPaths, 72, 1080, 2);

    // The "H" in "     Hello" is at index 5. Its position should match the
    // "H" in "Hello" at index 0, because libass trims leading spaces from
    // the centering width.
    expect(posLeading[5]).toBeCloseTo(posPlain[0]!, 1);
    expect(posLeading[6]).toBeCloseTo(posPlain[1]!, 1);
    expect(posLeading[9]).toBeCloseTo(posPlain[4]!, 1);
  });

  test("leading spaces shift cursor left from visible text start", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    const spaceWidth = getSpaceWidth(MONTSERRAT_PATH, 72);

    // "     Hello" — 5 leading spaces
    const segments = parseASSSegments("     Hello", "Montserrat");
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);

    // The leading spaces should precede "H" — position[0] < position[5]
    expect(positions[0]).toBeLessThan(positions[5]!);
    // The gap between position[0] and position[5] should be ~5 * spaceWidth
    expect(positions[5]! - positions[0]!).toBeCloseTo(5 * spaceWidth, 1);
  });

  test("both leading and trailing spaces are trimmed for center alignment", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    // "Hello" without any spaces
    const segPlain = parseASSSegments("Hello", "Montserrat");
    const posPlain = getCharXPositions(segPlain, fontPaths, 72, 1080, 2);

    // "   Hello   " with leading and trailing spaces
    const segBoth = parseASSSegments("   Hello   ", "Montserrat");
    const posBoth = getCharXPositions(segBoth, fontPaths, 72, 1080, 2);

    // "H" at index 3 in "   Hello   " should match "H" at index 0 in "Hello"
    expect(posBoth[3]).toBeCloseTo(posPlain[0]!, 1);
    expect(posBoth[7]).toBeCloseTo(posPlain[4]!, 1);
  });

  test("left alignment is unaffected by whitespace trimming", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
    ]);
    // Left alignment: startX = marginL regardless of trimming
    const segPlain = parseASSSegments("Hello", "Montserrat");
    const posPlain = getCharXPositions(segPlain, fontPaths, 72, 1080, 1, 10, 10);

    const segTrailing = parseASSSegments("Hello     ", "Montserrat");
    const posTrailing = getCharXPositions(segTrailing, fontPaths, 72, 1080, 1, 10, 10);

    // Both should start at marginL=10
    expect(posPlain[0]).toBeCloseTo(10, 1);
    expect(posTrailing[0]).toBeCloseTo(10, 1);
  });
});

// ---------------------------------------------------------------------------
// Arabic / complex script tests (require NotoSansArabic)
// ---------------------------------------------------------------------------

describe("Arabic text measurement (GSUB fallback)", () => {
  test("getCharXPositions does not crash on Arabic text", () => {
    const fontPaths: FontPathMap = new Map([
      ["Noto Sans Arabic", ARABIC_PATH],
    ]);
    const segments = parseASSSegments(
      "{\fnNoto Sans Arabic}مرحبا بالعالم",
      "Montserrat",
    );
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);
    expect(positions.length).toBeGreaterThan(0);
    // Positions should be strictly increasing (logical LTR order)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });

  test("measureLineWidth does not crash on Arabic text", () => {
    const fontPaths: FontPathMap = new Map([
      ["Noto Sans Arabic", ARABIC_PATH],
    ]);
    const segments = parseASSSegments(
      "{\fnNoto Sans Arabic}مرحبا",
      "Montserrat",
    );
    const width = measureLineWidth(segments, fontPaths, 72);
    expect(width).toBeGreaterThan(0);
  });

  test("getCharAdvances does not crash on Arabic text", () => {
    const advances = getCharAdvances("مرحبا", ARABIC_PATH, 72);
    expect(advances.length).toBe(5);
    for (const a of advances) {
      expect(a).toBeGreaterThan(0);
    }
  });

  test("Arabic + Latin mixed text positions are valid", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
      ["Noto Sans Arabic", ARABIC_PATH],
    ]);
    const segments = parseASSSegments(
      "Hello {\fnNoto Sans Arabic}عالم",
      "Montserrat",
    );
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);
    // "Hello " = 6 chars + "عالم" = 4 chars = 10 total
    expect(positions.length).toBe(10);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });

  test("Arabic text with emoji spaces has correct charPositions length", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
      ["Noto Sans Arabic", ARABIC_PATH],
    ]);
    // Simulating "💪 مرحبا" stripped with 5 spaces: "      مرحبا" (11 chars)
    const segments = parseASSSegments(
      "      {\fnNoto Sans Arabic}مرحبا",
      "Montserrat",
    );
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);
    expect(positions.length).toBe(11);
  });
});

describe("CJK text measurement", () => {
  test("Japanese text positions are valid", () => {
    const fontPaths: FontPathMap = new Map([
      ["Noto Sans CJK JP", CJK_JP_PATH],
    ]);
    const segments = parseASSSegments(
      "{\fnNoto Sans CJK JP}こんにちは",
      "Montserrat",
    );
    const positions = getCharXPositions(segments, fontPaths, 72, 1080, 2);
    expect(positions.length).toBe(5);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]!);
    }
  });

  test("CJK characters are wider than Latin characters", () => {
    const fontPaths: FontPathMap = new Map([
      ["Montserrat", MONTSERRAT_PATH],
      ["Noto Sans CJK JP", CJK_JP_PATH],
    ]);
    const latinSegs = parseASSSegments("Hello", "Montserrat");
    const latinWidth = measureLineWidth(latinSegs, fontPaths, 72);

    const cjkSegs = parseASSSegments(
      "{\fnNoto Sans CJK JP}こんにちは",
      "Montserrat",
    );
    const cjkWidth = measureLineWidth(cjkSegs, fontPaths, 72);
    // 5 CJK chars should be wider than 5 Latin chars (CJK are full-width)
    expect(cjkWidth).toBeGreaterThan(latinWidth);
  });
});

// ---------------------------------------------------------------------------
// Multi-font tests (require all fonts)
// ---------------------------------------------------------------------------

describe("getEffectivePpem across fonts", () => {
  const fontCases: { name: string; path: string; fontSize: number; expectedRange: [number, number] }[] = [
    { name: "Montserrat@72", path: MONTSERRAT_PATH, fontSize: 72, expectedRange: [44, 48] },
    { name: "Montserrat@48", path: MONTSERRAT_PATH, fontSize: 48, expectedRange: [29, 33] },
    { name: "Montserrat@96", path: MONTSERRAT_PATH, fontSize: 96, expectedRange: [59, 63] },
    { name: "Montserrat@24", path: MONTSERRAT_PATH, fontSize: 24, expectedRange: [14, 17] },
    { name: "Poppins@48", path: POPPINS_PATH, fontSize: 48, expectedRange: [25, 30] },
    { name: "Roboto@96", path: ROBOTO_PATH, fontSize: 96, expectedRange: [70, 76] },
    { name: "Bebas Neue@72", path: BEBAS_PATH, fontSize: 72, expectedRange: [52, 58] },
  ];

  for (const tc of fontCases) {
    test(`${tc.name} ppem is in expected range`, () => {
      const ppem = getEffectivePpem(tc.path, tc.fontSize);
      expect(ppem).toBeGreaterThanOrEqual(tc.expectedRange[0]);
      expect(ppem).toBeLessThanOrEqual(tc.expectedRange[1]);
    });
  }

  test("ppem scales linearly with fontSize for same font", () => {
    const ppem48 = getEffectivePpem(MONTSERRAT_PATH, 48);
    const ppem96 = getEffectivePpem(MONTSERRAT_PATH, 96);
    expect(ppem96 / ppem48).toBeCloseTo(2, 2);
  });
});

describe("getFontMetrics across fonts", () => {
  test("Montserrat metrics are consistent", () => {
    const m72 = getFontMetrics(MONTSERRAT_PATH, 72);
    const m48 = getFontMetrics(MONTSERRAT_PATH, 48);
    // Metrics should scale proportionally
    expect(m72.capHeight / m48.capHeight).toBeCloseTo(72 / 48, 1);
    expect(m72.winAscent / m48.winAscent).toBeCloseTo(72 / 48, 1);
    expect(m72.winDescent / m48.winDescent).toBeCloseTo(72 / 48, 1);
  });

  test("winAscent > capHeight for all fonts", () => {
    for (const path of [MONTSERRAT_PATH, POPPINS_PATH, ROBOTO_PATH, BEBAS_PATH]) {
      const m = getFontMetrics(path, 72);
      expect(m.winAscent).toBeGreaterThan(m.capHeight);
    }
  });

  test("winAscent + winDescent approximately equals fontSize", () => {
    // For any font, winAscent + winDescent in pixels should be close to
    // the fontSize since fontSize = cellHeight in ASS
    for (const path of [MONTSERRAT_PATH, POPPINS_PATH, ROBOTO_PATH, BEBAS_PATH]) {
      const m = getFontMetrics(path, 72);
      expect(m.winAscent + m.winDescent).toBeCloseTo(72, 0);
    }
  });
});

describe("getSpaceWidth across fonts and sizes", () => {
  test("space width is positive for all fonts", () => {
    for (const path of [MONTSERRAT_PATH, POPPINS_PATH, ROBOTO_PATH, BEBAS_PATH]) {
      const w = getSpaceWidth(path, 72);
      expect(w).toBeGreaterThan(0);
    }
  });

  test("space width scales linearly with fontSize", () => {
    for (const path of [MONTSERRAT_PATH, POPPINS_PATH, ROBOTO_PATH]) {
      const w48 = getSpaceWidth(path, 48);
      const w96 = getSpaceWidth(path, 96);
      expect(w96 / w48).toBeCloseTo(2, 2);
    }
  });

  test("Bebas Neue has narrower spaces than Montserrat", () => {
    // Bebas Neue is a condensed font — spaces should be narrower
    const bebas = getSpaceWidth(BEBAS_PATH, 72);
    const mont = getSpaceWidth(MONTSERRAT_PATH, 72);
    expect(bebas).toBeLessThan(mont);
  });
});

// ---------------------------------------------------------------------------
// Emoji positioning pipeline tests (multi-font, multi-size)
// ---------------------------------------------------------------------------

describe("emoji positioning pipeline", () => {
  const VIDEO_SIZE = 1080;

  interface PipelineTestCase {
    label: string;
    text: string;
    fontPath: string;
    fontName: string;
    fontSize: number;
  }

  const cases: PipelineTestCase[] = [
    { label: "Montserrat@72", text: "Hello 💪 world", fontPath: MONTSERRAT_PATH, fontName: "Montserrat", fontSize: 72 },
    { label: "Montserrat@48", text: "Hello 💪 world", fontPath: MONTSERRAT_PATH, fontName: "Montserrat", fontSize: 48 },
    { label: "Montserrat@96", text: "Hello 💪 world", fontPath: MONTSERRAT_PATH, fontName: "Montserrat", fontSize: 96 },
    { label: "Montserrat@24", text: "Hello 💪 world", fontPath: MONTSERRAT_PATH, fontName: "Montserrat", fontSize: 24 },
    { label: "Poppins@48", text: "Hello 💪 world", fontPath: POPPINS_PATH, fontName: "Poppins", fontSize: 48 },
    { label: "Roboto@96", text: "Hello 💪 world", fontPath: ROBOTO_PATH, fontName: "Roboto", fontSize: 96 },
    { label: "Bebas@72", text: "HELLO 💪 WORLD", fontPath: BEBAS_PATH, fontName: "Bebas Neue", fontSize: 72 },
  ];

  for (const tc of cases) {
    describe(tc.label, () => {
      test("spacesPerEmoji reserves enough room for emoji", () => {
        const metrics = getFontMetrics(tc.fontPath, tc.fontSize);
        const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
        const spaceWidth = getSpaceWidth(tc.fontPath, tc.fontSize);
        const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

        // Reserved space block must be wider than the emoji
        const blockWidth = spacesPerEmoji * spaceWidth;
        expect(blockWidth).toBeGreaterThan(emojiSize);
        // And should have at least 1 space of padding
        expect(blockWidth - emojiSize).toBeGreaterThanOrEqual(spaceWidth * 0.9);
      });

      test("emoji charIndex points to a space in stripped text", () => {
        const metrics = getFontMetrics(tc.fontPath, tc.fontSize);
        const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
        const spaceWidth = getSpaceWidth(tc.fontPath, tc.fontSize);
        const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

        const stripped = stripEmoji(tc.text, spacesPerEmoji);
        const instances = extractEmoji(tc.text, spacesPerEmoji);

        for (const inst of instances) {
          expect(stripped[inst.charIndex]).toBe(" ");
        }
      });

      test("charPositions has correct length for stripped text", () => {
        const metrics = getFontMetrics(tc.fontPath, tc.fontSize);
        const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
        const spaceWidth = getSpaceWidth(tc.fontPath, tc.fontSize);
        const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

        const stripped = stripEmoji(tc.text, spacesPerEmoji);
        const fontPathMap: FontPathMap = new Map([[tc.fontName, tc.fontPath]]);
        const segments = parseASSSegments(stripped, tc.fontName);
        const charPositions = getCharXPositions(
          segments, fontPathMap, tc.fontSize, VIDEO_SIZE, 2, 10, 10,
        );

        expect(charPositions.length).toBe(stripped.length);
      });

      test("emoji overlay X is within the reserved space block", () => {
        const metrics = getFontMetrics(tc.fontPath, tc.fontSize);
        const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
        const spaceWidth = getSpaceWidth(tc.fontPath, tc.fontSize);
        const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

        const stripped = stripEmoji(tc.text, spacesPerEmoji);
        const instances = extractEmoji(tc.text, spacesPerEmoji);
        const fontPathMap: FontPathMap = new Map([[tc.fontName, tc.fontPath]]);
        const segments = parseASSSegments(stripped, tc.fontName);
        const charPositions = getCharXPositions(
          segments, fontPathMap, tc.fontSize, VIDEO_SIZE, 2, 10, 10,
        );

        for (const inst of instances) {
          const firstSpaceX = charPositions[inst.charIndex]!;
          const lastSpaceIdx = Math.min(
            inst.charIndex + spacesPerEmoji - 1,
            charPositions.length - 1,
          );
          const lastSpaceX = charPositions[lastSpaceIdx]!;
          const blockEndX = lastSpaceX + spaceWidth;
          const blockWidth = blockEndX - firstSpaceX;
          const x = Math.round(firstSpaceX + blockWidth / 2 - emojiSize / 2);

          // Emoji left edge should be at or after the block start
          expect(x).toBeGreaterThanOrEqual(Math.floor(firstSpaceX));
          // Emoji right edge should be at or before the block end
          expect(x + emojiSize).toBeLessThanOrEqual(Math.ceil(blockEndX) + 1);
        }
      });

      test("emoji overlay Y is within video bounds", () => {
        const metrics = getFontMetrics(tc.fontPath, tc.fontSize);
        const y = calculateEmojiY(2, 480, metrics.winDescent, metrics.winAscent, metrics.capHeight, VIDEO_SIZE, VIDEO_SIZE);
        const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);

        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + emojiSize).toBeLessThanOrEqual(VIDEO_SIZE);
      });
    });
  }

  // Begin/end specific tests
  describe("begin emoji positioning", () => {
    test("begin emoji is at or near the start of the text line", () => {
      const fontPathMap: FontPathMap = new Map([["Montserrat", MONTSERRAT_PATH]]);
      const metrics = getFontMetrics(MONTSERRAT_PATH, 72);
      const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
      const spaceWidth = getSpaceWidth(MONTSERRAT_PATH, 72);
      const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

      // "💪 Hello world" — emoji is at the very start
      const stripped = stripEmoji("💪 Hello world", spacesPerEmoji);
      const instances = extractEmoji("💪 Hello world", spacesPerEmoji);
      const segments = parseASSSegments(stripped, "Montserrat");
      const charPositions = getCharXPositions(
        segments, fontPathMap, 72, VIDEO_SIZE, 2, 10, 10,
      );

      const inst = instances[0]!;
      expect(inst.charIndex).toBe(0);
      // The first character position should be the leftmost text position
      expect(charPositions[0]).toBeGreaterThan(0);
      expect(charPositions[0]).toBeLessThan(VIDEO_SIZE / 2);
    });
  });

  describe("end emoji positioning", () => {
    test("end emoji is at or near the end of the text line", () => {
      const fontPathMap: FontPathMap = new Map([["Montserrat", MONTSERRAT_PATH]]);
      const metrics = getFontMetrics(MONTSERRAT_PATH, 72);
      const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
      const spaceWidth = getSpaceWidth(MONTSERRAT_PATH, 72);
      const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

      // "Hello world 💪" — emoji is at the end
      const stripped = stripEmoji("Hello world 💪", spacesPerEmoji);
      const instances = extractEmoji("Hello world 💪", spacesPerEmoji);
      const segments = parseASSSegments(stripped, "Montserrat");
      const charPositions = getCharXPositions(
        segments, fontPathMap, 72, VIDEO_SIZE, 2, 10, 10,
      );

      const inst = instances[0]!;
      const firstSpaceX = charPositions[inst.charIndex]!;
      // The last emoji space should be the rightmost character
      const lastIdx = charPositions.length - 1;
      expect(inst.charIndex + spacesPerEmoji - 1).toBe(lastIdx);
      // And the emoji should be in the right half of the video
      expect(firstSpaceX).toBeGreaterThan(VIDEO_SIZE / 2);
    });
  });

  describe("multiple emoji positioning", () => {
    test("multiple emoji are in strictly increasing X order", () => {
      const fontPathMap: FontPathMap = new Map([["Montserrat", MONTSERRAT_PATH]]);
      const metrics = getFontMetrics(MONTSERRAT_PATH, 72);
      const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
      const spaceWidth = getSpaceWidth(MONTSERRAT_PATH, 72);
      const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

      const text = "💪 Hello 🔥 world 💪";
      const stripped = stripEmoji(text, spacesPerEmoji);
      const instances = extractEmoji(text, spacesPerEmoji);
      const segments = parseASSSegments(stripped, "Montserrat");
      const charPositions = getCharXPositions(
        segments, fontPathMap, 72, VIDEO_SIZE, 2, 10, 10,
      );

      expect(instances.length).toBe(3);

      const xPositions = instances.map((inst) => {
        const firstSpaceX = charPositions[inst.charIndex]!;
        const lastSpaceIdx = Math.min(inst.charIndex + spacesPerEmoji - 1, charPositions.length - 1);
        const lastSpaceX = charPositions[lastSpaceIdx]!;
        const blockEndX = lastSpaceX + spaceWidth;
        const blockWidth = blockEndX - firstSpaceX;
        return Math.round(firstSpaceX + blockWidth / 2 - emojiSize / 2);
      });

      // Each emoji X should be strictly greater than the previous
      for (let i = 1; i < xPositions.length; i++) {
        expect(xPositions[i]).toBeGreaterThan(xPositions[i - 1]!);
      }
    });
  });

  describe("consecutive emoji positioning", () => {
    test("consecutive emoji do not overlap", () => {
      const fontPathMap: FontPathMap = new Map([["Montserrat", MONTSERRAT_PATH]]);
      const metrics = getFontMetrics(MONTSERRAT_PATH, 72);
      const emojiSize = calculateEmojiSize(metrics.winAscent, VIDEO_SIZE, VIDEO_SIZE);
      const spaceWidth = getSpaceWidth(MONTSERRAT_PATH, 72);
      const spacesPerEmoji = Math.max(1, Math.ceil(emojiSize / spaceWidth) + 1);

      const text = "Let's go 💪🔥";
      const stripped = stripEmoji(text, spacesPerEmoji);
      const instances = extractEmoji(text, spacesPerEmoji);
      const segments = parseASSSegments(stripped, "Montserrat");
      const charPositions = getCharXPositions(
        segments, fontPathMap, 72, VIDEO_SIZE, 2, 10, 10,
      );

      expect(instances.length).toBe(2);

      const overlays = instances.map((inst) => {
        const firstSpaceX = charPositions[inst.charIndex]!;
        const lastSpaceIdx = Math.min(inst.charIndex + spacesPerEmoji - 1, charPositions.length - 1);
        const lastSpaceX = charPositions[lastSpaceIdx]!;
        const blockEndX = lastSpaceX + spaceWidth;
        const blockWidth = blockEndX - firstSpaceX;
        return Math.round(firstSpaceX + blockWidth / 2 - emojiSize / 2);
      });

      // Second emoji should not overlap with first
      // (first emoji right edge < second emoji left edge)
      expect(overlays[0]! + emojiSize).toBeLessThanOrEqual(overlays[1]!);
    });
  });
});
